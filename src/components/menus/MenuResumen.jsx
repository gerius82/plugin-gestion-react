import { useEffect, useMemo, useState } from "react";
import { FaCalendarDay, FaCalendarAlt, FaChartPie,FaCheckCircle, FaExclamationCircle, FaUserPlus, FaUsers,FaFileSignature, FaUserMinus, FaDollarSign, FaInfoCircle } from "react-icons/fa";


export default function FichaResumenes() {
  const [tab, setTab] = useState("diario");

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6">Resumenes & Control</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <TabButton
          icon={<FaCalendarDay />}
          label="Resumen diario"
          active={tab === "diario"}
          onClick={() => setTab("diario")}
          color="green"
        />
        <TabButton
          icon={<FaCalendarAlt />}
          label="Resumen mensual"
          active={tab === "mensual"}
          onClick={() => setTab("mensual")}
          color="blue"
        />
        <TabButton
          icon={<FaChartPie />}
          label="Dashboard de gastos"
          active={tab === "gastos"}
          onClick={() => setTab("gastos")}
          color="purple"
        />
        <TabButton
          icon={<FaUsers />}
          label="Asignacion de profes"
          active={tab === "asignacion"}
          onClick={() => setTab("asignacion")}
          color="green"
        />
        <TabButton
          icon={<FaDollarSign />}
          label="Gastos fijos"
          active={tab === "gastos-fijos"}
          onClick={() => setTab("gastos-fijos")}
          color="blue"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
        {tab === "diario" && <PanelDiario />}
        {tab === "mensual" && <PanelMensual />}
        {tab === "gastos" && <PanelGastos />}
        {tab === "asignacion" && <PanelAsignacionProfes />}
        {tab === "gastos-fijos" && <PanelGastosFijos />}
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick, color }) {
  const colorMap = {
    green: "border-green-500 text-green-600",
    blue: "border-blue-500 text-blue-600",
    purple: "border-purple-500 text-purple-600",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 justify-center rounded-xl py-3 px-4 border-l-8 bg-white shadow-sm hover:bg-gray-50 transition ${
        active ? `${colorMap[color]}` : "border-gray-200 text-gray-700"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

// --------------------------- Config Supabase ---------------------------
function useSupabaseConfig() {
  const [cfg, setCfg] = useState({ url: "", key: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/config.json");
        if (!res.ok) throw new Error("No se pudo cargar config.json");
        const j = await res.json();
        if (mounted) setCfg({ url: j.supabaseUrl || "", key: j.supabaseKey || "" });
      } catch (e) {
        if (mounted) setError(e.message || "Error de configuración");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const headers = useMemo(() => ({ apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }), [cfg.key]);
  return { ...cfg, headers, loading, error };
}

// ------------------------------ Utilidades ------------------------------
function niceDate(isoYmd) {
  if (!isoYmd) return "";
  const [y, m, d] = isoYmd.split("-");
  return `${d}/${m}/${y}`;
}

function Capitalize(s = "") {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Convierte YYYY-MM a nombre de mes ("2025-08" -> "Agosto")
function monthNameEs(yyyyMm) {
  const [, mStr] = yyyyMm.split("-");
  const m = Number(mStr);
  const nombres = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];
  return nombres[(m - 1) % 12];
}

function finDeMesIso(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m, 0);
  return `${yyyyMm}-${String(d.getDate()).padStart(2, "0")}T23:59:59`;
}

// ----------------------------- Panel: Diario -----------------------------
function PanelDiario() {
  const { url, headers, loading: cfgLoading, error: cfgError } = useSupabaseConfig();

  // Fecha local (no UTC → evita “mañana” por defecto)
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  const [fecha, setFecha] = useState(() => hoy.toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState({
    asistencias: [],
    pagos: [],
    inscripciones: [],
    inactivos: [],
  });

  async function cargar() {
    if (!fecha || !url) return;
    setLoading(true);
    setError("");
    try {
      // 1) Asistencias del día
      const desde = `${fecha}T00:00:00`;
      const hasta = `${fecha}T23:59:59`;
      const asRes = await fetch(
        `${url}/rest/v1/asistencias?select=alumno_id,turno,sede,tipo,recuperada,fecha&fecha=gte.${desde}&fecha=lte.${hasta}`,
        { headers }
      );
      const asistencias = await asRes.json();

      // 2) Pagos del día (todos: cuota e inscripción)
      const pgRes = await fetch(
        `${url}/rest/v1/pagos?select=id,alumno_id,monto_total,medio_pago,pago_mes,pago_inscripcion,creado_en&creado_en=gte.${fecha}T00:00:00&creado_en=lte.${fecha}T23:59:59`,
        { headers }
      );
      const pagosBase = await pgRes.json();

      // Enriquecer pagos con nombre/apellido (1 sola consulta IN (...) a inscripciones)
      let pagos = pagosBase;
      const alumnoIds = Array.from(new Set(pagosBase.map(p => p.alumno_id))).filter(Boolean);
      if (alumnoIds.length > 0) {
        const idsCsv = alumnoIds.join(",");
        const inscRes = await fetch(
          `${url}/rest/v1/inscripciones?select=id,nombre,apellido&id=in.(${idsCsv})`,
          { headers }
        );
        const insc = await inscRes.json();
        const mapNombre = new Map(insc.map(a => [a.id, { nombre: a.nombre, apellido: a.apellido }]));
        pagos = pagosBase.map(p => ({ 
          ...p, 
          alumno: mapNombre.get(p.alumno_id) || null 
        }));
      }

      // 3) Inscripciones nuevas (del día)
      const inRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,nombre,apellido&creado_en=gte.${fecha}T00:00:00&creado_en=lte.${fecha}T23:59:59`,
        { headers }
      );
      const inscripciones = await inRes.json();

      // 4) Inactivaciones (del día)
      const iaRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,nombre,apellido&activo=eq.false&actualizado_en=gte.${fecha}T00:00:00&actualizado_en=lte.${fecha}T23:59:59`,
        { headers }
      );
      const inactivos = await iaRes.json();

      setData({ asistencias, pagos, inscripciones, inactivos });
    } catch (e) {
      setError(e.message || "No se pudo generar el resumen");
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial y cuando cambia la fecha / config OK
  useEffect(() => {
    if (!cfgLoading && !cfgError) cargar();
  }, [cfgLoading, cfgError, fecha]);

  // Agrupar asistencias y ordenar por sede, luego turno
  const gruposAsist = useMemo(() => {
    const grupos = agruparAsistencias(data.asistencias);
    return grupos.sort((a, b) => a.sede.localeCompare(b.sede) || a.turno.localeCompare(b.turno));
  }, [data.asistencias]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-1">Seleccionar fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {(cfgError || error) && (
        <p className="text-red-600 text-sm">{cfgError || error}</p>
      )}

      <h2 className="text-xl font-bold">🗓️ {niceDate(fecha)}</h2>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Pagos del día" value={data.pagos.length} />
        <KpiCard label="Nuevas inscripciones" value={data.inscripciones.length} />
        <KpiCard label="Inactivaciones" value={data.inactivos.length} />
      </div>

      {/* Listado de pagos con medio + chips de concepto */}
      {data.pagos.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-blue-600 mb-1">Pagos registrados</h3>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {data.pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {p.alumno?.nombre} {p.alumno?.apellido}
                </span>
                {p.medio_pago === "efectivo" && (
                  <span className="text-green-600">💵 Efectivo</span>
                )}
                {p.medio_pago === "transferencia" && (
                  <span className="text-blue-600">💳 Transferencia</span>
                )}
                {p.pago_inscripcion && (
                  <span className="ml-1 text-purple-600 text-xs">(Inscripción)</span>
                )}
                {p.pago_mes && (
                  <span className="ml-1 text-gray-600 text-xs">(Cuota)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Listas de inscriptos e inactivados */}
      {data.inscripciones.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-green-600 mb-1">Nuevos inscriptos</h3>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {data.inscripciones.map((al) => (
              <li key={al.id}>
                {al.nombre} {al.apellido}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.inactivos.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-red-600 mb-1">Inactivados</h3>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {data.inactivos.map((al) => (
              <li key={al.id}>
                {al.nombre} {al.apellido}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Asistencias: bloques por sede -> tarjetas por turno (sin íconos) */}
      {gruposAsist.length > 0 && (
        <div className="mt-6 border-t pt-4 space-y-6">
          <h3 className="font-semibold mb-2">Asistencias por sede y turno</h3>

          {Array.from(new Set(gruposAsist.map((g) => g.sede))).map((sede) => (
            <div key={sede}>
              <h4 className="font-semibold text-gray-800 mb-2">{sede}</h4>

              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">Turno</th>
                    <th className="px-3 py-2 text-center text-green-600">✔ Presentes</th>
                    <th className="px-3 py-2 text-center text-red-600">✖ Ausentes</th>
                    <th className="px-3 py-2 text-center text-gray-600">🔄 Recuperando</th>
                  </tr>
                  
                </thead>
                <tbody>
                  {gruposAsist
                    .filter((g) => g.sede === sede)
                    .map((g, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{g.turno}</td>
                        <td className="px-3 py-2 text-center">{g.regulares}</td>
                        <td className="px-3 py-2 text-center">{g.ausentes}</td>
                        <td className="px-3 py-2 text-center">{g.recuperaciones}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {!loading &&
        !data.asistencias.length &&
        !data.pagos.length &&
        !data.inscripciones.length &&
        !data.inactivos.length && (
          <p className="text-gray-600">No se registraron eventos en esta fecha.</p>
        )}
    </div>
  );
}



function agruparAsistencias(asistencias = []) {
  const grupos = {};
  for (const a of asistencias) {
    const clave = `${a.turno}__${a.sede}`;
    if (!grupos[clave]) grupos[clave] = { turno: a.turno, sede: a.sede, regulares: 0, ausentes: 0, recuperaciones: 0 };
    if (a.tipo === "regular") {
      grupos[clave].regulares++;
      } else if (a.tipo === "ausente") {
      // ⚠️ si está marcada como recuperada, NO la contamos como ausente del día
      if (!a.recuperada) grupos[clave].ausentes++;
      } else if (a.tipo === "recuperacion") {
      grupos[clave].recuperaciones++;
    }
  }

  return Object.values(grupos).sort((a, b) => {
    if (a.sede !== b.sede) return a.sede.localeCompare(b.sede);
    const horaA = (a.turno || "").split(" ").slice(1).join(" ");
    const horaB = (b.turno || "").split(" ").slice(1).join(" ");
    return horaA.localeCompare(horaB);
  });
}

function PagoItem({ pago, url, headers }) {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(
          `${url}/rest/v1/inscripciones?id=eq.${pago.alumno_id}&select=nombre,apellido`,
          { headers }
        );
        const [a] = await r.json();
        if (mounted) setNombre(a ? `${a.nombre} ${a.apellido}` : `ID ${pago.alumno_id}`);
      } catch {
        if (mounted) setNombre(`ID ${pago.alumno_id}`);
      }
    })();
    return () => { mounted = false; };
  }, [pago.alumno_id, url, headers]);

  const conceptos = useMemo(() => {
    const c = [];
    if (pago.pago_mes) c.push(`Cuota ${pago.mes}`);
    if (pago.pago_inscripcion) c.push("Inscripción");
    return c.join(" + ");
  }, [pago.pago_mes, pago.pago_inscripcion, pago.mes]);

  return (
    <li className="text-gray-700">• {nombre} – ${""}{pago.monto_total} – {Capitalize(pago.medio_pago)} – {conceptos}</li>
  );
}

// ---------------------------- Panel: Mensual -----------------------------
function KpiCard({ label, value }) {
  let extraClasses = "bg-gray-50"; // fondo por defecto

  if (label.toLowerCase().includes("inscripcion")) {
    extraClasses = "bg-green-50"; // verde suave
  }
  if (label.toLowerCase().includes("inactivacion")) {
    extraClasses = "bg-red-50"; // rojo suave
  }

  return (
    <div
      className={`border rounded-xl p-3 text-center shadow-sm min-w-[110px] h-20 flex flex-col justify-center ${extraClasses}`}
    >
      <div className="text-sm font-semibold text-gray-600">{label}</div>
      <div className="text-lg text-gray-700">{value}</div>
    </div>
  );
}


function PanelMensual() {
  const { url, headers } = useSupabaseConfig();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totales, setTotales] = useState({
    pagos: 0,
    faltantes: 0,
    inscripciones: 0,
    inactivaciones: 0,
    monto: 0,
    pagosNormal: 0,
    pagosPromo: 0,
    faltantesPromo: 0, 
    faltantesNormales: 0,
    activosNormal: 0,
    activosPromo: 0,
    ingresoOptimistaNormal: 0,
    ingresoOptimistaPromo: 0,
    ingresoOptimistaTotal: 0,
    cuotaBase: 0,
    promoDescuentoPct: 10
  });

  async function cargarMensual() {
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const mesNombre = monthNameEs(mes);

      // 1) Pagos mensuales (activos). Incluye pago_antes si existe la columna.
      const pgRes = await fetch(
        `${url}/rest/v1/pagos?select=alumno_id,monto_total,mes,pago_mes&mes=eq.${mesNombre}&pago_mes=eq.true`,
        { headers }
      );
      const pagosMensuales = await pgRes.json();

      // 2) Activos por matricula (estado activa) y curso mas reciente por alumno
      const matriculasRes = await fetch(
        `${url}/rest/v1/matriculas?select=alumno_id,curso_id,creado_en,inscripciones(tiene_promo)&estado=eq.activa`,
        { headers }
      );
      const matriculasActivas = await matriculasRes.json();
      const ultimasPorAlumno = new Map();
      (matriculasActivas || []).forEach((m) => {
        if (!m.alumno_id) return;
        const prev = ultimasPorAlumno.get(m.alumno_id);
        const prevFecha = prev?.creado_en ? new Date(prev.creado_en).getTime() : 0;
        const nuevaFecha = m.creado_en ? new Date(m.creado_en).getTime() : 0;
        if (!prev || nuevaFecha >= prevFecha) ultimasPorAlumno.set(m.alumno_id, m);
      });
      const promoMap = new Map(
        Array.from(ultimasPorAlumno.values()).map((m) => [
          m.alumno_id,
          !!m.inscripciones?.tiene_promo,
        ])
      );
      const matriculasIds = Array.from(ultimasPorAlumno.keys());
      const matriculasSet = new Set(matriculasIds);

      // Filtrar pagos a sólo matriculas activas
      const pagosActivos = pagosMensuales.filter((p) => matriculasSet.has(p.alumno_id));

      const monto = pagosActivos.reduce((acc, p) => acc + (Number(p.monto_total) || 0), 0);
      const cantidadAlumnosQuePagaron = new Set(pagosActivos.map((p) => p.alumno_id)).size;
      const faltantes = Math.max(0, matriculasSet.size - cantidadAlumnosQuePagaron);

      // Split de faltantes usando promo desde matriculas activas
      const pagaronSet = new Set(pagosActivos.map(p => p.alumno_id));
      const faltantesIds = [...matriculasSet].filter(id => !pagaronSet.has(id));
      const faltantesPromo = faltantesIds.filter(id => promoMap.get(id) === true).length;
      const faltantesNormales = Math.max(0, faltantes - faltantesPromo);

      // Desglose: antes / promo / normal
      const pagosAntes = pagosActivos.filter((p) => p.pago_antes === true).length;
      const pagosPromo = pagosActivos.filter((p) => promoMap.get(p.alumno_id) === true).length;
      const pagosNormal = Math.max(0, cantidadAlumnosQuePagaron - pagosPromo);

      // Precios por curso (ultimo curso activo por alumno)
      const cursoIds = Array.from(
        new Set(
          Array.from(ultimasPorAlumno.values())
            .map((m) => m.curso_id)
            .filter(Boolean)
        )
      );
      let precioPorCurso = new Map();
      if (cursoIds.length > 0) {
        const crRes = await fetch(
          `${url}/rest/v1/cursos?select=id,precio_curso&id=in.(${cursoIds.join(",")})`,
          { headers }
        );
        const crData = await crRes.json();
        precioPorCurso = new Map(
          (Array.isArray(crData) ? crData : []).map((c) => [c.id, Number(c.precio_curso || 0)])
        );
      }
      const fallbackCuota = 45000;

      const promoDescuentoPct = 10;
      const activosNormal = Math.max(0, pagosNormal + faltantesNormales);
      const activosPromo = Math.max(0, pagosPromo + faltantesPromo);
      let ingresoOptimistaNormal = 0;
      let ingresoOptimistaPromo = 0;
      let sumaBase = 0;
      let cantBase = 0;
      Array.from(ultimasPorAlumno.values()).forEach((m) => {
        const base = precioPorCurso.get(m.curso_id) || fallbackCuota;
        sumaBase += base;
        cantBase += 1;
        if (promoMap.get(m.alumno_id)) {
          ingresoOptimistaPromo += base * (1 - promoDescuentoPct / 100);
        } else {
          ingresoOptimistaNormal += base;
        }
      });
      const ingresoOptimistaTotal = ingresoOptimistaNormal + ingresoOptimistaPromo;
      const cuotaBase = cantBase > 0 ? Math.round(sumaBase / cantBase) : 0;

      // 3) Inscripciones nuevas (mes calendario)
      const desde = `${mes}-01T00:00:00`;
      const hasta = finDeMesIso(mes);
      const inRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,creado_en&creado_en=gte.${desde}&creado_en=lte.${hasta}`,
        { headers }
      );
      const inscripciones = await inRes.json();

      // 4) Activaciones (reactivaciones): activo=true con actualizado_en en el mes, excluyendo los creados en el mes
      const actMesRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,actualizado_en,creado_en,activo&activo=eq.true&actualizado_en=gte.${desde}&actualizado_en=lte.${hasta}`,
        { headers }
      );
      const activadosMes = await actMesRes.json();
      const nuevosIdsSet = new Set(inscripciones.map((i) => i.id));
      const activaciones = activadosMes.filter((a) => !nuevosIdsSet.has(a.id)).length;

      // 5) Inactivaciones
      const iaRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,actualizado_en&activo=eq.false&actualizado_en=gte.${desde}&actualizado_en=lte.${hasta}`,
        { headers }
      );
      const inactivos = await iaRes.json();

      setTotales({
        pagos: cantidadAlumnosQuePagaron,
        faltantes,
        inscripciones: inscripciones.length,
        activaciones,
        inactivaciones: inactivos.length,
        monto,
        pagosAntes,
        pagosNormal,
        pagosPromo,
        faltantesPromo,
        faltantesNormales,
        activosNormal,
        activosPromo,
        ingresoOptimistaNormal,
        ingresoOptimistaPromo,
        ingresoOptimistaTotal,
        cuotaBase,
        promoDescuentoPct,
      });
    } catch (e) {
      setError(e.message || "No se pudo obtener el resumen mensual");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarMensual();
  }, [mes, url]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
        <div className="flex-1">
            <label className="block text-sm font-semibold mb-1">Mes</label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-300 outline-none"
            />
          </div>
        </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
        <KpiCard label="Pagos" value={totales.pagos} color="green" icon={FaCheckCircle} />
        <KpiCard label="Faltan" value={totales.faltantes} color="amber" icon={FaExclamationCircle}  />
        
        <KpiCard label="Inscripciones" value={totales.inscripciones} color="blue" icon={FaFileSignature} />
        <KpiCard label="Inactivaciones" value={totales.inactivaciones} color="rose" icon={FaUserMinus} />
        <KpiCard label="Recaudado" value={`$${Number(totales.monto).toLocaleString("es-AR")}`} color="emerald" icon={FaDollarSign} />
       </div>

      {/* Desglose de pagos */}
      <div className="mt-6 border-t pt-4">
         <h3 className="font-semibold mb-3">Desglose del mes</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
           <KpiCard label="Cuota normal" value={totales.pagosNormal} color="green" />
           <KpiCard label="Con promo" value={totales.pagosPromo} color="green" />
           <KpiCard label="Faltantes normal" value={totales.faltantesNormales} color="amber" />
           <KpiCard label="Faltantes promo" value={totales.faltantesPromo} color="amber" />
         </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold mb-2">Ingreso hipotetico (100% cobranza)</h3>
        <div className="text-xs text-gray-500 mb-3">
          Valor promedio: ${Number(totales.cuotaBase || 0).toLocaleString("es-AR")} ·
          Promo: {totales.promoDescuentoPct}% descuento
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label={`Normal (${totales.activosNormal})`}
            value={`$${Number(totales.ingresoOptimistaNormal || 0).toLocaleString("es-AR")}`}
            color="green"
          />
          <KpiCard
            label={`Promo (${totales.activosPromo})`}
            value={`$${Number(totales.ingresoOptimistaPromo || 0).toLocaleString("es-AR")}`}
            color="green"
          />
          <KpiCard
            label="Total hipotetico"
            value={`$${Number(totales.ingresoOptimistaTotal || 0).toLocaleString("es-AR")}`}
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
}

// --------------------------- Panel: Gastos (MVP) --------------------------
function PanelGastos() {
  const { url, headers, loading, error } = useSupabaseConfig();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [gastos, setGastos] = useState([]);
  const [gastosFijos, setGastosFijos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorGastos, setErrorGastos] = useState("");
  const [categoria, setCategoria] = useState("Impuestos");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoriasExtra, setCategoriasExtra] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  const [profes, setProfes] = useState([]);
  const [editingGastoId, setEditingGastoId] = useState(null);
  const [gastoDrafts, setGastoDrafts] = useState({});
  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");
  const [sedeSel, setSedeSel] = useState("");
  const [valorTurno, setValorTurno] = useState(45000);
  const [turnosProfes, setTurnosProfes] = useState([]);
  const [ingresos, setIngresos] = useState({
    real: 0,
    hipotetico: 0,
    cuotaBase: 0,
    promoPct: 10,
    activosNormal: 0,
    activosPromo: 0,
  });

  const categoriasBase = ["Impuestos", "Servicios", "Alquiler", "Limpieza", "Sueldos"];
  const categorias = [...categoriasBase, ...categoriasExtra];
  const sedes = ["Calle Mendoza", "Fisherton"];

  const cargarProfes = async () => {
    if (!url || !headers?.apikey) return;
    try {
      const res = await fetch(`${url}/rest/v1/profes?select=id,nombre,tarifa_turno&order=id.asc`, {
        headers,
      });
      const data = await res.json();
      setProfes(Array.isArray(data) ? data : []);
    } catch {
      setProfes([]);
    }
  };

  useEffect(() => {
    cargarProfes();
  }, [url, headers]);

  const cargarGastos = async () => {
    if (!url || !headers?.apikey) return;
    setCargando(true);
    setErrorGastos("");
    try {
      const res = await fetch(
        `${url}/rest/v1/gastos?mes=eq.${mes}&order=creado_en.desc`,
        { headers }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "No pude cargar gastos");
      }
      const data = await res.json();
      setGastos(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrorGastos(e.message || "No pude cargar gastos");
      setGastos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    cargarGastos();
  }, [url, headers, mes]);

  const cargarGastosFijos = async () => {
    if (!url || !headers?.apikey) return;
    try {
      const res = await fetch(
        `${url}/rest/v1/gastos_fijos?select=id,categoria,concepto,monto,frecuencia,sede,activo&activo=eq.true`,
        { headers }
      );
      const data = await res.json();
      setGastosFijos(Array.isArray(data) ? data : []);
    } catch {
      setGastosFijos([]);
    }
  };

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    cargarGastosFijos();
  }, [url, headers]);

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    (async () => {
      try {
        const mesNombre = monthNameEs(mes);
        const pagosRes = await fetch(
          `${url}/rest/v1/pagos?select=alumno_id,monto_total,mes,pago_mes&mes=eq.${mesNombre}&pago_mes=eq.true`,
          { headers }
        );
        const pagosMensuales = await pagosRes.json();

        const matriculasRes = await fetch(
          `${url}/rest/v1/matriculas?select=alumno_id,curso_id,creado_en,inscripciones(tiene_promo)&estado=eq.activa`,
          { headers }
        );
        const matriculasActivas = await matriculasRes.json();
        const ultimasPorAlumno = new Map();
        (matriculasActivas || []).forEach((m) => {
          if (!m.alumno_id) return;
          const prev = ultimasPorAlumno.get(m.alumno_id);
          const prevFecha = prev?.creado_en ? new Date(prev.creado_en).getTime() : 0;
          const nuevaFecha = m.creado_en ? new Date(m.creado_en).getTime() : 0;
          if (!prev || nuevaFecha >= prevFecha) ultimasPorAlumno.set(m.alumno_id, m);
        });
        const matriculasIds = Array.from(ultimasPorAlumno.keys());
        const matriculasSet = new Set(matriculasIds);
        const promoMap = new Map(
          Array.from(ultimasPorAlumno.values()).map((m) => [m.alumno_id, !!m.inscripciones?.tiene_promo])
        );

        const pagosActivos = (pagosMensuales || []).filter((p) => matriculasSet.has(p.alumno_id));
        const real = pagosActivos.reduce((acc, p) => acc + (Number(p.monto_total) || 0), 0);
        const pagaronSet = new Set(pagosActivos.map((p) => p.alumno_id));
        const faltantesIds = [...matriculasSet].filter((id) => !pagaronSet.has(id));
        const faltantesPromo = faltantesIds.filter((id) => promoMap.get(id) === true).length;
        const faltantesNormales = Math.max(0, faltantesIds.length - faltantesPromo);
        const pagosPromo = pagosActivos.filter((p) => promoMap.get(p.alumno_id) === true).length;
        const pagosNormal = Math.max(0, pagaronSet.size - pagosPromo);
        const activosNormal = Math.max(0, pagosNormal + faltantesNormales);
        const activosPromo = Math.max(0, pagosPromo + faltantesPromo);

        const cursoIds = Array.from(
          new Set(
            Array.from(ultimasPorAlumno.values())
              .map((m) => m.curso_id)
              .filter(Boolean)
          )
        );
        let precioPorCurso = new Map();
        if (cursoIds.length > 0) {
          const crRes = await fetch(
            `${url}/rest/v1/cursos?select=id,precio_curso&id=in.(${cursoIds.join(",")})`,
            { headers }
          );
          const crData = await crRes.json();
          precioPorCurso = new Map(
            (Array.isArray(crData) ? crData : []).map((c) => [c.id, Number(c.precio_curso || 0)])
          );
        }
        const fallbackCuota = 45000;
        const promoPct = 10;
        let hipotetico = 0;
        let sumaBase = 0;
        let cantBase = 0;
        Array.from(ultimasPorAlumno.values()).forEach((m) => {
          const base = precioPorCurso.get(m.curso_id) || fallbackCuota;
          sumaBase += base;
          cantBase += 1;
          if (promoMap.get(m.alumno_id)) {
            hipotetico += base * (1 - promoPct / 100);
          } else {
            hipotetico += base;
          }
        });
        const cuotaBase = cantBase > 0 ? Math.round(sumaBase / cantBase) : 0;

        setIngresos({
          real,
          hipotetico,
          cuotaBase,
          promoPct,
          activosNormal,
          activosPromo,
        });
      } catch {
        setIngresos((prev) => ({ ...prev, real: 0, hipotetico: 0 }));
      }
    })();
  }, [url, headers, mes]);

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/ciclos?select=codigo,nombre_publico,orden&order=orden.asc`, { headers });
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setCiclos(lista);
        if (!cicloSel && lista.length) setCicloSel(lista[0].codigo);
      } catch {
        setCiclos([]);
      }
    })();
  }, [url, headers]);

  useEffect(() => {
    if (!url || !headers?.apikey || !cicloSel) return;
    (async () => {
      try {
        const res = await fetch(
          `${url}/rest/v1/cursos?select=precio_curso,nombre&ciclo=eq.${encodeURIComponent(cicloSel)}&nombre=ilike.*basica*&limit=1`,
          { headers }
        );
        const data = await res.json();
        const val = data?.[0]?.precio_curso;
        if (val != null && !Number.isNaN(Number(val))) {
          setValorTurno(Number(val));
        } else {
          setValorTurno(45000);
        }
      } catch {
        setValorTurno(45000);
      }
    })();
  }, [url, headers, cicloSel]);

  useEffect(() => {
    if (!url || !headers?.apikey || !cicloSel) {
      setTurnosProfes([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${url}/rest/v1/turnos_profes?select=profe_id,dia,hora,sede&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}`,
          { headers }
        );
        const data = await res.json();
        setTurnosProfes(Array.isArray(data) ? data : []);
      } catch {
        setTurnosProfes([]);
      }
    })();
  }, [url, headers, cicloSel]);

  const detalleSueldos = useMemo(() => {
    const conteo = new Map();
    const vistos = new Set();
    (Array.isArray(turnosProfes) ? turnosProfes : []).forEach((r) => {
      if (!r.profe_id) return;
      const clave = `${r.profe_id}||${r.dia || ""}||${r.hora || ""}||${r.sede || ""}`;
      if (vistos.has(clave)) return;
      vistos.add(clave);
      conteo.set(r.profe_id, (conteo.get(r.profe_id) || 0) + 1);
    });
    return (Array.isArray(profes) ? profes : [])
      .map((p) => {
        const turnos = conteo.get(p.id) || 0;
        const tarifa = Number(p.tarifa_turno);
        const valor = Number.isFinite(tarifa) ? tarifa : Number(valorTurno || 0);
        return {
          id: p.id,
          nombre: p.nombre,
          turnos,
          total: turnos * valor,
        };
      })
      .filter((p) => p.turnos > 0);
  }, [turnosProfes, profes, valorTurno]);

  const totalSueldos = useMemo(
    () => detalleSueldos.reduce((acc, s) => acc + Number(s.total || 0), 0),
    [detalleSueldos]
  );

  const totalGastosFijos = useMemo(
    () =>
      (Array.isArray(gastosFijos) ? gastosFijos : []).reduce((acc, g) => {
        const base = Number(g.monto || 0);
        const val = (g.frecuencia || "").toLowerCase() === "semanal" ? base * 4 : base;
        return acc + val;
      }, 0),
    [gastosFijos]
  );

  const gastosFijosAgrupados = useMemo(() => {
    const mapa = {};
    (Array.isArray(gastosFijos) ? gastosFijos : []).forEach((g) => {
      const key = (g.categoria || "Sin categoria").trim();
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(g);
    });
    return mapa;
  }, [gastosFijos]);

  const totales = useMemo(() => {
    const porCategoria = {};
    let total = 0;
    (Array.isArray(gastos) ? gastos : []).forEach((g) => {
      if ((g.categoria || "").toLowerCase() === "sueldos") return;
      const cat = g.categoria || "Sin categoria";
      const val = Number(g.monto || 0);
      porCategoria[cat] = (porCategoria[cat] || 0) + val;
      total += val;
    });
    if (totalSueldos > 0) {
      porCategoria.Sueldos = (porCategoria.Sueldos || 0) + totalSueldos;
      total += totalSueldos;
    }
    if (totalGastosFijos > 0) {
      porCategoria["Gastos fijos"] = (porCategoria["Gastos fijos"] || 0) + totalGastosFijos;
      total += totalGastosFijos;
    }
    return { porCategoria, total };
  }, [gastos, totalSueldos, totalGastosFijos]);

  const otrosGastos = useMemo(
    () =>
      (Array.isArray(gastos) ? gastos : []).filter(
        (g) => (g.categoria || "").toLowerCase() !== "sueldos"
      ),
    [gastos]
  );


  const agregarGasto = async (e) => {
    e.preventDefault();
    if (!url || !headers?.apikey) return;
    if (!categoria || !concepto || !monto) return;
    const res = await fetch(`${url}/rest/v1/gastos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        mes,
        categoria,
        concepto,
        monto: Number(monto),
        creado_en: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      setConcepto("");
      setMonto("");
      cargarGastos();
    } else {
      const txt = await res.text();
      setErrorGastos(txt || "No pude guardar gasto");
    }
  };


  const actualizarGasto = async (id, cambios) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/gastos?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(cambios),
    });
    if (res.ok) {
      cargarGastos();
    } else {
      const txt = await res.text();
      setErrorGastos(txt || "No pude actualizar gasto");
    }
  };

  const eliminarGasto = async (id) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/gastos?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setEditingGastoId((prev) => (String(prev) === String(id) ? null : prev));
      setGastoDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      cargarGastos();
    } else {
      const txt = await res.text();
      setErrorGastos(txt || "No pude eliminar gasto");
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-semibold mb-1">Mes</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-xl p-3 bg-white">
          <div className="text-xs text-gray-600">Ingresos hipoteticos</div>
          <div className="text-lg font-semibold">
            ${Number(ingresos.hipotetico || 0).toLocaleString("es-AR")}
          </div>
          <div className="text-xs text-gray-500">
            Normal {ingresos.activosNormal} · Promo {ingresos.activosPromo}
          </div>
        </div>
        <div className="border rounded-xl p-3 bg-white">
          <div className="text-xs text-gray-600">Ingresos reales</div>
          <div className="text-lg font-semibold">
            ${Number(ingresos.real || 0).toLocaleString("es-AR")}
          </div>
          <div className="text-xs text-gray-500">
            Valor promedio ${Number(ingresos.cuotaBase || 0).toLocaleString("es-AR")} · Promo {ingresos.promoPct}%
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Detalle del mes</div>
        {errorGastos && <div className="text-sm text-red-600">{errorGastos}</div>}
        {cargando ? (
          <div className="text-sm text-gray-500">Cargando...</div>
        ) : gastos.length === 0 ? (
          <div className="text-sm text-gray-500">Sin gastos cargados.</div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600">Sueldos</div>
              {detalleSueldos.length === 0 ? (
                <div className="text-xs text-gray-500">No hay turnos asignados.</div>
              ) : (
                <div className="border rounded-lg p-3">
                  <div className="space-y-2">
                    {detalleSueldos.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">{s.nombre}</div>
                        <div className="text-sm font-semibold">
                          ${Number(s.total || 0).toLocaleString("es-AR")}
                        </div>
                        <div className="text-xs text-gray-500 w-full">
                          {s.turnos} turno(s)
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm font-semibold">
                    <span>Total sueldos</span>
                    <span>${Number(totalSueldos || 0).toLocaleString("es-AR")}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600">Gastos fijos</div>
              {gastosFijos.length === 0 ? (
                <div className="text-xs text-gray-500">No hay gastos fijos activos.</div>
              ) : (
                <div className="border rounded-lg p-3">
                  <div className="space-y-2">
                    {Object.entries(gastosFijosAgrupados).map(([categoriaKey, items]) => {
                      const totalConcepto = items.reduce((acc, item) => {
                        const base = Number(item.monto || 0);
                        return acc + ((item.frecuencia || "").toLowerCase() === "semanal" ? base * 4 : base);
                      }, 0);
                      return (
                        <div key={categoriaKey} className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {categoriaKey}
                          </div>
                          <div className="text-sm font-semibold">
                            ${Number(totalConcepto || 0).toLocaleString("es-AR")}
                          </div>
                          <div className="text-xs text-gray-500 w-full">
                            {items.length} item(s)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm font-semibold">
                    <span>Total gastos fijos</span>
                    <span>${Number(totalGastosFijos || 0).toLocaleString("es-AR")}</span>
                  </div>
                </div>
              )}
            </div>
            {otrosGastos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-600">Otros gastos</div>
                {Object.entries(
                  otrosGastos.reduce((acc, g) => {
                    const key = (g.concepto || "Sin concepto").trim();
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(g);
                    return acc;
                  }, {})
                ).map(([conceptoKey, items]) => {
                  const totalConcepto = items.reduce((acc, item) => acc + Number(item.monto || 0), 0);
                  return (
                    <div key={conceptoKey} className="border rounded-lg p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">{conceptoKey}</div>
                        <div className="text-sm font-semibold">
                          ${Number(totalConcepto || 0).toLocaleString("es-AR")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {items.map((g) => (
                          <div key={g.id || `${g.concepto}-${g.monto}`} className="border rounded-md p-2 bg-white">
                            {String(editingGastoId) === String(g.id) ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <input
                                    className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                                    value={gastoDrafts[g.id]?.concepto ?? ""}
                                    onChange={(e) =>
                                      setGastoDrafts((prev) => ({
                                        ...prev,
                                        [g.id]: { ...prev[g.id], concepto: e.target.value },
                                      }))
                                    }
                                    placeholder="Concepto"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                                    value={gastoDrafts[g.id]?.monto ?? ""}
                                    onChange={(e) =>
                                      setGastoDrafts((prev) => ({
                                        ...prev,
                                        [g.id]: { ...prev[g.id], monto: e.target.value },
                                      }))
                                    }
                                    placeholder="Monto"
                                  />
                                  <select
                                    className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                                    value={gastoDrafts[g.id]?.categoria ?? ""}
                                    onChange={(e) =>
                                      setGastoDrafts((prev) => ({
                                        ...prev,
                                        [g.id]: { ...prev[g.id], categoria: e.target.value },
                                      }))
                                    }
                                  >
                                    {categorias.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-1 whitespace-nowrap justify-end">
                                  <button
                                    type="button"
                                    className="border rounded px-2 py-1 text-[11px] leading-4 text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      const draft = gastoDrafts[g.id] || {};
                                      actualizarGasto(g.id, {
                                        concepto: (draft.concepto || "").trim(),
                                        categoria: draft.categoria || g.categoria || "Sin categoria",
                                        monto:
                                          draft.monto === "" || draft.monto == null
                                            ? null
                                            : Number(draft.monto),
                                      });
                                      setEditingGastoId(null);
                                    }}
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                                    onClick={() => setEditingGastoId(null)}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                                    onClick={() => eliminarGasto(g.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs text-gray-600">
                                    {g.categoria || "Sin categoria"}
                                    {g.sede ? ` | ${g.sede}` : ""}
                                  </div>
                                  <div className="text-sm font-semibold">
                                    ${Number(g.monto || 0).toLocaleString("es-AR")}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 whitespace-nowrap mt-2 justify-end">
                                  <button
                                    type="button"
                                    className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                                    onClick={() => {
                                      setEditingGastoId(g.id);
                                      setGastoDrafts((prev) => ({
                                        ...prev,
                                        [g.id]: {
                                          concepto: g.concepto || "",
                                          monto: g.monto ?? "",
                                          categoria: g.categoria || categorias[0],
                                        },
                                      }));
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                                    onClick={() => eliminarGasto(g.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border rounded-xl p-4">
        <div className="text-sm font-semibold mb-2">Totales</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {Object.entries(totales.porCategoria).map(([cat, val]) => (
            <div key={cat} className="flex items-center justify-between border rounded px-3 py-2">
              <span>{cat}</span>
              <span className="font-semibold">${Number(val).toLocaleString("es-AR")}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border rounded px-3 py-2 bg-gray-50">
            <span>Total</span>
            <span className="font-semibold">${Number(totales.total).toLocaleString("es-AR")}</span>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-white">
        <div className="text-xs text-gray-600">Balance</div>
        <div className="text-2xl font-semibold">
          ${Number((ingresos.real || 0) - (totales.total || 0)).toLocaleString("es-AR")}
        </div>
        <div className="text-xs text-gray-500">Ingresos reales - Gastos</div>
      </div>
    </div>
  );
}

// ---------------------- Panel: Asignacion de Profes ----------------------
function PanelAsignacionProfes() {
  const { url, headers, loading, error } = useSupabaseConfig();
  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");
  const [sedeSel, setSedeSel] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [profes, setProfes] = useState([]);
  const [editingProfeId, setEditingProfeId] = useState(null);
  const [profeDrafts, setProfeDrafts] = useState({});
  const [nuevoProfeNombre, setNuevoProfeNombre] = useState("");
  const [nuevoProfeTarifa, setNuevoProfeTarifa] = useState("");
  const [asignaciones, setAsignaciones] = useState({});
  const [asignacionesDb, setAsignacionesDb] = useState([]);
  const [valorTurno, setValorTurno] = useState(45000);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorAsign, setErrorAsign] = useState("");

  const sedes = ["Calle Mendoza", "Fisherton"];

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/ciclos?select=codigo,nombre_publico,orden&order=orden.asc`, { headers });
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setCiclos(lista);
        if (!cicloSel && lista.length) setCicloSel(lista[0].codigo);
      } catch {
        setCiclos([]);
      }
    })();
  }, [url, headers]);

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/profes?select=id,nombre,tarifa_turno&order=nombre.asc`, { headers });
        const data = await res.json();
        setProfes(Array.isArray(data) ? data : []);
      } catch {
        setProfes([]);
      }
    })();
  }, [url, headers]);

  const agregarProfe = async () => {
    if (!url || !headers?.apikey) return;
    const nombre = nuevoProfeNombre.trim();
    const tarifa = nuevoProfeTarifa ? Number(nuevoProfeTarifa) : null;
    if (!nombre) return;
    const res = await fetch(`${url}/rest/v1/profes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ nombre, tarifa_turno: tarifa }),
    });
    if (res.ok) {
      setNuevoProfeNombre("");
      setNuevoProfeTarifa("");
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setProfes((prev) => [...prev, data[0]]);
      } else {
        const ref = await fetch(`${url}/rest/v1/profes?select=id,nombre,tarifa_turno&order=nombre.asc`, { headers });
        const refrescado = await ref.json();
        setProfes(Array.isArray(refrescado) ? refrescado : []);
      }
    }
  };

  const actualizarProfe = async (id, cambios) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/profes?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(cambios),
    });
    if (res.ok) {
      setProfes((prev) =>
        prev.map((p) => (String(p.id) === String(id) ? { ...p, ...cambios } : p))
      );
    }
  };

  const eliminarProfe = async (id) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/profes?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setProfes((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setEditingProfeId((prev) => (String(prev) === String(id) ? null : prev));
      setProfeDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  useEffect(() => {
    if (!url || !headers?.apikey || !cicloSel) return;
    (async () => {
      try {
        const res = await fetch(
          `${url}/rest/v1/cursos?select=precio_curso,nombre&ciclo=eq.${encodeURIComponent(cicloSel)}&nombre=ilike.*basica*&limit=1`,
          { headers }
        );
        const data = await res.json();
        const val = data?.[0]?.precio_curso;
        if (val != null && !Number.isNaN(Number(val))) {
          setValorTurno(Number(val));
        } else {
          setValorTurno(45000);
        }
      } catch {
        setValorTurno(45000);
      }
    })();
  }, [url, headers, cicloSel]);

  useEffect(() => {
    if (!url || !headers?.apikey || !cicloSel || !sedeSel) {
      setTurnos([]);
      setAsignaciones({});
      setAsignacionesDb([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${url}/rest/v1/turnos?select=dia,hora&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
            `&sede=eq.${encodeURIComponent(sedeSel)}&activo=eq.true`,
          { headers }
        );
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        const orden = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
        const normalizarDia = (v) =>
          String(v || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        lista.sort((a, b) => {
          const da = orden[normalizarDia(a.dia)] ?? 99;
          const db = orden[normalizarDia(b.dia)] ?? 99;
          if (da != db) return da - db;
          return String(a.hora || "").localeCompare(String(b.hora || ""));
        });
        setTurnos(lista);
      } catch {
        setTurnos([]);
      }
    })();
  }, [url, headers, cicloSel, sedeSel]);

  useEffect(() => {
    if (!url || !headers?.apikey || !cicloSel || !sedeSel) return;
    setErrorAsign("");
    (async () => {
      try {
        const res = await fetch(
          `${url}/rest/v1/turnos_profes?select=id,profe_id,dia,hora,ciclo_codigo,sede` +
            `&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
            `&sede=eq.${encodeURIComponent(sedeSel)}`,
          { headers }
        );
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "No pude cargar asignaciones");
        }
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setAsignacionesDb(lista);
        const map = {};
        lista.forEach((r) => {
          const key = `${r.dia}||${r.hora}`;
          if (!map[key]) map[key] = new Set();
          if (r.profe_id) map[key].add(r.profe_id);
        });
        const normalizado = {};
        Object.entries(map).forEach(([key, set]) => {
          normalizado[key] = Array.from(set);
        });
        setAsignaciones(normalizado);
      } catch (e) {
        setAsignacionesDb([]);
        setAsignaciones({});
        setErrorAsign(e.message || "No pude cargar asignaciones");
      }
    })();
  }, [url, headers, cicloSel, sedeSel]);

  const toggleProfe = (turnoKey, profeId) => {
    setAsignaciones((prev) => {
      const set = new Set(prev[turnoKey] || []);
      if (set.has(profeId)) set.delete(profeId); else set.add(profeId);
      return { ...prev, [turnoKey]: Array.from(set) };
    });
  };

  const guardarAsignaciones = async () => {
    if (!url || !headers?.apikey || !cicloSel || !sedeSel) return;
    setGuardando(true);
    setMensaje("");
    setErrorAsign("");

    const existentes = new Map();
    asignacionesDb.forEach((r) => {
      const key = `${r.dia}||${r.hora}||${r.profe_id}`;
      existentes.set(key, r.id);
    });

    const actuales = new Set();
    Object.entries(asignaciones).forEach(([turnoKey, lista]) => {
      (lista || []).forEach((profeId) => {
        actuales.add(`${turnoKey}||${profeId}`);
      });
    });

    const inserts = [];
    actuales.forEach((key) => {
      if (!existentes.has(key)) {
        const [dia, hora, profeId] = key.split("||");
        inserts.push({
          ciclo_codigo: cicloSel,
          sede: sedeSel,
          dia,
          hora,
          profe_id: profeId,
        });
      }
    });

    const deleteIds = [];
    existentes.forEach((id, key) => {
      if (!actuales.has(key)) deleteIds.push(id);
    });

    try {
      if (inserts.length > 0) {
        const res = await fetch(`${url}/rest/v1/turnos_profes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(inserts),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "No pude guardar asignaciones");
        }
      }
      if (deleteIds.length > 0) {
        const res = await fetch(`${url}/rest/v1/turnos_profes?id=in.(${deleteIds.join(",")})`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "No pude eliminar asignaciones");
        }
      }
      setMensaje("Asignaciones guardadas.");
    } catch (e) {
      setErrorAsign(e.message || "No pude guardar asignaciones");
    } finally {
      setGuardando(false);
    }
  };

  const sueldosEstimados = useMemo(() => {
    const conteo = new Map();
    Object.values(asignaciones).forEach((lista) => {
      const unicos = new Set(lista || []);
      unicos.forEach((profeId) => {
        conteo.set(profeId, (conteo.get(profeId) || 0) + 1);
      });
    });
    return profes
      .map((p) => {
        const turnosTrab = conteo.get(p.id) || 0;
        const tarifa = Number(p.tarifa_turno);
        const valor = Number.isFinite(tarifa) ? tarifa : Number(valorTurno || 0);
        return {
          id: p.id,
          nombre: p.nombre,
          turnos: turnosTrab,
          total: turnosTrab * valor,
        };
      })
      .filter((p) => p.turnos > 0);
  }, [asignaciones, profes, valorTurno]);

  const turnosPorDia = useMemo(() => {
    const orden = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
    const normalizarDia = (v) =>
      String(v || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const grupos = {};
    (turnos || []).forEach((t) => {
      const key = normalizarDia(t.dia);
      if (!grupos[key]) grupos[key] = { dia: t.dia, items: [] };
      grupos[key].items.push(t);
    });
    return Object.values(grupos)
      .map((g) => ({
        ...g,
        items: g.items.slice().sort((a, b) => String(a.hora || "").localeCompare(String(b.hora || ""))),
      }))
      .sort((a, b) => {
        const da = orden[normalizarDia(a.dia)] ?? 99;
        const db = orden[normalizarDia(b.dia)] ?? 99;
        return da - db;
      });
  }, [turnos]);

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Ciclo</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={cicloSel}
            onChange={(e) => setCicloSel(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {ciclos.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nombre_publico || c.codigo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Sede</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={sedeSel}
            onChange={(e) => setSedeSel(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {sedes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Valor por turno</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2 text-sm"
            value={valorTurno}
            onChange={(e) => setValorTurno(e.target.value)}
            min="0"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="border rounded px-3 py-2 text-sm hover:bg-gray-100 w-full"
            onClick={guardarAsignaciones}
            disabled={guardando || !cicloSel || !sedeSel}
          >
            {guardando ? "Guardando..." : "Guardar asignaciones"}
          </button>
        </div>
      </div>

      {(errorAsign || mensaje) && (
        <div className={`text-sm ${errorAsign ? "text-red-600" : "text-emerald-700"}`}>
          {errorAsign || mensaje}
        </div>
      )}

      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Asignacion por turno</div>
        {turnos.length === 0 ? (
          <div className="text-xs text-gray-500">Selecciona ciclo y sede para ver turnos.</div>
        ) : (
          <div className="space-y-3">
            {turnosPorDia.map((grupo) => (
              <div key={grupo.dia} className="border rounded-lg p-3 space-y-2">
                <div className="text-sm font-semibold">{grupo.dia}</div>
                <div className="space-y-2">
                  {grupo.items.map((t) => {
                    const key = `${t.dia}||${t.hora}`;
                    const seleccion = new Set(asignaciones[key] || []);
                    return (
                      <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 border rounded-md p-2 bg-white">
                        <div className="text-xs font-semibold min-w-[90px]">{t.hora}</div>
                        <div className="flex flex-wrap gap-2">
                          {profes.length === 0 ? (
                            <span className="text-xs text-gray-500">Agrega profes para asignar.</span>
                          ) : (
                            profes.map((p) => (
                              <label key={p.id} className="inline-flex items-center gap-2 text-xs border rounded px-2 py-1 bg-white">
                                <input
                                  type="checkbox"
                                  checked={seleccion.has(p.id)}
                                  onChange={() => toggleProfe(key, p.id)}
                                />
                                <span>{p.nombre}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Profes (tarifa por turno)</div>
        <div className="space-y-2">
          {profes.map((p) => (
            <div
              key={p.id}
              className="flex flex-col md:flex-row md:items-center gap-2 border rounded-lg px-2 py-1 text-xs bg-gray-50"
            >
              {String(editingProfeId) === String(p.id) ? (
                <>
                  <input
                    className="flex-1 md:flex-[2] md:min-w-[240px] border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                    value={profeDrafts[p.id]?.nombre ?? ""}
                    onChange={(e) =>
                      setProfeDrafts((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], nombre: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    className="w-full md:w-44 border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                    value={profeDrafts[p.id]?.tarifa_turno ?? ""}
                    onChange={(e) =>
                      setProfeDrafts((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], tarifa_turno: e.target.value },
                      }))
                    }
                  />
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <button
                      type="button"
                      className="border rounded px-2 py-1 text-[11px] leading-4 text-green-700 hover:bg-green-50"
                      onClick={() => {
                        const draft = profeDrafts[p.id] || {};
                        actualizarProfe(p.id, {
                          nombre: (draft.nombre || "").trim(),
                          tarifa_turno:
                            draft.tarifa_turno === "" || draft.tarifa_turno == null
                              ? null
                              : Number(draft.tarifa_turno),
                        });
                        setEditingProfeId(null);
                      }}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                      onClick={() => setEditingProfeId(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                      onClick={() => eliminarProfe(p.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 md:flex-[2] md:min-w-[240px] text-xs text-gray-800 px-1">
                    {p.nombre || "(sin nombre)"}
                  </div>
                  <div className="w-full md:w-44 text-xs text-gray-700 px-1">
                    ${Number(p.tarifa_turno || 0).toLocaleString("es-AR")}
                  </div>
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <button
                      type="button"
                      className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                      onClick={() => {
                        setEditingProfeId(p.id);
                        setProfeDrafts((prev) => ({
                          ...prev,
                          [p.id]: {
                            nombre: p.nombre || "",
                            tarifa_turno: p.tarifa_turno ?? "",
                          },
                        }));
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                      onClick={() => eliminarProfe(p.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Nombre del profe"
            value={nuevoProfeNombre}
            onChange={(e) => setNuevoProfeNombre(e.target.value)}
          />
          <input
            type="number"
            min="0"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Tarifa por turno"
            value={nuevoProfeTarifa}
            onChange={(e) => setNuevoProfeTarifa(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="border rounded px-3 py-2 text-sm hover:bg-gray-100"
          onClick={agregarProfe}
        >
          + Agregar profe
        </button>
      </div>

      <div className="border rounded-xl p-4 space-y-2">
        <div className="text-sm font-semibold">Sueldos estimados</div>
        {sueldosEstimados.length === 0 ? (
          <div className="text-xs text-gray-500">No hay turnos asignados.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sueldosEstimados.map((s) => (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{s.nombre}</div>
                  <div className="text-sm font-semibold">${Number(s.total || 0).toLocaleString("es-AR")}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{s.turnos} turno(s)</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------- Panel: Gastos Fijos -----------------------
function PanelGastosFijos() {
  const { url, headers, loading, error } = useSupabaseConfig();
  const [gastosFijos, setGastosFijos] = useState([]);
  const [categoria, setCategoria] = useState("Impuestos");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [sede, setSede] = useState("Calle Mendoza");
  const [activo, setActivo] = useState(true);
  const [editId, setEditId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [errorFijos, setErrorFijos] = useState("");
  const [guardando, setGuardando] = useState(false);

  const categorias = ["Impuestos", "Servicios", "Alquiler", "Limpieza", "Otros"];
  const sedes = ["Calle Mendoza", "Fisherton"];

  const cargar = async () => {
    if (!url || !headers?.apikey) return;
    try {
      const res = await fetch(
        `${url}/rest/v1/gastos_fijos?select=id,categoria,concepto,monto,frecuencia,sede,activo&order=concepto.asc`,
        { headers }
      );
      const data = await res.json();
      setGastosFijos(Array.isArray(data) ? data : []);
    } catch {
      setGastosFijos([]);
    }
  };

  useEffect(() => {
    if (!url || !headers?.apikey) return;
    cargar();
  }, [url, headers]);

  const agregar = async (e) => {
    e.preventDefault();
    if (!url || !headers?.apikey) return;
    if (!concepto || !monto) return;
    setGuardando(true);
    setErrorFijos("");
    const res = await fetch(`${url}/rest/v1/gastos_fijos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        categoria,
        concepto: concepto.trim(),
        monto: Number(monto),
        frecuencia,
        sede,
        activo,
      }),
    });
    if (res.ok) {
      setConcepto("");
      setMonto("");
      setActivo(true);
      cargar();
    } else {
      const txt = await res.text();
      setErrorFijos(txt || "No pude guardar gasto fijo");
    }
    setGuardando(false);
  };

  const actualizar = async (id, cambios) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/gastos_fijos?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(cambios),
    });
    if (res.ok) {
      cargar();
    } else {
      const txt = await res.text();
      setErrorFijos(txt || "No pude actualizar gasto fijo");
    }
  };

  const eliminar = async (id) => {
    if (!url || !headers?.apikey) return;
    const res = await fetch(`${url}/rest/v1/gastos_fijos?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setEditId((prev) => (String(prev) === String(id) ? null : prev));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      cargar();
    } else {
      const txt = await res.text();
      setErrorFijos(txt || "No pude eliminar gasto fijo");
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={agregar} className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Agregar gasto fijo</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Categoria</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Concepto</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Alquiler local"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Monto</label>
            <input
              type="number"
              min="0"
              className="w-full border rounded px-3 py-2 text-sm"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Frecuencia</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={frecuencia}
              onChange={(e) => setFrecuencia(e.target.value)}
            >
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Sede</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
            >
              {sedes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Activo
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="border rounded px-3 py-2 text-sm hover:bg-gray-100"
          disabled={guardando}
        >
          {guardando ? "Guardando..." : "Guardar gasto fijo"}
        </button>
        {errorFijos && <div className="text-sm text-red-600">{errorFijos}</div>}
      </form>

      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Gastos fijos</div>
        {gastosFijos.length === 0 ? (
          <div className="text-sm text-gray-500">Sin gastos fijos cargados.</div>
        ) : (
          <div className="space-y-2">
            {gastosFijos
              .slice()
              .sort((a, b) => {
                const orden = { "Calle Mendoza": 0, Fisherton: 1 };
                const oa = orden[a.sede] ?? 99;
                const ob = orden[b.sede] ?? 99;
                if (oa !== ob) return oa - ob;
                return String(a.concepto || "").localeCompare(String(b.concepto || ""));
              })
              .map((g) => {
                const sedeClase =
                  g.sede === "Fisherton"
                    ? "bg-blue-50 border-blue-100"
                    : "bg-emerald-50 border-emerald-100";
                return (
              <div key={g.id} className={`border rounded-lg p-3 ${sedeClase}`}>
                {String(editId) === String(g.id) ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                        value={drafts[g.id]?.concepto ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [g.id]: { ...prev[g.id], concepto: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                        value={drafts[g.id]?.monto ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [g.id]: { ...prev[g.id], monto: e.target.value },
                          }))
                        }
                      />
                      <select
                        className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                        value={drafts[g.id]?.categoria ?? g.categoria}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [g.id]: { ...prev[g.id], categoria: e.target.value },
                          }))
                        }
                      >
                        {categorias.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                        value={drafts[g.id]?.frecuencia ?? g.frecuencia}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [g.id]: { ...prev[g.id], frecuencia: e.target.value },
                          }))
                        }
                      >
                        <option value="mensual">Mensual</option>
                        <option value="semanal">Semanal</option>
                      </select>
                      <select
                        className="border rounded px-2 py-1 text-xs text-gray-800 bg-white"
                        value={drafts[g.id]?.sede ?? g.sede}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [g.id]: { ...prev[g.id], sede: e.target.value },
                          }))
                        }
                      >
                        {sedes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={drafts[g.id]?.activo ?? g.activo}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [g.id]: { ...prev[g.id], activo: e.target.checked },
                            }))
                          }
                        />
                        Activo
                      </label>
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap justify-end">
                      <button
                        type="button"
                        className="border rounded px-2 py-1 text-[11px] leading-4 text-green-700 hover:bg-green-50"
                        onClick={() => {
                          const draft = drafts[g.id] || {};
                          actualizar(g.id, {
                            concepto: (draft.concepto ?? g.concepto).trim(),
                            monto:
                              draft.monto === "" || draft.monto == null
                                ? Number(g.monto || 0)
                                : Number(draft.monto),
                            categoria: draft.categoria ?? g.categoria,
                            frecuencia: draft.frecuencia ?? g.frecuencia,
                            sede: draft.sede ?? g.sede,
                            activo: draft.activo ?? g.activo,
                          });
                          setEditId(null);
                        }}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                        onClick={() => setEditId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                        onClick={() => eliminar(g.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{g.concepto}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {g.categoria} | {g.frecuencia} | {g.sede} {g.activo ? "" : "| Inactivo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                      <div className="text-sm font-semibold">
                        ${Number(g.monto || 0).toLocaleString("es-AR")}
                      </div>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <button
                          type="button"
                          className="border rounded px-2 py-1 text-[11px] leading-4 hover:bg-gray-100"
                          onClick={() => {
                            setEditId(g.id);
                            setDrafts((prev) => ({
                              ...prev,
                              [g.id]: {
                                concepto: g.concepto || "",
                                monto: g.monto ?? "",
                                categoria: g.categoria,
                                frecuencia: g.frecuencia,
                                sede: g.sede,
                                activo: g.activo,
                              },
                            }));
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="border rounded px-2 py-1 text-[11px] leading-4 text-red-600 hover:bg-red-50"
                          onClick={() => eliminar(g.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
