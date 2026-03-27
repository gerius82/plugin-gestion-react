import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ORDEN_DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const normalizarTexto = (valor = "") =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const inicioHorario = (valor = "") => {
  const match = String(valor || "").match(/(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, "0") : String(valor || "");
};

const nombreDiaDesdeFecha = (fechaISO) => {
  const date = new Date(`${fechaISO}T00:00:00`);
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][date.getDay()] || "";
};

const toISODate = (year, monthIndex, day) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const parseMonth = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, monthIndex: m - 1 };
};

const fechasDelMes = (ym) => {
  const info = parseMonth(ym);
  if (!info) return [];
  const { year, monthIndex } = info;
  const ultimoDia = new Date(year, monthIndex + 1, 0).getDate();
  const dias = [];
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const fechaISO = toISODate(year, monthIndex, dia);
    dias.push({
      fechaISO,
      diaNumero: dia,
      diaSemana: nombreDiaDesdeFecha(fechaISO),
    });
  }
  return dias;
};

const formatearFecha = (fechaISO) => {
  const [y, m, d] = String(fechaISO || "").split("-");
  if (!y || !m || !d) return fechaISO || "";
  return `${d}-${m}-${y}`;
};

const claseEstado = {
  tomada: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  pendiente: "bg-sky-100 text-sky-800 border border-sky-200",
  feriado: "bg-amber-100 text-amber-800 border border-amber-200",
  sin_alumnos: "bg-gray-100 text-gray-700 border border-gray-200",
  sin_registrar: "bg-rose-100 text-rose-800 border border-rose-200",
};

const textoEstado = {
  tomada: "Tomada",
  pendiente: "Pendiente",
  feriado: "Feriado",
  sin_alumnos: "Sin alumnos",
  sin_registrar: "Sin registrar",
};

