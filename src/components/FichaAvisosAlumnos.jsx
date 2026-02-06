import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";

export default function FichaAvisosAlumnos() {
  const navigate = useNavigate();
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
  const [plantillaActiva, setPlantillaActiva] = useState("");
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [plantillasEditables, setPlantillasEditables] = useState([]);
  const [plantillaEditId, setPlantillaEditId] = useState("");
  const [plantillaForm, setPlantillaForm] = useState({ label: "", text: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const plantillasBase = [
    {
      id: "bienvenida",
      orden: 1,
      label: "Bienvenida",
      text:
        "Hola {nombre} {apellido}! 🎉\n" +
        "Bienvenido al {ciclo}.\n" +
        "El cursado es en el turno de los {dia} de {hora}hs.\n" +
        "🤖 Cualquier duda, escribinos.",
    },
    {
      id: "transferencia",
      orden: 2,
      label: "Datos de transferencia",
      text:
        "Hola {nombre} {apellido}! 💳\n" +
        "Te paso los datos para abonar la cuota.\n" +
        "Alias: plugin.robotica (a nombre de German Iusto).\n" +
        "Gracias! 🙌",
    },
    {
      id: "ciclo2026",
      orden: 3,
      label: "Inscripcion Ciclo 2026",
      text:
        "Hola {nombre} {apellido}!\n" +
        "Queremos invitarte al Ciclo 2026 de Robótica y Programación.\n" +
        "Si tu hijo participó del Taller de Verano, la inscripción es gratuita.\n" +
        "Link para inscribirse: https://gestionplugin2.netlify.app/menu-padres\n" +
        "Cualquier duda, escribinos.",
    },
  ];
  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar config.json"));
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarAlumnos();
  }, [config, filtroEstado, filtroSede, filtroDia, filtroHora, filtroCiclo, ciclosDisponibles]);

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
  useEffect(() => {
    if (!config) return;
    cargarPlantillas();
  }, [config]);
  useEffect(() => {
    if (!mostrarPlantillas) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mostrarPlantillas]);

  const headers = (extra = {}) => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
    ...extra,
  });

  const cargarPlantillas = async () => {
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/avisos_plantillas?select=id,label,text,orden,activo&order=orden.asc`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error("No pude cargar las plantillas.");
      const data = await res.json();
      const activas = (Array.isArray(data) ? data : []).filter((p) => p.activo !== false);
      if (activas.length > 0) {
        setPlantillasEditables(activas);
        return;
      }
      await sembrarPlantillasBase();
    } catch {
      setPlantillasEditables(plantillasBase);
    }
  };

  const sembrarPlantillasBase = async () => {
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/avisos_plantillas`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(plantillasBase),
      });
      if (!res.ok) throw new Error("No pude guardar las plantillas base.");
      const data = await res.json();
      setPlantillasEditables(Array.isArray(data) ? data : plantillasBase);
    } catch {
      setPlantillasEditables(plantillasBase);
    }
  };

  const crearPlantilla = async (payload) => {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/avisos_plantillas`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("No pude crear la plantilla.");
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  };

  const actualizarPlantilla = async (id, payload) => {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/avisos_plantillas?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) throw new Error("No pude actualizar la plantilla.");
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  };

  const eliminarPlantilla = async (id) => {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/avisos_plantillas?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }
    );
    if (!res.ok) throw new Error("No pude eliminar la plantilla.");
  };

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

      const ciclosMap = new Map(
        (Array.isArray(ciclosDisponibles) ? ciclosDisponibles : []).map((c) => [
          c.codigo,
          c.nombre_publico || c.codigo,
        ])
      );
      const listaBase = (Array.isArray(data) ? data : []).map((m) => {
        const alumno = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
        const estadoNormalizado = String(m.estado || "").toLowerCase();
        return {
          id: m.id,
          alumno_id: m.alumno_id,
          nombre: (alumno.nombre || "").trimEnd(),
          apellido: (alumno.apellido || "").trimEnd(),
          telefono: alumno.telefono,
          sede: m.sede,
          dia: m.dia,
          hora: m.hora,
          estado_normalizado: estadoNormalizado,
          ciclo_codigo: m.ciclo_codigo,
          ciclo_nombre: ciclosMap.get(m.ciclo_codigo) || m.ciclo_codigo || "",
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
      "{nombre}": (alumno?.nombre || "").trim(),
      "{apellido}": (alumno?.apellido || "").trim(),
      "{sede}": alumno?.sede || "",
      "{dia}": alumno?.dia || "",
      "{hora}": alumno?.hora || "",
      "{ciclo}": alumno?.ciclo_nombre || alumno?.ciclo_codigo || "",
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
  const resetPlantillaForm = () => {
    setPlantillaEditId("");
    setPlantillaForm({ label: "", text: "" });
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
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Avisos por WhatsApp</h2>
        <button
          onClick={() => navigate("/alumnos-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 max-w-5xl mx-auto">

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
        <div className="mb-2">
          <div className="text-xs text-gray-600 mb-2">
            Mensajes prediseñados (marcar para cargar en el texto):
          </div>
          <div className="mb-2">
            <button
              type="button"
              className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
              onClick={() => setMostrarPlantillas(true)}
            >
              Crear / editar mensajes
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {plantillasEditables.map((p) => (
              <label
                key={p.id}
                className="inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full border border-gray-200 bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={plantillaActiva === p.id}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPlantillaActiva(p.id);
                      setMensaje(p.text);
                    } else {
                      setPlantillaActiva("");
                      setMensaje("");
                    }
                  }}
                />
                <span className={p.id === "transferencia" ? "whitespace-nowrap" : ""}>
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <textarea
          className="w-full border rounded p-3 text-sm min-h-[90px]"
          placeholder="Ej: Hola! Te escribimos desde Plugin para avisarte que..."
          value={mensaje}
          onChange={(e) => {
            const valor = e.target.value;
            setMensaje(valor);
            const activa = plantillasEditables.find((p) => p.id === plantillaActiva);
            if (activa && valor !== activa.text) {
              setPlantillaActiva("");
            }
          }}
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
      {mostrarPlantillas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Mensajes predisenados</h3>
              <button
                type="button"
                className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                onClick={() => {
                  setMostrarPlantillas(false);
                  resetPlantillaForm();
                }}
              >
                Cerrar
              </button>
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium mb-1">Nombre del mensaje</div>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={plantillaForm.label}
                onChange={(e) =>
                  setPlantillaForm((p) => ({ ...p, label: e.target.value }))
                }
              />
              <div className="text-sm font-medium mt-3 mb-1">Texto del mensaje</div>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
                value={plantillaForm.text}
                onChange={(e) =>
                  setPlantillaForm((p) => ({ ...p, text: e.target.value }))
                }
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  onClick={async () => {
                    if (!plantillaForm.label || !plantillaForm.text) return;
                    try {
                      if (plantillaEditId) {
                        const actualizada = await actualizarPlantilla(plantillaEditId, {
                          label: plantillaForm.label,
                          text: plantillaForm.text,
                        });
                        const updated = plantillasEditables.map((p) =>
                          p.id === plantillaEditId ? { ...p, ...actualizada } : p
                        );
                        setPlantillasEditables(updated);
                      } else {
                        const ordenMax = plantillasEditables.reduce(
                          (max, p) => Math.max(max, p.orden || 0),
                          0
                        );
                        const nueva = await crearPlantilla({
                          id: `custom-${Date.now()}`,
                          label: plantillaForm.label,
                          text: plantillaForm.text,
                          orden: ordenMax + 1,
                          activo: true,
                        });
                        setPlantillasEditables([...plantillasEditables, nueva]);
                      }
                      resetPlantillaForm();
                    } catch {
                      setError("No pude guardar la plantilla.");
                    }
                  }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  onClick={resetPlantillaForm}
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Mensajes</div>
              {plantillasEditables.length === 0 ? (
                <div className="text-sm text-gray-500">No hay mensajes.</div>
              ) : (
                <div className="space-y-2">
                  {plantillasEditables.map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="text-xs text-gray-500 whitespace-pre-line">
                          {p.text}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          onClick={() => {
                            setPlantillaEditId(p.id);
                            setPlantillaForm({ label: p.label, text: p.text });
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          onClick={async () => {
                            try {
                              await eliminarPlantilla(p.id);
                              const updated = plantillasEditables.filter((item) => item.id !== p.id);
                              setPlantillasEditables(updated);
                              if (plantillaEditId === p.id) {
                                resetPlantillaForm();
                              }
                              if (plantillaActiva === p.id) {
                                setPlantillaActiva("");
                                setMensaje("");
                              }
                            } catch {
                              setError("No pude eliminar la plantilla.");
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




