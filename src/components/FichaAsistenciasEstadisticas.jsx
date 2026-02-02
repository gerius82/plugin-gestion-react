import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  }, [config, filtroSede, filtroDia, filtroHora, filtroCiclo, filtroMes, solo4Semanas]);

  useEffect(() => {
    if (filtroMes !== "") {
      setSolo4Semanas(false);
    }
  }, [filtroMes]);

  useEffect(() => {
    if (!config) return;
    (async () => {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      );
      const data = await res.json();
      setCiclosDisponibles(Array.isArray(data) ? data : []);
    })();
  }, [config]);

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

    const asistenciasPromises = alumnosData.map((a) => {
      const filtroTurnoAsis = a.turno ? `&turno=eq.${encodeURIComponent(a.turno)}` : "";
      const filtroSedeAsis = a.sede ? `&sede=eq.${encodeURIComponent(a.sede)}` : "";
      return fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?alumno_id=eq.${a.alumno_id}${filtroTurnoAsis}${filtroSedeAsis}&select=tipo,fecha&order=fecha.desc&limit=${limit}`,
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

      return { ...a, asistencias: lista };
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

      <div className="bg-white rounded-xl shadow p-6 max-w-5xl mx-auto">
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
      </div>

      





      <table className="min-w-full table-auto border-t border-b text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-3">Alumno</th>
            <th className="py-2 px-3">Turno</th>
            <th className="py-2 px-3">
              {filtroMes
                ? `Asistencias de ${filtroMes}`
                : solo4Semanas
                ? "Últimas 4 semanas"
                : "Últimos 10 registros"}
            </th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2 px-3 whitespace-nowrap">{a.nombre} {a.apellido}</td>
              <td className="py-2 px-3 whitespace-nowrap">{a.turno}</td>
              <td className="py-2 px-3">
                <div className="flex gap-1 flex-wrap">
                  {a.asistencias.slice().reverse().map((r, i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-sm ${colorClase(r.tipo)}`}
                      title={formatISODate(r.fecha)}
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
  );
}