export default function FichaControlAsistenciaMensual() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");
  const [mesSel, setMesSel] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [sedeSel, setSedeSel] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const headers = useMemo(() => {
    if (!config) return {};
    return {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };
  }, [config]);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No se pudo cargar la configuracion."));
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
          { headers }
        );
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setCiclos(lista);
        if (!cicloSel && lista.length > 0) {
          const ciclo2026 = lista.find((c) => c.codigo === "CICLO_2026");
          const activo = lista.find((c) => c.activo);
          setCicloSel((ciclo2026 || activo || lista[0]).codigo);
        }
      } catch {
        setError("No se pudieron cargar los ciclos.");
      }
    })();
  }, [config, headers, cicloSel]);

  useEffect(() => {
    if (!config || !cicloSel) return;
    const info = parseMonth(mesSel);
    if (!info) return;
    const { year, monthIndex } = info;
    const desde = toISODate(year, monthIndex, 1);
    const hasta = toISODate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate());

    (async () => {
      setLoading(true);
      setError("");
      try {
        const turnoUrl = `${config.supabaseUrl}/rest/v1/turnos?select=id,sede,dia,hora,activo,ciclo_codigo&ciclo_codigo=eq.${encodeURIComponent(
          cicloSel
        )}&activo=eq.true&order=sede.asc,dia.asc,hora.asc`;

        const matriculasUrl = `${config.supabaseUrl}/rest/v1/matriculas?select=id,sede,dia,hora,estado,ciclo_codigo,lista_espera&ciclo_codigo=eq.${encodeURIComponent(
          cicloSel
        )}&estado=eq.activa&lista_espera=eq.false`;

        const asistenciasUrl = `${config.supabaseUrl}/rest/v1/asistencias?select=fecha,turno,sede,tipo&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`;

        const feriadosUrl = `${config.supabaseUrl}/rest/v1/feriados?select=fecha,descripcion&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`;

        const [turnosRes, matriculasRes, asistenciasRes, feriadosRes] = await Promise.all([
          fetch(turnoUrl, { headers }),
          fetch(matriculasUrl, { headers }),
          fetch(asistenciasUrl, { headers }),
          fetch(feriadosUrl, { headers }),
        ]);

        const [turnosData, matriculasData, asistenciasData, feriadosData] = await Promise.all([
          turnosRes.json(),
          matriculasRes.json(),
          asistenciasRes.json(),
          feriadosRes.json(),
        ]);

        setTurnos(Array.isArray(turnosData) ? turnosData : []);
        setMatriculas(Array.isArray(matriculasData) ? matriculasData : []);
        setAsistencias(Array.isArray(asistenciasData) ? asistenciasData : []);
        setFeriados(Array.isArray(feriadosData) ? feriadosData : []);
      } catch {
        setError("No se pudo cargar el control de asistencias.");
      } finally {
        setLoading(false);
      }
    })();
  }, [config, headers, cicloSel, mesSel]);

  const sedesDisponibles = useMemo(() => {
    return [...new Set(turnos.map((turno) => turno.sede).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [turnos]);

  const mapaFeriados = useMemo(() => {
    const map = new Map();
    feriados.forEach((feriado) => {
      const fecha = String(feriado.fecha || "").split("T")[0];
      if (fecha) map.set(fecha, feriado);
    });
    return map;
  }, [feriados]);

  const mapaMatriculasPorTurno = useMemo(() => {
    const map = new Map();
    matriculas.forEach((m) => {
      const key = [m.sede, normalizarTexto(m.dia), m.hora].join("|");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [matriculas]);

  const mapaAsistencias = useMemo(() => {
    const map = new Map();
    asistencias.forEach((a) => {
      const key = [String(a.fecha || "").split("T")[0], a.sede, a.turno].join("|");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [asistencias]);

  const registros = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechasDelMes(mesSel)
      .map((fecha) => {
        const turnosDelDia = turnos
          .filter((turno) => {
            const mismaSede = !sedeSel || turno.sede === sedeSel;
            return mismaSede && normalizarTexto(turno.dia) === fecha.diaSemana;
          })
          .sort((a, b) => {
            const sedeCmp = String(a.sede || "").localeCompare(String(b.sede || ""));
            if (sedeCmp !== 0) return sedeCmp;
            const diaCmp =
              ORDEN_DIAS.indexOf(normalizarTexto(a.dia)) - ORDEN_DIAS.indexOf(normalizarTexto(b.dia));
            if (diaCmp !== 0) return diaCmp;
            return inicioHorario(a.hora).localeCompare(inicioHorario(b.hora));
          })
          .map((turno) => {
            const keyTurno = [turno.sede, normalizarTexto(turno.dia), turno.hora].join("|");
            const keyAsistencia = [fecha.fechaISO, turno.sede, `${turno.dia} ${turno.hora}`].join("|");
            const cantidadAlumnos = mapaMatriculasPorTurno.get(keyTurno) || 0;
            const cantidadAsistencias = mapaAsistencias.get(keyAsistencia) || 0;
            const esFeriado = mapaFeriados.has(fecha.fechaISO);
            const esFuturo = new Date(`${fecha.fechaISO}T00:00:00`) > hoy;

            let estado = "sin_registrar";
            if (esFeriado) estado = "feriado";
            else if (esFuturo) estado = "pendiente";
            else if (cantidadAlumnos === 0) estado = "sin_alumnos";
            else if (cantidadAsistencias > 0) estado = "tomada";

            return {
              ...turno,
              estado,
              cantidadAlumnos,
              cantidadAsistencias,
            };
          });

        return {
          ...fecha,
          turnos: turnosDelDia,
          feriado: mapaFeriados.get(fecha.fechaISO) || null,
        };
      })
      .filter((fecha) => fecha.turnos.length > 0);
  }, [mesSel, turnos, sedeSel, mapaMatriculasPorTurno, mapaAsistencias, mapaFeriados]);

  const resumen = useMemo(() => {
    const acc = { tomada: 0, pendiente: 0, feriado: 0, sin_alumnos: 0, sin_registrar: 0 };
    registros.forEach((fecha) => {
      fecha.turnos.forEach((turno) => {
        acc[turno.estado] += 1;
      });
    });
    return acc;
  }, [registros]);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Control mensual de asistencia</h2>
        <button
          onClick={() => navigate("/asistencia-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-5xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block font-medium mb-1">Ciclo:</label>
            <select
              className="w-full border p-2 rounded"
              value={cicloSel}
              onChange={(e) => setCicloSel(e.target.value)}
            >
              {ciclos.map((ciclo) => (
                <option key={ciclo.codigo} value={ciclo.codigo}>
                  {ciclo.nombre_publico || ciclo.codigo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Mes:</label>
            <select className="w-full border p-2 rounded" value={mesSel} onChange={(e) => setMesSel(e.target.value)}>
              {Array.from({ length: 12 }).map((_, index) => {
                const info = parseMonth(mesSel) || {
                  year: new Date().getFullYear(),
                  monthIndex: new Date().getMonth(),
                };
                const year = info.year;
                return (
                  <option key={`${year}-${index + 1}`} value={`${year}-${String(index + 1).padStart(2, "0")}`}>
                    {MESES[index]} {year}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Sede:</label>
            <select className="w-full border p-2 rounded" value={sedeSel} onChange={(e) => setSedeSel(e.target.value)}>
              <option value="">Todas</option>
              {sedesDisponibles.map((sede) => (
                <option key={sede} value={sede}>
                  {sede}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            ["tomada", resumen.tomada],
            ["pendiente", resumen.pendiente],
            ["feriado", resumen.feriado],
            ["sin_alumnos", resumen.sin_alumnos],
            ["sin_registrar", resumen.sin_registrar],
          ].map(([estado, cantidad]) => (
            <div key={estado} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{textoEstado[estado]}</div>
              <div className="mt-1 text-2xl font-bold text-gray-800">{cantidad}</div>
            </div>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-center text-gray-600 py-8">Cargando control...</p>
        ) : registros.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No hay turnos para este ciclo y filtro.</p>
        ) : (
          <div className="space-y-4">
            {registros.map((fecha) => (
              <div key={fecha.fechaISO} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-gray-900">{formatearFecha(fecha.fechaISO)}</div>
                    <div className="text-sm text-gray-500 capitalize">{fecha.diaSemana}</div>
                  </div>
                  {fecha.feriado && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      {fecha.feriado.descripcion || "Feriado"}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-gray-100">
                  {fecha.turnos.map((turno) => (
                    <div
                      key={`${fecha.fechaISO}-${turno.sede}-${turno.dia}-${turno.hora}`}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_auto] gap-3 px-4 py-3 items-center"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{turno.sede}</div>
                        <div className="text-sm text-gray-600">
                          {turno.dia} {turno.hora}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600">
                        {turno.cantidadAlumnos > 0 ? `${turno.cantidadAlumnos} alumnos activos` : "Sin alumnos activos"}
                      </div>

                      <div className="flex items-center justify-start md:justify-end">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${claseEstado[turno.estado]}`}>
                          {textoEstado[turno.estado]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
