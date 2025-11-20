import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function FichaAsistenciasEstadisticas() {
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);

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
  }, [config, filtroSede, filtroTurno]);

  async function cargarResumen() {
    let filtro = "&activo=eq.true";
    if (filtroSede) filtro += `&sede=eq.${encodeURIComponent(filtroSede)}`;
    if (filtroTurno) filtro += `&turno_1=eq.${encodeURIComponent(filtroTurno)}`;

    const alumnosRes = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido,turno_1,sede${filtro}`, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      },
    });

    const alumnosData = await alumnosRes.json();
    alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const asistenciasPromises = alumnosData.map(a =>
      fetch(`${config.supabaseUrl}/rest/v1/asistencias?alumno_id=eq.${a.id}&select=tipo,fecha&order=fecha.desc&limit=10`, {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        },
      }).then(res => res.json())
    );

    const asistenciasData = await Promise.all(asistenciasPromises);
    setAlumnos(alumnosData.map((a, idx) => ({ ...a, asistencias: asistenciasData[idx] })));

    // cargar turnos disponibles SOLO según sede
    if (config && filtroSede) {
        const res = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=turno_1&sede=eq.${encodeURIComponent(filtroSede)}`, {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        });
        const datos = await res.json();
        const turnosUnicos = [...new Set(datos.map(d => d.turno_1))];
      
        const diasOrden = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        turnosUnicos.sort((a, b) => {
          const [diaA] = a.split(" ");
          const [diaB] = b.split(" ");
          const idxA = diasOrden.indexOf(diaA);
          const idxB = diasOrden.indexOf(diaB);
          return idxA - idxB || a.localeCompare(b);
        });
      
        setTurnosDisponibles(turnosUnicos);
      } else {
        setTurnosDisponibles([]);
      }
      
  
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
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold text-center mb-6">Estadísticas de Asistencia</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium mb-1">Sede:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroSede}
            onChange={(e) => {
              setFiltroSede(e.target.value);
              setFiltroTurno("");
            }}
          >
            <option value="">Todas</option>
            <option value="Calle Mendoza">Calle Mendoza</option>
            <option value="Fisherton">Fisherton</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Turno:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroTurno}
            onChange={(e) => setFiltroTurno(e.target.value)}
          >
            <option value="">Todos</option>
            {turnosDisponibles.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <table className="min-w-full table-auto border-t border-b text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-3">Alumno</th>
            <th className="py-2 px-3">Turno</th>
            <th className="py-2 px-3">Últimos 10 registros</th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2 px-3 whitespace-nowrap">{a.nombre} {a.apellido}</td>
              <td className="py-2 px-3 whitespace-nowrap">{a.turno_1}</td>
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

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/asistencia-menu"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
        </Link>
      </div>
    </div>
  );
}
