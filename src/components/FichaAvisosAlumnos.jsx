import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

export default function FichaAvisosAlumnos() {
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("activos"); // activos | inactivos | todos
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroHora, setFiltroHora] = useState("");
  const [filtroCiclo, setFiltroCiclo] = useState("");
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
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
  }, [config, filtroEstado, filtroSede, filtroDia, filtroHora, filtroCiclo]);

  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
          { headers: headers() }
        );
        const data = await res.json();
        setCiclosDisponibles(Array.isArray(data) ? data : []);
      } catch {
        setCiclosDisponibles([]);
      }
    })();
  }, [config]);

  const headers = () => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
  });

  const cargarAlumnos = async () => {
    setCargando(true);
    setError("");

    try {
      let query = `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,ciclo_codigo,sede,dia,hora,estado,inscripciones(nombre,apellido,telefono)`;

      const filtros = [];

      if (filtroEstado === "activos") filtros.push("estado=eq.activa");
      if (filtroEstado === "inactivos") filtros.push("estado=in.(baja,finalizada)");
      if (filtroSede) filtros.push(`sede=eq.${encodeURIComponent(filtroSede)}`);
      if (filtroCiclo) filtros.push(`ciclo_codigo=eq.${encodeURIComponent(filtroCiclo)}`);
      if (filtroDia) filtros.push(`dia=eq.${encodeURIComponent(filtroDia)}`);
      if (filtroHora) filtros.push(`hora=eq.${encodeURIComponent(filtroHora)}`);

      if (filtros.length > 0) {
        query += "&" + filtros.join("&");
      }

      const res = await fetch(query, { headers: headers() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No pude cargar los alumnos.");
      }
      const data = await res.json();

      const listaBase = (Array.isArray(data) ? data : []).map((m) => {
        const alumno = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
        const estadoNormalizado = String(m.estado || "").toLowerCase();
        return {
          id: m.id,
          alumno_id: m.alumno_id,
          nombre: alumno.nombre,
          apellido: alumno.apellido,
          telefono: alumno.telefono,
          sede: m.sede,
          dia: m.dia,
          hora: m.hora,
          estado_normalizado: estadoNormalizado,
          ciclo_codigo: m.ciclo_codigo,
        };
      });

      // ordenar por nombre y apellido
      const listaFiltrada = [...listaBase].sort((a, b) => {
        const nomA = `${a.nombre} ${a.apellido}`.toLowerCase();
        const nomB = `${b.nombre} ${b.apellido}`.toLowerCase();
        return nomA.localeCompare(nomB);
      });

      setAlumnos(listaFiltrada);

      const diasOrden = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ];
      const dias = [...new Set(listaBase.map((a) => a.dia).filter(Boolean))].sort(
        (a, b) => diasOrden.indexOf(a) - diasOrden.indexOf(b)
      );
      setDiasDisponibles(dias);

      const horas = [
        ...new Set(
          listaBase
            .filter((a) => (!filtroDia || a.dia === filtroDia))
            .map((a) => a.hora)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        ),
      ];
      setHorasDisponibles(horas);
    } catch (e) {
      console.error(e);
      setError("No pude cargar los alumnos.");
    } finally {
      setCargando(false);
    }
  };

  const interpolarMensaje = (plantilla, alumno) => {
    if (!plantilla) return "";
    const reemplazos = {
      "{nombre}": alumno?.nombre || "",
      "{apellido}": alumno?.apellido || "",
      "{sede}": alumno?.sede || "",
      "{dia}": alumno?.dia || "",
      "{hora}": alumno?.hora || "",
      "{ciclo}": alumno?.ciclo_codigo || "",
    };
    return Object.keys(reemplazos).reduce(
      (acc, key) => acc.split(key).join(reemplazos[key]),
      plantilla
    );
  };

  const buildWhatsappLink = (telefono, mensajePlano, alumno) => {
    if (!telefono || !mensajePlano) return null;
    const limpio = telefono.replace(/\D/g, "");
    if (!limpio) return null;
    const personalizado = interpolarMensaje(mensajePlano, alumno);
    return `https://wa.me/54${limpio}?text=${encodeURIComponent(personalizado)}`;
  };

  const alumnosConTelefono = alumnos.filter((a) => a.telefono);
  const total = alumnos.length;
  const totalConTel = alumnosConTelefono.length;
  const pillForEstado = (estado) => {
    const e = (estado || "").toLowerCase();
    if (e === "activa") return { cls: "bg-green-100 text-green-800", label: "Activa" };
    if (e === "baja") return { cls: "bg-red-100 text-red-800", label: "Inactiva" };
    if (e === "pausada") return { cls: "bg-red-100 text-red-800", label: "Inactiva" };
    if (e === "finalizada") return { cls: "bg-gray-100 text-gray-800", label: "Finalizada" };
    return { cls: "bg-gray-100 text-gray-800", label: estado || "-" };
  };

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

        {/* Ciclo */}
        <div>
          <label className="block font-medium mb-1 text-sm">Ciclo:</label>
          <select
            className="w-full border p-2 rounded text-sm"
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

        {/* Sede */}
        <div>
          <label className="block font-medium mb-1 text-sm">Sede:</label>
          <select
            className="w-full border p-2 rounded text-sm"
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

        {/* Día */}
        <div>
          <label className="block font-medium mb-1 text-sm">Día:</label>
          <select
            className="w-full border p-2 rounded text-sm"
            value={filtroDia}
            onChange={(e) => { setFiltroDia(e.target.value); setFiltroHora(""); }}
          >
            <option value="">Todos</option>
            {diasDisponibles.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Horario */}
        <div>
          <label className="block font-medium mb-1 text-sm">Horario:</label>
          <select
            className="w-full border p-2 rounded text-sm"
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
          Podés usar {`{nombre}`}, {`{apellido}`}, {`{sede}`}, {`{dia}`}, {`{hora}`},{" "}
          {`{ciclo}`}. Se reemplazan por alumno al abrir WhatsApp.
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
                <th className="px-3 py-2 text-left">Día</th>
                <th className="px-3 py-2 text-left">Horario</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-center">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => {
                const link = buildWhatsappLink(a.telefono || "", mensaje, a);
                const pill = pillForEstado(a.estado_normalizado);
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
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{a.dia || "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{a.hora || "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${pill.cls}`}>
                        {pill.label}
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



