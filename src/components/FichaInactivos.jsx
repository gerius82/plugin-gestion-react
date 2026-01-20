import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function FichaInactivos() {
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg));
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarInactivos();
  }, [config]);

  async function cargarInactivos() {
    const headers = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };

    const [resInactivos, resActivas] = await Promise.all([
      fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,estado,ciclo_codigo,curso_nombre,sede,dia,hora,inscripciones(persona_id,nombre,apellido,telefono)&estado=not.ilike.activa`,
        { headers }
      ),
      fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=alumno_id,inscripciones(persona_id)&estado=ilike.activa`,
        { headers }
      ),
    ]);

    const dataInactivos = await resInactivos.json();
    const dataActivas = await resActivas.json();
    const alumnosConActiva = new Set(
      (Array.isArray(dataActivas) ? dataActivas : []).map((m) => {
        const insc = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
        return String(insc.persona_id || m.alumno_id);
      })
    );

    const lista = (Array.isArray(dataInactivos) ? dataInactivos : []).map((m) => {
      const alumno = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
      return {
        id: m.id,
        alumno_id: m.alumno_id,
        persona_id: alumno.persona_id || m.alumno_id,
        nombre: alumno.nombre || "",
        apellido: alumno.apellido || "",
        telefono: alumno.telefono || "",
        estado: m.estado || "",
        ciclo: m.ciclo_codigo || "",
        curso: m.curso_nombre || "",
        sede: m.sede || "",
        dia: m.dia || "",
        hora: m.hora || "",
      };
    }).filter((m) => !alumnosConActiva.has(String(m.persona_id || m.alumno_id)));
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setAlumnos(lista);
  }

  const interpolarMensaje = (plantilla, alumno) => {
    if (!plantilla) return "";
    const reemplazos = {
      "{nombre}": alumno?.nombre || "",
      "{apellido}": alumno?.apellido || "",
      "{curso}": alumno?.curso || "",
      "{sede}": alumno?.sede || "",
      "{dia}": alumno?.dia || "",
      "{hora}": alumno?.hora || "",
      "{ciclo}": alumno?.ciclo || "",
      "{estado}": alumno?.estado || "",
    };
    return Object.keys(reemplazos).reduce(
      (acc, key) => acc.split(key).join(reemplazos[key]),
      plantilla
    );
  };

  const enviarWhatsapp = (telefono, plantilla, alumno) => {
    if (!telefono || !plantilla) return;
    const msg = encodeURIComponent(interpolarMensaje(plantilla, alumno));
    const tel = telefono.replace(/\D/g, "");
    window.open(`https://wa.me/54${tel}?text=${msg}`, "_blank");
  };

  const reactivarAlumno = async (id) => {
    const confirmar = confirm("Estas seguro de reactivar esta matricula?");
    if (!confirmar) return;

    await fetch(`${config.supabaseUrl}/rest/v1/matriculas?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ estado: "activa", fecha_fin: null }),
    });

    setAlumnos((prev) => prev.filter((a) => a.id !== id));
  };

  const alumnosFiltrados = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const alumnosConTelefono = alumnosFiltrados.filter((a) => a.telefono);

  return (
    <div className="max-w-5xl mx-auto mt-10 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-4">Alumnos Inactivos</h2>

      <div className="text-gray-600 text-center mb-4 text-sm">
        Total: <strong>{alumnosFiltrados.length}</strong> | Con telefono: <strong>{alumnosConTelefono.length}</strong>
      </div>

      <input
        type="text"
        placeholder="Buscar alumno por nombre..."
        className="w-full border border-gray-300 p-2 rounded mb-4"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="mb-4">
        <label className="block font-medium mb-1 text-sm">Mensaje para WhatsApp</label>
        <textarea
          className="w-full border rounded p-3 text-sm min-h-[90px]"
          placeholder="Ej: Hola {nombre}..."
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          Tokens: {`{nombre}`}, {`{apellido}`}, {`{curso}`}, {`{sede}`}, {`{dia}`}, {`{hora}`}, {`{ciclo}`}, {`{estado}`}.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-3 text-left">Alumno</th>
              <th className="py-2 px-3 text-left">Estado</th>
              <th className="py-2 px-3 text-left">Curso</th>
              <th className="py-2 px-3 text-left">Turno</th>
              <th className="py-2 px-3 text-left">WhatsApp</th>
              <th className="py-2 px-3 text-left">Reactivar</th>
            </tr>
          </thead>
          <tbody>
            {alumnosFiltrados.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2 px-3">{a.nombre} {a.apellido}</td>
                <td className="py-2 px-3">{a.estado || "-"}</td>
                <td className="py-2 px-3">{a.curso || "-"}</td>
                <td className="py-2 px-3">{a.dia} {a.hora}</td>
                <td className="py-2 px-3 text-center">
                  {a.telefono && mensaje ? (
                    <button
                      onClick={() => enviarWhatsapp(a.telefono, mensaje, a)}
                      className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 hover:bg-green-600 transition"
                      title="Enviar mensaje por WhatsApp"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 16 16" className="w-4 h-4">
                        <path d="M13.601 2.326A7.955 7.955 0 0 0 8 0C3.582 0 0 3.582 0 8c0 1.425.375 2.748 1.03 3.914L0 16l4.188-1.03A7.963 7.963 0 0 0 8 16c4.418 0 8-3.582 8-8 0-2.137-.832-4.089-2.399-5.674zM8 14.5a6.5 6.5 0 1 1 4.401-11.074l.19.185A6.495 6.495 0 0 1 8 14.5z" />
                        <path d="M11.168 9.29c-.228-.114-1.348-.667-1.556-.743-.207-.077-.358-.114-.51.114-.152.228-.586.743-.72.895-.133.152-.266.171-.494.057-.228-.114-.962-.354-1.83-1.13-.676-.602-1.133-1.347-1.267-1.575-.133-.228-.014-.352.1-.466.103-.102.228-.266.342-.399.115-.133.152-.228.229-.38.076-.152.038-.285-.019-.399-.058-.114-.51-1.23-.699-1.681-.184-.445-.372-.384-.51-.392-.133-.008-.285-.01-.437-.01-.152 0-.4.057-.61.285-.21.228-.81.792-.81 1.931 0 1.14.83 2.243.945 2.399.114.152 1.63 2.5 3.96 3.494.554.24.984.384 1.32.49.554.176 1.057.152 1.455.092.444-.066 1.348-.551 1.538-1.083.19-.532.19-.99.133-1.083-.057-.095-.209-.152-.437-.266z" />
                      </svg>
                    </button>
                  ) : "-"}
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => reactivarAlumno(a.id)}
                    className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500 hover:bg-blue-600 transition text-white"
                    title="Reactivar matricula"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z" />
                      <path d="M8 1a.5.5 0 0 1 .5.5V5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1 0-1h3.5V1.5A.5.5 0 0 1 8 1z" />
                    </svg>
                  </button>
                </td>
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
          <span className="text-gray-500 text-lg">&lt;-</span>
          <span className="font-medium text-gray-700">Volver al menu</span>
        </Link>
      </div>
    </div>
  );
}
