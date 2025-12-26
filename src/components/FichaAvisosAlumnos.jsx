import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

export default function FichaAvisosAlumnos() {
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("activos"); // activos | inactivos | todos
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  const [filtroTipoInscripcion, setFiltroTipoInscripcion] = useState("");
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar config.json"));
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarAlumnos();
  }, [config, filtroEstado, filtroSede, filtroTurno, filtroTipoInscripcion]);

  const headers = () => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
  });

  const cargarAlumnos = async () => {
    setCargando(true);
    setError("");

    try {
      let query = `${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido,telefono,sede,turno_1,activo,tipo_inscripcion&order=nombre.asc`;

      const filtros = [];

      if (filtroEstado === "activos") filtros.push("activo=eq.true");
      if (filtroEstado === "inactivos") filtros.push("activo=eq.false");
      if (filtroSede) filtros.push(`sede=eq.${encodeURIComponent(filtroSede)}`);
      if (filtroTurno) filtros.push(`turno_1=eq.${encodeURIComponent(filtroTurno)}`);
      if (filtroTipoInscripcion)
        filtros.push(`tipo_inscripcion=eq.${encodeURIComponent(filtroTipoInscripcion)}`);

      if (filtros.length > 0) {
        query += "&" + filtros.join("&");
      }

      const res = await fetch(query, { headers: headers() });
      const data = await res.json();

      // ordenar por nombre y apellido
      data.sort((a, b) => {
        const nomA = `${a.nombre} ${a.apellido}`.toLowerCase();
        const nomB = `${b.nombre} ${b.apellido}`.toLowerCase();
        return nomA.localeCompare(nomB);
      });

      setAlumnos(Array.isArray(data) ? data : []);

      // Turnos disponibles según sede y ciclo
      if (filtroSede) {
        const filtroTipo = filtroTipoInscripcion
          ? `&tipo_inscripcion=eq.${encodeURIComponent(filtroTipoInscripcion)}`
          : "";

        const resTurnos = await fetch(
          `${config.supabaseUrl}/rest/v1/inscripciones?select=turno_1&sede=eq.${encodeURIComponent(
            filtroSede
          )}${filtroTipo}`,
          { headers: headers() }
        );
        const datosTurnos = await resTurnos.json();
        const turnosUnicos = [...new Set(datosTurnos.map((d) => d.turno_1).filter(Boolean))];

        const diasOrden = [
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
          "Domingo",
        ];
        turnosUnicos.sort((a, b) => {
          const [diaA] = (a || "").split(" ");
          const [diaB] = (b || "").split(" ");
          const idxA = diasOrden.indexOf(diaA);
          const idxB = diasOrden.indexOf(diaB);
          return idxA - idxB || a.localeCompare(b);
        });

        setTurnosDisponibles(turnosUnicos);
      } else {
        setTurnosDisponibles([]);
      }
    } catch (e) {
      console.error(e);
      setError("No pude cargar los alumnos.");
    } finally {
      setCargando(false);
    }
  };

  const buildWhatsappLink = (telefono, mensajePlano) => {
    if (!telefono || !mensajePlano) return null;
    const limpio = telefono.replace(/\D/g, "");
    if (!limpio) return null;
    return `https://wa.me/54${limpio}?text=${encodeURIComponent(mensajePlano)}`;
  };

  const alumnosConTelefono = alumnos.filter((a) => a.telefono);
  const total = alumnos.length;
  const totalConTel = alumnosConTelefono.length;

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold text-center mb-6">Avisos por WhatsApp</h2>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Estado */}
        <div>
          <label className="block font-medium mb-1 text-sm">Estado:</label>
          <select
            className="w-full border p-2 rounded text-sm"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {/* Tipo de inscripción */}
        <div>
          <label className="block font-medium mb-1 text-sm">Tipo de inscripción:</label>
          <select
            className="w-full border p-2 rounded text-sm"
            value={filtroTipoInscripcion}
            onChange={(e) => setFiltroTipoInscripcion(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="CICLO_2025">Ciclo 2025</option>
            <option value="TDV">Taller de Verano</option>
            <option value="CICLO_2026">Ciclo 2026</option>
          </select>
        </div>

        {/* Sede */}
        <div>
          <label className="block font-medium mb-1 text-sm">Sede:</label>
          <select
            className="w-full border p-2 rounded text-sm"
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
          <label className="block font-medium mb-1 text-sm">Turno (día y horario):</label>
          <select
            className="w-full border p-2 rounded text-sm"
            value={filtroTurno}
            onChange={(e) => setFiltroTurno(e.target.value)}
            disabled={!filtroSede}
          >
            <option value="">Todos</option>
            {turnosDisponibles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {!filtroSede && (
            <p className="text-xs text-gray-400 mt-1">
              Elegí una sede para filtrar por turno.
            </p>
          )}
        </div>
      </div>

      {/* Editor de mensaje */}
      <div className="mb-4">
        <label className="block font-medium mb-1 text-sm">
          Mensaje a enviar por WhatsApp:
        </label>
        <textarea
          className="w-full border rounded p-3 text-sm min-h-[90px]"
          placeholder="Ej: Hola! Te escribimos desde Plugin para avisarte que..."
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          El mismo texto se usará para todos los alumnos. Podés personalizarlo a mano
          cuando se abra WhatsApp, si querés.
        </p>
      </div>

      {/* Resumen */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-4">
        <span>
          Total alumnos filtrados: <strong>{total}</strong>
        </span>
        <span>
          Con teléfono: <strong>{totalConTel}</strong>
        </span>
        {mensaje && (
          <span>
            Listos para enviar (con teléfono + mensaje):{" "}
            <strong>{alumnosConTelefono.length}</strong>
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-center text-gray-500">Cargando alumnos…</p>
      ) : total === 0 ? (
        <p className="text-center text-gray-500">No se encontraron alumnos con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-sm border-t border-b">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Alumno</th>
                <th className="px-3 py-2 text-left">Teléfono</th>
                <th className="px-3 py-2 text-left">Sede</th>
                <th className="px-3 py-2 text-left">Turno</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-center">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => {
                const link = buildWhatsappLink(a.telefono || "", mensaje);
                const esActivo = a.activo === true;
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.nombre} {a.apellido}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.telefono || <span className="text-gray-400">Sin teléfono</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.sede || "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {a.turno_1 || "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                          esActivo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {esActivo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-sm transition"
                          title="Enviar aviso por WhatsApp"
                        >
                          <FaWhatsapp className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
