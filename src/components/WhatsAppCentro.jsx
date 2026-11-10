import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaAddressBook,
  FaArrowLeft,
  FaCheckDouble,
  FaCommentDots,
  FaImage,
  FaPaperPlane,
  FaPaperclip,
  FaPhoneAlt,
  FaPlay,
  FaRobot,
  FaSearch,
  FaSyncAlt,
  FaTrash,
  FaUser,
  FaWhatsapp,
} from "react-icons/fa";
import { getSupabaseAuthClient } from "../lib/supabaseAuth";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const botModeLabel = {
  active: "Bot activo",
  paused: "Bot pausado",
  human: "Atención humana",
};

export default function WhatsAppCentro() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    conversations: [],
    messages: [],
    contacts: [],
    enrollments: [],
    settings: { simulation_only: true, sending_enabled: false },
  });
  const [selectedPhone, setSelectedPhone] = useState("");
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState(null);
  const [mediaUrls, setMediaUrls] = useState({});

  const [simPhone, setSimPhone] = useState("3412153057");
  const [simInput, setSimInput] = useState("");
  const [simLog, setSimLog] = useState([]);
  const [simOptions, setSimOptions] = useState([]);
  const [simContext, setSimContext] = useState(null);

  useEffect(() => {
    fetch("/config.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración.");
        return response.json();
      })
      .then(setConfig)
      .catch((currentError) => setError(currentError.message));
  }, []);

  const api = async (body) => {
    if (!config) throw new Error("La configuración todavía no está disponible.");
    const client = await getSupabaseAuthClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("La sesión administrativa venció.");
    const response = await fetch(`${config.supabaseUrl}/functions/v1/whatsapp-admin`, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || "No se pudo consultar WhatsApp.");
    }
    return result;
  };

  const fetchMedia = async (mediaId) => {
    if (!config || !mediaId) return null;
    const client = await getSupabaseAuthClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("La sesión administrativa venció.");
    const response = await fetch(
      `${config.supabaseUrl}/functions/v1/whatsapp-admin?media_id=${encodeURIComponent(mediaId)}`,
      {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) throw new Error("No se pudo cargar una imagen de WhatsApp.");
    return URL.createObjectURL(await response.blob());
  };

  const loadInbox = async () => {
    if (!config) return;
    try {
      setLoading(true);
      setError("");
      const result = await api();
      setData(result);
      setSelectedPhone((current) => current || result.conversations?.[0]?.phone || "");
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [config]);

  useEffect(() => {
    const missingIds = [...new Set(
      (data.messages || [])
        .filter((message) => message.message_type === "image" && message.media_id && !mediaUrls[message.media_id])
        .map((message) => message.media_id),
    )];
    if (!missingIds.length) return;
    let cancelled = false;
    Promise.all(missingIds.map(async (mediaId) => {
      try {
        return [mediaId, await fetchMedia(mediaId)];
      } catch {
        return [mediaId, null];
      }
    })).then((entries) => {
      if (cancelled) {
        for (const [, url] of entries) if (url) URL.revokeObjectURL(url);
        return;
      }
      setMediaUrls((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(([, url]) => url)),
      }));
    });
    return () => { cancelled = true; };
  }, [config, data.messages]);

  const contactsByPhone = useMemo(() => {
    const map = new Map();
    for (const contact of data.contacts || []) {
      const phone = normalizePhone(contact.telefono_busqueda || contact.telefono);
      if (!map.has(phone)) map.set(phone, []);
      map.get(phone).push(contact);
    }
    return map;
  }, [data.contacts]);

  const messagesByPhone = useMemo(() => {
    const map = new Map();
    for (const message of data.messages || []) {
      if (!map.has(message.from_phone)) map.set(message.from_phone, []);
      map.get(message.from_phone).push(message);
    }
    for (const messages of map.values()) {
      messages.sort((left, right) => new Date(left.received_at) - new Date(right.received_at));
    }
    return map;
  }, [data.messages]);

  const conversations = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (data.conversations || []).filter((conversation) => {
      if (!query) return true;
      const contacts = contactsByPhone.get(normalizePhone(conversation.phone)) || [];
      const searchable = [
        conversation.phone,
        conversation.contact_name,
        ...contacts.flatMap((contact) => [contact.nombre, contact.apellido, contact.responsable]),
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [contactsByPhone, data.conversations, filter]);

  const agenda = useMemo(() => {
    const grouped = new Map();
    for (const contact of data.contacts || []) {
      const phone = normalizePhone(contact.telefono_busqueda || contact.telefono);
      if (!phone) continue;
      if (!grouped.has(phone)) grouped.set(phone, { phone, contacts: [] });
      grouped.get(phone).contacts.push(contact);
    }
    const query = filter.trim().toLowerCase();
    return [...grouped.values()]
      .map((entry) => {
        const responsible = entry.contacts.find((item) => item.responsable)?.responsable || "";
        const students = entry.contacts
          .map((item) => `${item.nombre || ""} ${item.apellido || ""}`.trim())
          .filter(Boolean);
        return {
          ...entry,
          responsible,
          students,
          title: responsible || students[0] || `+${entry.phone}`,
        };
      })
      .filter((entry) => !query || [entry.title, entry.phone, ...entry.students].join(" ").toLowerCase().includes(query))
      .sort((left, right) => left.title.localeCompare(right.title, "es"));
  }, [data.contacts, filter]);

  const selectedConversation = (data.conversations || []).find(
    (conversation) => normalizePhone(conversation.phone) === normalizePhone(selectedPhone),
  );
  const activePhone = selectedConversation?.phone || selectedPhone;
  const selectedMessages = messagesByPhone.get(activePhone) || [];
  const selectedContacts = contactsByPhone.get(normalizePhone(selectedPhone)) || [];
  const selectedEnrollments = (data.enrollments || []).filter((enrollment) =>
    selectedContacts.some((contact) => [contact.id, contact.persona_id].filter(Boolean).map(String).includes(String(enrollment.alumno_id))),
  );
  const selectedTitle = selectedContacts[0]?.responsable
    || selectedConversation?.contact_name
    || selectedContacts.map((contact) => `${contact.nombre || ""} ${contact.apellido || ""}`.trim()).filter(Boolean).join(" / ")
    || (selectedPhone ? `+${selectedPhone}` : "");

  const markRead = async () => {
    if (!activePhone) return;
    try {
      setBusy(true);
      await api({ action: "mark_read", phone: activePhone });
      await loadInbox();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const setBotMode = async (mode) => {
    if (!activePhone) return;
    try {
      setBusy(true);
      await api({ action: "set_bot_mode", phone: activePhone, mode });
      await loadInbox();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteConversation = async () => {
    if (!activePhone) return;
    const label = selectedConversation?.contact_name || `+${activePhone}`;
    if (!window.confirm(`¿Eliminar la conversación con ${label}? Esta acción no se puede deshacer.`)) return;
    try {
      setBusy(true);
      setError("");
      await api({ action: "delete_conversation", phone: activePhone });
      setSelectedPhone("");
      await loadInbox();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (input) => {
    const cleanInput = String(input || "").trim();
    if (!cleanInput || !simPhone.trim()) return;
    try {
      setBusy(true);
      setError("");
      setSimLog((current) => [...current, { role: "user", text: cleanInput }]);
      setSimInput("");
      const result = await api({ action: "simulate", phone: simPhone, input: cleanInput });
      setSimLog((current) => [...current, { role: "bot", text: result.message }]);
      setSimOptions(result.options || []);
      setSimContext(result.context || null);
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const startSimulation = () => {
    setSimLog([]);
    setSimOptions([]);
    setSimContext(null);
    simulate("Hola");
  };

  return (
    <div className="w-full max-w-7xl mx-auto -mt-2 sm:mt-0">
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/menu-gestion")}
            className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 !p-0 text-gray-700 transition hover:bg-gray-100"
            aria-label="Volver"
          >
            <FaArrowLeft />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <FaWhatsapp />
              </span>
              <span>Centro de WhatsApp</span>
            </h1>
            <p className="mt-0.5 hidden text-sm text-gray-500 sm:block">Mensajes, contactos y automatizaciones</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadInbox}
          disabled={loading}
          className="!flex !w-auto shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:px-4"
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={`!w-full rounded-lg px-4 py-2.5 font-semibold transition ${tab === "inbox" ? "bg-green-600 text-white shadow-sm" : "bg-transparent text-gray-700 hover:bg-white/70"}`}
        >
          <FaCommentDots className="inline mr-2" /> Bandeja
        </button>
        <button
          type="button"
          onClick={() => setTab("contacts")}
          className={`!w-full rounded-lg px-3 py-2.5 font-semibold transition ${tab === "contacts" ? "bg-green-600 text-white shadow-sm" : "bg-transparent text-gray-700 hover:bg-gray-100"}`}
        >
          <FaAddressBook className="inline mr-2" /> Agenda
        </button>
        <button
          type="button"
          onClick={() => setTab("simulator")}
          className={`!w-full rounded-lg px-4 py-2.5 font-semibold transition ${tab === "simulator" ? "bg-green-600 text-white shadow-sm" : "bg-transparent text-gray-700 hover:bg-white/70"}`}
        >
          <FaRobot className="inline mr-2" /> Simulador del bot
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{error}</div>}

      {(tab === "inbox" || tab === "contacts") && (
        <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_290px]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <div className="border-b bg-gray-50 p-3">
              <h2 className="mb-3 text-lg font-bold text-gray-900">{tab === "inbox" ? "Chats" : "Contactos"}</h2>
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400" />
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={tab === "inbox" ? "Buscar un chat" : "Buscar en la agenda"}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading && <p className="p-5 text-sm text-gray-500">Cargando…</p>}
              {!loading && tab === "inbox" && conversations.length === 0 && (
                <p className="p-5 text-sm text-gray-500">Todavía no hay conversaciones para mostrar.</p>
              )}
              {!loading && tab === "contacts" && agenda.length === 0 && (
                <p className="p-5 text-sm text-gray-500">No encontramos contactos con teléfono.</p>
              )}
              {tab === "inbox" && conversations.map((conversation) => {
                const matches = contactsByPhone.get(normalizePhone(conversation.phone)) || [];
                const title = matches.length
                  ? matches.map((contact) => `${contact.nombre || ""} ${contact.apellido || ""}`.trim()).join(" / ")
                  : conversation.contact_name || conversation.phone;
                return (
                  <button
                    type="button"
                    key={conversation.phone}
                    onClick={() => setSelectedPhone(conversation.phone)}
                    className={`w-full border-b p-4 text-left hover:bg-gray-50 ${selectedPhone === conversation.phone ? "bg-green-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-500">+{conversation.phone}</p>
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm text-gray-600">{conversation.last_message_preview || "Mensaje sin texto"}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(conversation.last_message_at)}</p>
                  </button>
                );
              })}
              {tab === "contacts" && agenda.map((entry) => (
                <button
                  type="button"
                  key={entry.phone}
                  onClick={() => setSelectedPhone(entry.phone)}
                  className={`w-full border-b p-4 text-left transition hover:bg-gray-50 ${normalizePhone(selectedPhone) === entry.phone ? "bg-green-50" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">
                      {entry.title.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{entry.title}</p>
                      <p className="truncate text-sm text-gray-500">{entry.students.join(" · ") || `+${entry.phone}`}</p>
                      <p className="mt-0.5 text-xs text-gray-400">+{entry.phone}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col">
            {!selectedPhone ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
                <div>
                  <span className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-4xl text-green-600"><FaWhatsapp /></span>
                  <p className="font-semibold text-gray-700">Seleccioná un chat o un contacto</p>
                  <p className="mt-1 text-sm">Acá vas a poder ver la conversación y responder.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-lg">{selectedTitle}</h2>
                      <p className="text-sm text-gray-500">+{activePhone}</p>
                      {selectedContacts.length > 0 ? (
                        <p className="mt-1 text-sm text-green-700">
                          Asociado a {selectedContacts.map((contact) => `${contact.nombre} ${contact.apellido}`).join(", ")}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-amber-700">Sin alumno asociado automáticamente</p>
                      )}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      {selectedConversation && (
                        <>
                          <button
                            type="button"
                            onClick={markRead}
                            disabled={busy || selectedConversation.unread_count === 0}
                            className="!flex !w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 sm:!w-auto"
                          >
                            <FaCheckDouble /> Marcar leídos
                          </button>
                          <button
                            type="button"
                            onClick={deleteConversation}
                            disabled={busy}
                            className="!flex !w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 sm:!w-auto"
                          >
                            <FaTrash /> Eliminar
                          </button>
                          <select
                            value={selectedConversation.bot_mode}
                            onChange={(event) => setBotMode(event.target.value)}
                            disabled={busy}
                            className="!w-full min-w-[150px] rounded-lg border px-3 py-2 text-sm sm:!w-auto"
                          >
                            <option value="active">Bot activo</option>
                            <option value="paused">Bot pausado</option>
                            <option value="human">Atención humana</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] p-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
                  {selectedMessages.length === 0 && (
                    <div className="mx-auto mt-16 max-w-sm rounded-xl bg-white/90 p-5 text-center text-sm text-gray-600 shadow-sm">
                      <FaCommentDots className="mx-auto mb-2 text-2xl text-green-600" />
                      {selectedConversation ? "No hay mensajes guardados." : "Este contacto todavía no tiene una conversación iniciada."}
                    </div>
                  )}
                  {selectedMessages.map((message) => {
                    const outbound = message.payload?._direction === "outbound";
                    const imageUrl = message.media_id ? mediaUrls[message.media_id] : null;
                    return (
                      <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg p-2.5 shadow-sm ${outbound ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}>
                          {message.message_type === "image" && (
                            imageUrl ? (
                              <a href={imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-gray-100">
                                <img src={imageUrl} alt={message.text_body || "Imagen recibida por WhatsApp"} className="max-h-80 w-auto max-w-full object-contain" />
                              </a>
                            ) : (
                              <div className="flex h-40 min-w-56 items-center justify-center rounded-md bg-gray-100 text-sm text-gray-500">
                                <FaImage className="mr-2" /> Cargando imagen…
                              </div>
                            )
                          )}
                          {(message.text_body || message.message_type !== "image") && (
                            <p className={`whitespace-pre-wrap px-1 text-sm ${message.message_type === "image" ? "mt-2" : ""}`}>
                              {message.text_body || `[${message.message_type}]`}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center justify-end gap-2 px-1 text-[11px] text-gray-400">
                            <span>{formatDate(message.received_at)}</span>
                            {outbound && <FaCheckDouble className="text-sky-500" title="Enviado desde WhatsApp Business" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 border-t bg-gray-100 p-3">
                  <button type="button" disabled className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !p-0 text-gray-400" title="Adjuntar archivo"><FaPaperclip /></button>
                  <button type="button" disabled className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !p-0 text-gray-400" title="Enviar imagen"><FaImage /></button>
                  <input disabled placeholder="La respuesta desde la bandeja estará disponible en el próximo paso" className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500" />
                  <button type="button" disabled className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full bg-green-600 !p-0 text-white opacity-50" aria-label="Enviar"><FaPaperPlane /></button>
                </div>
              </>
            )}
          </section>

          <aside className="hidden border-l bg-gray-50 xl:block">
            {!selectedPhone ? (
              <p className="p-6 text-center text-sm text-gray-500">Seleccioná un contacto para ver su información.</p>
            ) : (
              <div>
                <div className="border-b bg-white p-6 text-center">
                  <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-3xl font-bold text-green-700">
                    {(selectedTitle || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <h3 className="mt-3 font-bold text-gray-900">{selectedTitle}</h3>
                  <p className="mt-1 text-sm text-gray-500">+{activePhone}</p>
                </div>
                <div className="space-y-5 p-5 text-sm">
                  <div>
                    <p className="mb-2 flex items-center gap-2 font-semibold text-gray-700"><FaUser className="text-green-600" /> Alumnos relacionados</p>
                    {selectedContacts.length === 0 ? <p className="text-gray-500">Sin alumnos asociados.</p> : selectedContacts.map((contact) => (
                      <div key={contact.id} className="mb-2 rounded-lg border bg-white p-3">
                        <p className="font-semibold">{`${contact.nombre || ""} ${contact.apellido || ""}`.trim()}</p>
                        {contact.responsable && <p className="mt-1 text-xs text-gray-500">Responsable: {contact.responsable}</p>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-2 font-semibold text-gray-700"><FaAddressBook className="text-green-600" /> Matrículas activas</p>
                    {selectedEnrollments.length === 0 ? <p className="text-gray-500">Sin matrículas activas.</p> : selectedEnrollments.map((enrollment) => (
                      <div key={enrollment.id} className="mb-2 rounded-lg border bg-white p-3">
                        <p className="font-semibold">{enrollment.curso_nombre || "Curso"}</p>
                        <p className="mt-1 text-xs text-gray-500">{[enrollment.sede, enrollment.dia, enrollment.hora].filter(Boolean).join(" · ")}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-white p-3 text-gray-600"><FaPhoneAlt className="text-green-600" /> +{activePhone}</div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "simulator" && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold text-lg flex items-center gap-2"><FaRobot className="text-green-600" /> Configuración de prueba</h2>
            <label className="mt-4 block text-sm font-semibold">Teléfono a simular</label>
            <input
              value={simPhone}
              onChange={(event) => setSimPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="3412153057"
            />
            <button
              type="button"
              onClick={startSimulation}
              disabled={busy || !simPhone.trim()}
              className="mt-3 !flex !w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <FaPlay /> Iniciar conversación
            </button>
            <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold">Contexto encontrado</p>
              {!simContext && <p className="mt-1 text-gray-500">Iniciá una conversación para consultar.</p>}
              {simContext && (
                <>
                  <p className="mt-1">Alumnos: <strong>{simContext.contacts?.length || 0}</strong></p>
                  <p>Matrículas activas: <strong>{simContext.enrollments?.length || 0}</strong></p>
                </>
              )}
            </div>
          </aside>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border bg-[#efeae2] shadow-sm">
            <div className="flex items-center gap-3 bg-[#075e54] p-4 text-white">
              <div className="rounded-full bg-white/20 p-2"><FaRobot /></div>
              <div>
                <h2 className="font-bold">Asistente de Plugin Robótica</h2>
                <p className="text-xs text-green-100">Simulación local · no envía mensajes</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {simLog.length === 0 && (
                <div className="mx-auto mt-20 max-w-sm rounded-xl bg-white/80 p-5 text-center text-sm text-gray-600 shadow-sm">
                  Ingresá un teléfono y comenzá la simulación para probar el menú del bot.
                </div>
              )}
              {simLog.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-xl p-3 text-sm shadow-sm ${item.role === "user" ? "bg-[#d9fdd3]" : "bg-white"}`}>
                    <p className="whitespace-pre-wrap">{item.text}</p>
                  </div>
                </div>
              ))}
              {simOptions.length > 0 && (
                <div className="ml-0 max-w-sm space-y-2">
                  {simOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => simulate(option.id)}
                      disabled={busy}
                      className="block !w-full rounded-lg border border-green-200 bg-white px-4 py-2 text-left text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50"
                    >
                      {option.id}. {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                simulate(simInput);
              }}
              className="flex gap-2 border-t bg-gray-100 p-3"
            >
              <input
                value={simInput}
                onChange={(event) => setSimInput(event.target.value)}
                placeholder="Escribí una respuesta de prueba"
                className="min-w-0 flex-1 rounded-full border px-4 py-2"
              />
              <button
                type="submit"
                disabled={busy || !simInput.trim()}
                className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full bg-green-600 !p-0 text-white disabled:opacity-50"
                aria-label="Enviar en simulador"
              >
                <FaPaperPlane />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
