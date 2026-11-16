import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const fechaAsistenciaMs = (registro) => {
  const fecha = new Date(registro?.fecha || 0).getTime();
  return Number.isFinite(fecha) ? fecha : 0;
};

const resumenAusencias = (asistencias = []) => {
  const recientes = [...asistencias].sort((a, b) => fechaAsistenciaMs(b) - fechaAsistenciaMs(a));
  let faltasSeguidas = 0;

  for (const registro of recientes) {
    if (registro?.tipo !== "ausente") break;
    faltasSeguidas += 1;
  }

  const faltasTotales = recientes.filter((registro) => registro?.tipo === "ausente").length;
  const ultimaFalta = recientes.find((registro) => registro?.tipo === "ausente")?.fecha || "";
  return { faltasSeguidas, faltasTotales, ultimaFalta };
};

export default function FichaAsistenciasEstadisticas() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroHora, setFiltroHora] = useState("");
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [filtroCiclo, setFiltroCiclo] = useState("");
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [filtroMes, setFiltroMes] = useState("");
  const [solo4Semanas, setSolo4Semanas] = useState(false);
  const [incluirOtrosTurnos, setIncluirOtrosTurnos] = useState(false);
  const [orden, setOrden] = useState("faltas");
  const [ascendente, setAscendente] = useState(false);

  const toIsoDate = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.includes("T") ? raw.split("T")[0] : raw;
  };


  useEffect(() => {
    fetch("/config.json")
      .then(res => res.json())
      .then(cfg => {
        setConfig(cfg);
      });
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarResumen();
  }, [config, filtroSede, filtroDia, filtroHora, filtroCiclo, filtroMes, solo4Semanas, incluirOtrosTurnos, ciclosDisponibles]);

  useEffect(() => {
    if (filtroMes !== "") {
      setSolo4Semanas(false);
    }
  }, [filtroMes]);

  useEffect(() => {
    if (!config) return;
    (async () => {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden,fecha_inicio,fecha_inicio_ciclo&order=orden.asc`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      );
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setCiclosDisponibles(lista);
      if (!filtroCiclo && lista.length > 0) {
        const ciclo2026 = lista.find((c) => c.codigo === "CICLO_2026");
        const activo = lista.find((c) => c.activo);
        setFiltroCiclo((ciclo2026 || activo || lista[0]).codigo);
      }
    })();
  }, [config, filtroCiclo]);

    async function cargarResumen() {
    const filtrosBase = ["estado=eq.activa"];
    if (filtroSede) filtrosBase.push(`sede=eq.${encodeURIComponent(filtroSede)}`);
    if (filtroCiclo) filtrosBase.push(`ciclo_codigo=eq.${encodeURIComponent(filtroCiclo)}`);

    const filtros = [...filtrosBase];
    if (filtroDia) filtros.push(`dia=eq.${encodeURIComponent(filtroDia)}`);
    if (filtroHora) filtros.push(`hora=eq.${encodeURIComponent(filtroHora)}`);

    const alumnosRes = await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,sede,dia,hora,ciclo_codigo,inscripciones(nombre,apellido)&${filtros.join("&")}`,
      {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        },
      }
    );

    let alumnosData = await alumnosRes.json();
    alumnosData = (Array.isArray(alumnosData) ? alumnosData : []).map((m) => {
      const alumno = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
      const turno = [m.dia, m.hora].filter(Boolean).join(" ");
      return {
        id: m.id,
        alumno_id: m.alumno_id,
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        sede: m.sede,
        dia: m.dia,
        hora: m.hora,
        turno,
        ciclo_codigo: m.ciclo_codigo,
      };
    });
    alumnosData.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    const limit = filtroMes || solo4Semanas ? 200 : 10;
    const cicloSel = (ciclosDisponibles || []).find((c) => c.codigo === filtroCiclo) || null;
    const fechaInicioCiclo = filtroCiclo === "CICLO_2026"
      ? "2026-03-01"
      : (
          toIsoDate(cicloSel?.fecha_inicio) ||
          toIsoDate(cicloSel?.fecha_inicio_ciclo) ||
          ""
        );

    const asistenciasPromises = alumnosData.map((a) => {
      const filtroTurnoAsis =
        !incluirOtrosTurnos && a.turno ? `&turno=eq.${encodeURIComponent(a.turno)}` : "";
      const filtroSedeAsis =
        !incluirOtrosTurnos && a.sede ? `&sede=eq.${encodeURIComponent(a.sede)}` : "";
      const filtroFechaInicioAsis = fechaInicioCiclo ? `&fecha=gte.${fechaInicioCiclo}` : "";
      return fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?alumno_id=eq.${a.alumno_id}${filtroTurnoAsis}${filtroSedeAsis}${filtroFechaInicioAsis}&select=tipo,fecha,turno,sede&order=fecha.desc&limit=${limit}`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      ).then((res) => res.json());
    });

    const asistenciasData = await Promise.all(asistenciasPromises);

    const hoy = new Date();
    const cuatroSemanas = 28;

    const alumnosConAsistencias = alumnosData.map((a, idx) => {
      let lista = asistenciasData[idx] || [];

      if (fechaInicioCiclo) {
        lista = lista.filter((x) => toIsoDate(x.fecha) >= fechaInicioCiclo);
      }

      if (filtroMes) {
        lista = lista.filter((x) => {
          const m = new Date(x.fecha).toLocaleString("es-AR", { month: "long" });
          return m.toLowerCase() === filtroMes.toLowerCase();
        });
      }

      if (solo4Semanas && !filtroMes) {
        lista = lista.filter((x) => {
          const f = new Date(x.fecha);
          const dif = (hoy - f) / (1000 * 3600 * 24);
          return dif <= cuatroSemanas;
        });
      }

      lista = lista.map((x) => ({
        ...x,
        fueraDeTurno:
          String(x.turno || "") !== String(a.turno || "") || String(x.sede || "") !== String(a.sede || ""),
      }));

      return { ...a, asistencias: lista, ...resumenAusencias(lista) };
    });

        setAlumnos(alumnosConAsistencias);

    let turnosBase = alumnosData;
    if (filtroDia || filtroHora) {
      const resTurnos = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=dia,hora&${filtrosBase.join("&")}`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      );
      const dataTurnos = await resTurnos.json();
      turnosBase = Array.isArray(dataTurnos) ? dataTurnos : [];
    }

    const diasOrden = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
    const diasUnicos = [
      ...new Set(turnosBase.map((a) => a.dia).filter(Boolean)),
    ];
    diasUnicos.sort((a, b) => diasOrden.indexOf(a) - diasOrden.indexOf(b));
    setDiasDisponibles(diasUnicos);

    const horasUnicas = [
      ...new Set(
        turnosBase
          .filter((a) => (!filtroDia || a.dia === filtroDia))
          .map((a) => a.hora)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    setHorasDisponibles(horasUnicas);
  }


  const colorClase = tipo => {
    if (tipo === "regular") return "bg-green-400";
    if (tipo === "ausente") return "bg-red-400";
    if (tipo === "recuperacion") return "bg-blue-400";
    return "bg-gray-300";
  };

  const claseMarcaAsistencia = (registro) => {
    const base = colorClase(registro?.tipo);
    return registro?.fueraDeTurno ? `${base} ring-2 ring-amber-400` : base;
  };

  const alumnosOrdenados = useMemo(() => {
    const porNombre = (a, b) => {
      const nombreA = `${a.nombre || ""} ${a.apellido || ""}`.trim();
      const nombreB = `${b.nombre || ""} ${b.apellido || ""}`.trim();
      return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
    };

    return [...alumnos].sort((a, b) => {
      if (orden === "nombre") {
        const comparacion = porNombre(a, b);
        return ascendente ? comparacion : -comparacion;
      }

      const racha = Number(a.faltasSeguidas || 0) - Number(b.faltasSeguidas || 0);
      if (racha !== 0) return ascendente ? racha : -racha;

      const totales = Number(a.faltasTotales || 0) - Number(b.faltasTotales || 0);
      if (totales !== 0) return ascendente ? totales : -totales;

      return porNombre(a, b);
    });
  }, [alumnos, orden, ascendente]);

  const cambiarOrden = (nuevoOrden) => {
    if (orden === nuevoOrden) {
      setAscendente((valor) => !valor);
      return;
    }
    setOrden(nuevoOrden);
    setAscendente(nuevoOrden === "nombre");
  };

  const indicadorOrden = (columna) => {
    if (orden !== columna) return "↕";
    return ascendente ? "↑" : "↓";
  };

   // arriba del componente (o dentro):
   const formatISODate = (iso) => {
    const [y, m, d] = iso.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
};

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Estadísticas de Asistencia</h2>
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
        {/* Sede */}
        <div>
          <label className="block font-medium mb-1">Sede:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroSede}
            onChange={(e) => {
              setFiltroSede(e.target.value);
              setFiltroDia("");
              setFiltroHora("");
            }}
          >
            <option value="">Todas</option>
            <option value="Calle Mendoza">Calle Mendoza</option>
            <option value="Fisherton">Fisherton</option>
          </select>
        </div>

{/* Nuevo: Ciclo */}
        <div>
          <label className="block font-medium mb-1">Ciclo:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroCiclo}
            onChange={(e) => setFiltroCiclo(e.target.value)}
          >
            <option value="">Todos</option>
            {ciclosDisponibles.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre_publico || c.codigo}
              </option>
            ))}
          </select>
        </div>

                {/* Dia */}
        <div>
          <label className="block font-medium mb-1">Dia:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroDia}
            onChange={(e) => {
              setFiltroDia(e.target.value);
              setFiltroHora("");
            }}
          >
            <option value="">Todos</option>
            {diasDisponibles.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Horario */}
        <div>
          <label className="block font-medium mb-1">Horario:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroHora}
            onChange={(e) => setFiltroHora(e.target.value)}
            disabled={!filtroDia && !filtroSede}
          >
            <option value="">Todos</option>
            {horasDisponibles.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        

          {/* Mes + ultimas 4 semanas */}
        <div>
          <label className="block font-medium mb-1">Mes:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
          >
            <option value="">Todos</option>
            {[
              "Enero","Febrero","Marzo","Abril","Mayo","Junio",
              "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
            ].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={solo4Semanas}
              disabled={!!filtroMes}         
              onChange={(e) => setSolo4Semanas(e.target.checked)}
            />
            <span className={filtroMes ? "text-gray-400" : "text-gray-800"}>
              Últimas 4 semanas
            </span>
          </div>
        </div>
        <div>
          <label className="block font-medium mb-1">Turnos:</label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={incluirOtrosTurnos}
              onChange={(e) => setIncluirOtrosTurnos(e.target.checked)}
            />
            <span className="text-gray-800">Incluir asistencias en otros turnos</span>
          </label>
        </div>
      </div>

      





      <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[760px] table-auto border-t border-b text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th
              className="cursor-pointer select-none py-2 px-3"
              onClick={() => cambiarOrden("nombre")}
              title="Ordenar por alumno"
            >
              Alumno {indicadorOrden("nombre")}
            </th>
            <th className="py-2 px-3">Turno</th>
            <th
              className="cursor-pointer select-none whitespace-nowrap py-2 px-3 text-center"
              onClick={() => cambiarOrden("faltas")}
              title="Ordenar por faltas consecutivas recientes"
            >
              Faltas seguidas {indicadorOrden("faltas")}
            </th>
            <th className="py-2 px-3 text-right">
              {filtroMes
                ? `Asistencias de ${filtroMes}`
                : solo4Semanas
                ? "Últimas 4 semanas"
                : "Últimos 10 registros"}
            </th>
          </tr>
        </thead>
        <tbody>
          {alumnosOrdenados.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2 px-3"><div className="min-w-[170px] break-words">{a.nombre} {a.apellido}</div></td>
              <td className="py-2 px-3"><div className="min-w-[150px] break-words">{a.turno}</div></td>
              <td className="py-2 px-3 text-center">
                {a.faltasSeguidas > 0 ? (
                  <span
                    className="inline-flex min-w-8 items-center justify-center rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700"
                    title={`${a.faltasTotales} falta${a.faltasTotales === 1 ? "" : "s"} en el período visible`}
                  >
                    {a.faltasSeguidas}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="py-2 px-3">
                <div className="flex gap-1 flex-wrap justify-end">
                  {a.asistencias.slice().reverse().map((r, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-sm ${claseMarcaAsistencia(r)}`}
                      title={`${formatISODate(r.fecha)}${r.turno ? ` - ${r.turno}` : ""}${
                        r.fueraDeTurno ? " - otro turno" : ""
                      }`}
                    ></span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      </div>
    </div>
  );
}









