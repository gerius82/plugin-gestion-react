import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function FichaResumenAlumnos() {
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [todosAlumnosMap, setTodosAlumnosMap] = useState({});
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);
  const [ordenColumna, setOrdenColumna] = useState("creado_en");
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [filtroTipoInscripcion, setFiltroTipoInscripcion] = useState("");
  

  useEffect(() => {
    fetch("/config.json")
      .then(res => res.json())
      .then(cfg => setConfig(cfg));
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarDatos();
  }, [config, filtroSede, filtroTurno, filtroTipoInscripcion, ordenColumna, ordenAscendente]);

  async function cargarDatos() {
    const headers = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };

    const allRes = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido`, { headers });
    const allData = await allRes.json();
    const map = Object.fromEntries(allData.map(a => [a.id, `${a.nombre} ${a.apellido}`]));
    setTodosAlumnosMap(map);

    let filtro = "&activo=eq.true";
    if (filtroSede) filtro += `&sede=eq.${encodeURIComponent(filtroSede)}`;
    if (filtroTurno) filtro += `&turno_1=eq.${encodeURIComponent(filtroTurno)}`;
    if (filtroTipoInscripcion)
      filtro += `&tipo_inscripcion=eq.${encodeURIComponent(filtroTipoInscripcion)}`;
    const alumnosRes = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=*&order=creado_en.asc${filtro}`, { headers });
    let data = await alumnosRes.json();

    data = data.map(a => ({
      ...a,
      beneficiario_nombre: a.beneficiario_id && map[a.beneficiario_id] ? map[a.beneficiario_id] : "-"
    }));

    data.sort((a, b) => {
      const valA = a[ordenColumna];
      const valB = b[ordenColumna];
      if (typeof valA === "string" && typeof valB === "string") {
        return valA.localeCompare(valB) * (ordenAscendente ? 1 : -1);
      }
      return (valA > valB ? 1 : -1) * (ordenAscendente ? 1 : -1);
    });

    setAlumnos(data);
    

    if (filtroSede) {
      const turnosRes = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=turno_1&sede=eq.${encodeURIComponent(filtroSede)}`, { headers });
      const turnosData = await turnosRes.json();
      const turnos = [...new Set(turnosData.map(d => d.turno_1))];
      const diasOrden = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      turnos.sort((a, b) => {
        const [diaA] = a.split(" ");
        const [diaB] = b.split(" ");
        const idxA = diasOrden.indexOf(diaA);
        const idxB = diasOrden.indexOf(diaB);
        return idxA - idxB || a.localeCompare(b);
      });
      setTurnosDisponibles(turnos);
    }
  }

  const handleOrden = (col) => {
    if (ordenColumna === col) {
      setOrdenAscendente(!ordenAscendente);
    } else {
      setOrdenColumna(col);
      setOrdenAscendente(true);
    }
  };

  const iconoOrden = () => "";

  return (
    <div className="max-w-full mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold text-center mb-6">Resumen de Alumnos</h2>

      

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Sede */}
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

        {/* Turno */}
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

        {/* 👇 Nuevo: Tipo de inscripción */}
        <div>
          <label className="block font-medium mb-1">Tipo de inscripción:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroTipoInscripcion}
            onChange={(e) => setFiltroTipoInscripcion(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="CICLO_2025">Ciclo 2025</option>
            <option value="TDV">Taller de Verano</option>
            <option value="CICLO_2026">Ciclo 2026</option>
          </select>
        </div>
      </div>


      <div className="mb-4 flex gap-6 text-sm text-gray-700 font-medium">
        <span>Total: <strong>{alumnos.length}</strong></span>
        <span>Con promo: <strong>{alumnos.filter(a => a.tiene_promo).length}</strong></span>
      </div>


      <div className="overflow-auto max-h-[70vh] border rounded">
        <table className="min-w-full text-sm border-t border-b text-left">
        <thead className="bg-gray-100 sticky top-0 z-20">
            <tr>
                {[
                ["creado_en", "Inscripción"],
                ["nombre", "Nombre"],
                ["edad", "Edad"],
                ["sede", "Sede"],
                ["turno_1", "Turno"],
                ["curso", "Curso"],
                ["tiene_promo", "Promo"],
                ["beneficiario_nombre", "Beneficiario"],
                ["lista_espera", "Espera"],
                ["ficha", "Ficha"],
                ["escuela", "Escuela"],
                ["responsable", "Responsable"],
                ["telefono", "Teléfono"],
                ["email", "Email"],
                ].map(([key, label]) => (
                <th
                    key={key}
                    onClick={() => key !== "ficha" && handleOrden(key)}
                    style={{ cursor: key !== "ficha" ? "pointer" : "default" }}
                    className={`px-3 py-2 ${
                    ["tiene_promo", "lista_espera", "ficha"].includes(key)
                        ? "text-center"
                        : "text-left"
                    }`}
                >
                    {label}
                </th>
                ))}
            </tr>
        </thead>

        <tbody>
            {alumnos.map((a) => (
                <tr key={a.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(a.creado_en).toLocaleDateString("es-AR")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                    {a.nombre} {a.apellido}
                </td>
                <td className="px-3 py-2">{a.edad}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.sede}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.turno_1}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.curso}</td>
                <td className="px-3 py-2 text-center">{a.tiene_promo ? "✅" : ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                    {a.beneficiario_nombre}
                </td>
                <td className="px-3 py-2 text-center">
                    <span
                    className={`inline-block w-3 h-3 rounded-full ${
                        a.lista_espera ? "bg-red-500" : "bg-green-500"
                    }`}
                    title={a.lista_espera ? "En lista de espera" : "Confirmado"}
                    ></span>
                </td>
                <td className="px-3 py-2 text-center">
                    <Link to={`/ficha-alumno/${a.id}`} title="Ver ficha individual">
                    📄
                    </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{a.escuela}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.responsable}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.telefono}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.email}</td>
                </tr>
            ))}
        </tbody>

        </table>
      </div>

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/alumnos-menu"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
        </Link>
      </div>
    </div>
  );
}
