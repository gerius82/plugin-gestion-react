import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckDouble,
  FaCommentDots,
  FaPaperPlane,
  FaPlay,
  FaRobot,
  FaSyncAlt,
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

  const selectedConversation = (data.conversations || []).find(
    (conversation) => conversation.phone === selectedPhone,
  );
  const selectedMessages = messagesByPhone.get(selectedPhone) || [];
  const selectedContacts = contactsByPhone.get(normalizePhone(selectedPhone)) || [];

  const markRead = async () => {
    if (!selectedPhone) return;
    try {
      setBusy(true);
      await api({ action: "mark_read", phone: selectedPhone });
      await loadInbox();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const setBotMode = async (mode) => {
    if (!selectedPhone) return;
    try {
      setBusy(true);
      await api({ action: "set_bot_mode", phone: selectedPhone, mode });
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
    <div className="w-full max-w-6xl mx-auto mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/menu-gestion")}
            className="rounded-full bg-white border p-3 text-gray-700 shadow-sm hover:bg-gray-50"
            aria-label="Volver"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaWhatsapp className="text-green-600" /> Centro de WhatsApp
            </h1>
            <p className="text-sm text-gray-600">Bandeja protegida y laboratorio del bot</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadInbox}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Modo seguro:</strong> los envíos reales están bloqueados. La bandeja solo lee y clasifica;
        el laboratorio genera respuestas simuladas sin contactar a ninguna familia.
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={`rounded-lg px-4 py-2 font-semibold ${tab === "inbox" ? "bg-green-600 text-white" : "bg-white border text-gray-700"}`}
        >
          <FaCommentDots className="inline mr-2" /> Bandeja
        </button>
        <button
          type="button"
          onClick={() => setTab("simulator")}
          className={`rounded-lg px-4 py-2 font-semibold ${tab === "simulator" ? "bg-green-600 text-white" : "bg-white border text-gray-700"}`}
        >
          <FaRobot className="inline mr-2" /> Simulador del bot
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{error}</div>}

      {tab === "inbox" && (
        <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[340px_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <div className="p-3 border-b">
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Buscar nombre o teléfono"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading && <p className="p-5 text-sm text-gray-500">Cargando conversaciones…</p>}
              {!loading && conversations.length === 0 && (
                <p className="p-5 text-sm text-gray-500">Todavía no hay conversaciones para mostrar.</p>
              )}
              {conversations.map((conversation) => {
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
            </div>
          </aside>

          <section className="flex min-w-0 flex-col">
            {!selectedConversation ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
                Seleccioná una conversación.
              </div>
            ) : (
              <>
                <div className="border-b p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-lg">{selectedConversation.contact_name || `+${selectedPhone}`}</h2>
                      <p className="text-sm text-gray-500">+{selectedPhone}</p>
                      {selectedContacts.length > 0 ? (
                        <p className="mt-1 text-sm text-green-700">
                          Asociado a {selectedContacts.map((contact) => `${contact.nombre} ${contact.apellido}`).join(", ")}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-amber-700">Sin alumno asociado automáticamente</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={markRead}
                        disabled={busy || selectedConversation.unread_count === 0}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        <FaCheckDouble /> Marcar leídos
                      </button>
                      <select
                        value={selectedConversation.bot_mode}
                        onChange={(event) => setBotMode(event.target.value)}
                        disabled={busy}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        <option value="active">Bot activo</option>
                        <option value="paused">Bot pausado</option>
                        <option value="human">Atención humana</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
                  {selectedMessages.length === 0 && <p className="text-sm text-gray-500">No hay mensajes guardados.</p>}
                  {selectedMessages.map((message) => (
                    <div key={message.id} className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm border">
                      <p className="whitespace-pre-wrap text-sm">{message.text_body || `[${message.message_type}]`}</p>
                      <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-gray-400">
                        <span>{message.status}</span>
                        <span>{formatDate(message.received_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t bg-gray-100 p-3 text-center text-sm text-gray-500">
                  Envíos desactivados hasta completar aprobación y coexistencia.
                </div>
              </>
            )}
          </section>
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
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
                      className="block w-full rounded-lg border border-green-200 bg-white px-4 py-2 text-left text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50"
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white disabled:opacity-50"
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
