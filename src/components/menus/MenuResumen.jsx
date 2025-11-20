import { useEffect, useMemo, useState } from "react";
import { FaCalendarDay, FaCalendarAlt, FaChartPie,FaCheckCircle, FaExclamationCircle, FaUserPlus, FaUsers,FaFileSignature, FaUserMinus, FaDollarSign, FaInfoCircle } from "react-icons/fa";


export default function FichaResumenes() {
  const [tab, setTab] = useState("diario");

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6">Resumenes & Control</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
        {tab === "diario" && <PanelDiario />}
        {tab === "mensual" && <PanelMensual />}
        {tab === "gastos" && <PanelGastos />}
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
      className={`flex items-center gap-2 justify-center rounded-xl py-3 px-4 border-l-8 bg-white shadow-sm hover:bg-green-300 transition ${
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
    faltantesNormales: 0
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

      // 2) Activos + bandera de promo
      const activosRes = await fetch(
        `${url}/rest/v1/inscripciones?select=id,activo,creado_en,tiene_promo&activo=eq.true`,
        { headers }
      );
      const activos = await activosRes.json();
      const activosIds = new Set(activos.map((a) => a.id));
      const promoIds = new Set(activos.filter(a => a.tiene_promo === true).map(a => a.id));
      const promoMap = new Map(activos.map((a) => [a.id, !!a.tiene_promo]));

      // Filtrar pagos a sólo activos
      const pagosActivos = pagosMensuales.filter((p) => activosIds.has(p.alumno_id));

      const monto = pagosActivos.reduce((acc, p) => acc + (Number(p.monto_total) || 0), 0);
      const cantidadAlumnosQuePagaron = new Set(pagosActivos.map((p) => p.alumno_id)).size;
      const faltantes = Math.max(0, activosIds.size - cantidadAlumnosQuePagaron);

      // Split de faltantes usando el estado de la inscripción (tiene_promo)
      const pagaronSet = new Set(pagosActivos.map(p => p.alumno_id));
      const faltantesIds = [...activosIds].filter(id => !pagaronSet.has(id));

      const faltantesPromo = faltantesIds.filter(id => promoIds.has(id)).length;
      const faltantesNormales = Math.max(0, faltantes - faltantesPromo);

      // Desglose: antes / promo / normal
      const pagosAntes = pagosActivos.filter((p) => p.pago_antes === true).length;
      const pagosPromo = pagosActivos.filter((p) => promoMap.get(p.alumno_id) === true).length;
      const pagosNormal = Math.max(0, cantidadAlumnosQuePagaron - pagosPromo);

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
    </div>
  );
}

// --------------------------- Panel: Gastos (MVP) --------------------------
function PanelGastos() {
  return (
    <div className="space-y-3">
      <p className="text-gray-700">
        En esta sección vamos a armar un tablero de <strong>gastos mensuales</strong> con categorías, totales y evolución.
      </p>
      <ul className="list-disc pl-5 text-gray-700">
        <li>Entrada de datos por mes y por categoría (Fijo, Variable, Servicios, etc.).</li>
        <li>Tabla resumen y gráfico de evolución (línea/barras).</li>
        <li>Indicadores: gasto total, variación vs. mes anterior, % por categoría.</li>
      </ul>
      <p className="text-gray-500 text-sm">Placeholder inicial — lo completamos en el próximo paso.</p>
    </div>
  );
}
