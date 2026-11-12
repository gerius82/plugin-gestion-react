import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaAddressBook,
  FaArrowLeft,
  FaCheckDouble,
  FaCheckCircle,
  FaCommentDots,
  FaFilePdf,
  FaImage,
  FaMoneyBillWave,
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
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const argentinaDateKey = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

const formatTime = (value) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date(value));

const formatMessageDate = (value) => {
  if (!value) return "";
  if (argentinaDateKey(value) === argentinaDateKey(new Date())) return formatTime(value);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
};

const formatConversationDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (argentinaDateKey(date) === argentinaDateKey(now)) return formatTime(date);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (argentinaDateKey(date) === argentinaDateKey(yesterday)) return "ayer";
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
    }).format(date).replace(".", "");
  }
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

const contactInitials = (value) => String(value || "")
  .replace(/\([^)]*\)/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.slice(0, 1).toUpperCase())
  .join("") || "?";

const botModeLabel = {
  active: "Bot activo",
  paused: "Bot pausado",
  human: "Atención humana",
};

const friendlyMessageText = (value, type) => {
  if (value) return value;
  if (type === "unsupported") return "Mensaje no compatible. Ver en WhatsApp Business.";
  if (type === "sticker") return "Sticker";
  if (type === "audio") return "Audio";
  if (type === "document") return "PDF";
  if (type === "image") return "Imagen";
  return `[${type}]`;
};

const friendlyPreview = (value) => {
  if (value === "[unsupported]") return "Mensaje no compatible. Ver en WhatsApp Business.";
  if (value === "[sticker]") return "Sticker";
  if (value === "[audio]") return "Audio";
  if (value === "[document]") return "PDF";
  if (value === "[image]") return "Imagen";
  return value || "Mensaje sin texto";
};

const renderWhatsAppText = (value) => {
  const text = String(value || "");
  const parts = text.split(/(```[\s\S]*?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      return <code key={index} className="rounded bg-black/5 px-1 font-mono text-[0.95em]">{part.slice(3, -3)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
      return <del key={index}>{part.slice(1, -1)}</del>;
    }
    return part;
  });
};

const parseArgentineAmount = (value) => {
  let text = String(value || "").replace(/[^0-9.,]/g, "");
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
};

const extractReceiptData = (ocrText) => {
  const text = String(ocrText || "").replace(/\s+/g, " ").trim();
  const lines = String(ocrText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amountPattern = /(?:\$|ars\s*)?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?|\d{4,8}(?:,\d{2})?)/i;
  const priorityLines = lines.filter((line) => /importe|monto|total|transferid|enviaste|pagaste/i.test(line));
  const amountNearLabel = text.match(/(?:importe|monto|total|transferid[oa]?|enviaste|pagaste)[^$0-9]{0,35}(?:\$|ars\s*)?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?|\d{4,8}(?:,\d{2})?)/i);
  let amount = parseArgentineAmount(amountNearLabel?.[1]);
  for (const line of amount ? [] : [...priorityLines, ...lines.filter((item) => /\$|ars/i.test(item))]) {
    const match = line.match(amountPattern);
    amount = parseArgentineAmount(match?.[1]);
    if (amount) break;
  }
  const date = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/)?.[1] || "";
  const operationId = lines.find((line) => /operaci[oó]n|comprobante|referencia|transacci[oó]n/i.test(line))
    ?.replace(/^.*?(?:operaci[oó]n|comprobante|referencia|transacci[oó]n)\s*[:#-]?\s*/i, "")
    .slice(0, 100) || "";
  return { amount, date, operationId };
};

const readReceiptText = async (mediaUrl, messageType) => {
  if (messageType === "document") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument(mediaUrl).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const embeddedText = textContent.items.map((item) => item.str || "").join(" ").trim();
    if (embeddedText.length >= 30) return embeddedText;
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa");
    try {
      return (await worker.recognize(canvas)).data.text || "";
    } finally {
      await worker.terminate();
    }
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa");
  try {
    return (await worker.recognize(mediaUrl)).data.text || "";
  } finally {
    await worker.terminate();
  }
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
  const [selectedPhone, setSelectedPhone] = useState(() => new URLSearchParams(window.location.search).get("phone") || "");
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentBusyId, setPaymentBusyId] = useState("");
  const autoPaymentMessageId = useRef(new URLSearchParams(window.location.search).get("analyze") || "");
  const autoPaymentStarted = useRef(false);
  const [config, setConfig] = useState(null);
  const [mediaUrls, setMediaUrls] = useState({});
  const [replyText, setReplyText] = useState("");

  const [simPhone, setSimPhone] = useState("3412153057");
  const [simInput, setSimInput] = useState("");
  const [simLog, setSimLog] = useState([]);
  const [simOptions, setSimOptions] = useState([]);
  const [simContext, setSimContext] = useState(null);
  const [simStep, setSimStep] = useState("idle");

  useEffect(() => {
    fetch("/config.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración.");
        return response.json();
      })
      .then(setConfig)
      .catch((currentError) => setError(currentError.message));
  }, []);

  const api = async (body, query = "") => {
    if (!config) throw new Error("La configuración todavía no está disponible.");
    const client = await getSupabaseAuthClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("La sesión administrativa venció.");
    const response = await fetch(`${config.supabaseUrl}/functions/v1/whatsapp-admin${query}`, {
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

  const loadInbox = async (silent = false) => {
    if (!config) return;
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      const result = await api(undefined, silent ? "?updates=1" : "");
      setData((current) => silent
        ? { ...current, conversations: result.conversations || [], messages: result.messages || [] }
        : result);
      setSelectedPhone((current) => current || result.conversations?.[0]?.phone || "");
    } catch (currentError) {
      if (!silent) setError(currentError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const refresh = () => {
      if (document.visibilityState === "visible") loadInbox(true);
    };
    const intervalId = window.setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [config]);

  useEffect(() => {
    const missingIds = [...new Set(
      (data.messages || [])
        .filter((message) => ["image", "document", "sticker", "audio"].includes(message.message_type) && message.media_id && !mediaUrls[message.media_id])
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
      if (unreadOnly && Number(conversation.unread_count || 0) === 0) return false;
      if (!query) return true;
      const contacts = contactsByPhone.get(normalizePhone(conversation.phone)) || [];
      const searchable = [
        conversation.phone,
        conversation.contact_name,
        ...contacts.flatMap((contact) => [contact.nombre, contact.apellido, contact.responsable]),
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [contactsByPhone, data.conversations, filter, unreadOnly]);

  const unreadConversationsCount = useMemo(
    () => (data.conversations || []).filter((conversation) => Number(conversation.unread_count || 0) > 0).length,
    [data.conversations],
  );

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

  useEffect(() => {
    if (!selectedConversation || selectedConversation.unread_count === 0) return;
    let cancelled = false;
    api({ action: "mark_read", phone: selectedConversation.phone })
      .then(() => {
        if (cancelled) return;
        setData((current) => ({
          ...current,
          conversations: (current.conversations || []).map((conversation) =>
            conversation.phone === selectedConversation.phone
              ? { ...conversation, unread_count: 0 }
              : conversation,
          ),
          messages: (current.messages || []).map((message) =>
            message.from_phone === selectedConversation.phone && message.status === "unread"
              ? { ...message, status: "read" }
              : message,
          ),
        }));
      })
      .catch((currentError) => {
        if (!cancelled) setError(currentError.message);
      });
    return () => { cancelled = true; };
  }, [selectedConversation?.phone, selectedConversation?.unread_count]);

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

  const sendReply = async () => {
    const text = replyText.trim();
    if (!selectedConversation || !text || busy) return;
    try {
      setBusy(true);
      setError("");
      await api({ action: "send_message", phone: activePhone, text });
      setReplyText("");
      await loadInbox();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateMessageAnalysis = (messageId, analysis) => {
    setData((current) => ({
      ...current,
      messages: (current.messages || []).map((message) =>
        String(message.id) === String(messageId)
          ? { ...message, payload: { ...(message.payload || {}), payment_analysis: analysis } }
          : message
      ),
    }));
  };

  const analyzePayment = async (message, mediaUrl) => {
    if (!mediaUrl || paymentBusyId) return;
    try {
      setPaymentBusyId(String(message.id));
      setError("");
      const text = await readReceiptText(mediaUrl, message.message_type);
      const receipt = extractReceiptData(text);
      if (!receipt.amount) {
        throw new Error("No pude detectar el importe. Probá con una imagen más nítida o revisalo manualmente.");
      }
      const result = await api({
        action: "analyze_payment_text",
        messageId: message.id,
        amount: receipt.amount,
        date: receipt.date,
        operationId: receipt.operationId,
      });
      updateMessageAnalysis(message.id, result.analysis);
    } catch (currentError) {
      setError(currentError.message || String(currentError));
    } finally {
      setPaymentBusyId("");
    }
  };

  const confirmPayment = async (message, candidateId) => {
    if (paymentBusyId) return;
    try {
      setPaymentBusyId(String(message.id));
      setError("");
      const result = await api({ action: "confirm_payment", messageId: message.id, candidateId });
      updateMessageAnalysis(message.id, result.analysis);
      await loadInbox(true);
    } catch (currentError) {
      setError(currentError.message || String(currentError));
    } finally {
      setPaymentBusyId("");
    }
  };

  useEffect(() => {
    const messageId = autoPaymentMessageId.current;
    if (!messageId || autoPaymentStarted.current || paymentBusyId) return;
    const message = (data.messages || []).find((item) => String(item.id) === String(messageId));
    if (!message) return;
    if (message.payload?.payment_analysis) {
      autoPaymentStarted.current = true;
      return;
    }
    const mediaUrl = message.media_id ? mediaUrls[message.media_id] : null;
    if (!mediaUrl) return;
    autoPaymentStarted.current = true;
    analyzePayment(message, mediaUrl);
  }, [data.messages, mediaUrls, paymentBusyId]);

  const simulate = async (input, visibleText = "", directUrl = "") => {
    const cleanInput = String(input || "").trim();
    if (!cleanInput || !simPhone.trim()) return;
    const typedOption = !visibleText ? simOptions.find((option) => option.id === cleanInput) : null;
    const optionUrl = directUrl || typedOption?.url;
    if (optionUrl) {
      window.open(optionUrl, "_blank", "noopener,noreferrer");
      setSimInput("");
      return;
    }
    const requestInput = typedOption?.action || cleanInput;
    const displayedInput = visibleText || typedOption?.label || cleanInput;
    try {
      setBusy(true);
      setError("");
      setSimLog((current) => [...current, { role: "user", text: displayedInput }]);
      setSimInput("");
      const result = await api({ action: "simulate", phone: simPhone, input: requestInput });
      setSimLog((current) => [...current, { role: "bot", text: result.message }]);
      setSimOptions(result.options || []);
      setSimContext(result.context || null);
      setSimStep(result.nextStep || "menu");
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
    setSimStep("menu");
    simulate("Hola");
  };

  return (
    <div className="w-full max-w-7xl mx-auto -mt-2 sm:mt-0">
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/menu-gestion")}
            className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 !bg-gray-50 !p-0 text-gray-700 transition hover:!bg-gray-100"
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
          onClick={() => loadInbox()}
          disabled={loading}
          className="!flex !w-auto shrink-0 items-center gap-2 rounded-lg border border-gray-200 !bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:!bg-gray-50 disabled:opacity-50 sm:px-4"
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={`!w-full rounded-lg px-4 py-2.5 font-semibold transition ${tab === "inbox" ? "!bg-green-600 !text-white shadow-sm hover:!bg-green-700" : "!bg-transparent !text-gray-700 hover:!bg-gray-100"}`}
        >
          <FaCommentDots className="inline mr-2" /> Bandeja
        </button>
        <button
          type="button"
          onClick={() => setTab("contacts")}
          className={`!w-full rounded-lg px-3 py-2.5 font-semibold transition ${tab === "contacts" ? "!bg-green-600 !text-white shadow-sm hover:!bg-green-700" : "!bg-transparent !text-gray-700 hover:!bg-gray-100"}`}
        >
          <FaAddressBook className="inline mr-2" /> Agenda
        </button>
        <button
          type="button"
          onClick={() => setTab("simulator")}
          className={`!w-full rounded-lg px-4 py-2.5 font-semibold transition ${tab === "simulator" ? "!bg-green-600 !text-white shadow-sm hover:!bg-green-700" : "!bg-transparent !text-gray-700 hover:!bg-gray-100"}`}
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
              {tab === "inbox" && (
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-200/70 p-1">
                  <button
                    type="button"
                    onClick={() => setUnreadOnly(false)}
                    className={`!w-full rounded-md px-3 py-1.5 text-xs font-semibold transition ${!unreadOnly ? "!bg-white !text-gray-900 shadow-sm hover:!bg-gray-100" : "!bg-transparent !text-gray-600 hover:!bg-gray-100 hover:!text-gray-900"}`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnreadOnly(true)}
                    className={`!flex !w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${unreadOnly ? "!bg-white !text-gray-900 shadow-sm hover:!bg-gray-100" : "!bg-transparent !text-gray-600 hover:!bg-gray-100 hover:!text-gray-900"}`}
                  >
                    No leídos
                    {unreadConversationsCount > 0 && (
                      <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unreadConversationsCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading && <p className="p-5 text-sm text-gray-500">Cargando…</p>}
              {!loading && tab === "inbox" && conversations.length === 0 && (
                <p className="p-5 text-sm text-gray-500">
                  {unreadOnly ? "No hay conversaciones sin leer." : "Todavía no hay conversaciones para mostrar."}
                </p>
              )}
              {!loading && tab === "contacts" && agenda.length === 0 && (
                <p className="p-5 text-sm text-gray-500">No encontramos contactos con teléfono.</p>
              )}
              {tab === "inbox" && conversations.map((conversation) => {
                const matches = contactsByPhone.get(normalizePhone(conversation.phone)) || [];
                const title = matches.length
                  ? matches.map((contact) => `${contact.nombre || ""} ${contact.apellido || ""}`.trim()).join(" / ")
                  : conversation.contact_name || conversation.phone;
                const conversationMessages = messagesByPhone.get(conversation.phone) || [];
                const lastMessage = conversationMessages[conversationMessages.length - 1];
                const lastOutbound = lastMessage?.payload?._direction === "outbound";
                const unread = Number(conversation.unread_count || 0);
                return (
                  <button
                    type="button"
                    key={conversation.phone}
                    onClick={() => setSelectedPhone(conversation.phone)}
                    className={`!w-full border-b !p-0 text-left transition ${selectedPhone === conversation.phone ? "!bg-[#f0f2f5] hover:!bg-[#e9edef]" : "!bg-white hover:!bg-[#f5f6f6]"}`}
                  >
                    <div className="flex min-h-[72px] items-center gap-3 px-3 py-2.5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-100 text-base font-semibold text-sky-700">
                        {contactInitials(title)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`truncate text-[15px] leading-5 text-gray-900 ${unread ? "font-semibold" : "font-medium"}`}>{title}</p>
                          <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-green-600" : "text-gray-500"}`}>
                            {formatConversationDate(conversation.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5">
                          {lastOutbound && <FaCheckDouble className="shrink-0 text-[13px] text-sky-500" title="Mensaje enviado" />}
                          <p className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${unread ? "font-medium text-gray-800" : "font-normal text-gray-500"}`}>
                            {renderWhatsAppText(friendlyPreview(conversation.last_message_preview))}
                          </p>
                          {unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {tab === "contacts" && agenda.map((entry) => (
                <button
                  type="button"
                  key={entry.phone}
                  onClick={() => setSelectedPhone(entry.phone)}
                  className={`w-full border-b p-4 text-left transition ${normalizePhone(selectedPhone) === entry.phone ? "!bg-green-50 hover:!bg-green-100" : "!bg-white hover:!bg-gray-50"}`}
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
                            onClick={deleteConversation}
                            disabled={busy}
                            className="!flex !w-full items-center justify-center gap-2 rounded-lg border border-red-200 !bg-white px-3 py-2 text-sm text-red-700 hover:!bg-red-50 disabled:opacity-50 sm:!w-auto"
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
                    const mediaUrl = message.media_id ? mediaUrls[message.media_id] : null;
                    const sticker = message.message_type === "sticker";
                    const paymentAnalysis = message.payload?.payment_analysis;
                    const canAnalyzePayment = !outbound && ["image", "document"].includes(message.message_type);
                    const analyzingPayment = String(paymentBusyId) === String(message.id);
                    return (
                      <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg ${sticker ? "bg-transparent p-0" : `p-2.5 shadow-sm ${outbound ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}`}>
                          {message.message_type === "image" && (
                            mediaUrl ? (
                              <a href={mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-gray-100">
                                <img src={mediaUrl} alt={message.text_body || "Imagen recibida por WhatsApp"} className="max-h-80 w-auto max-w-full object-contain" />
                              </a>
                            ) : (
                              <div className="flex h-40 min-w-56 items-center justify-center rounded-md bg-gray-100 text-sm text-gray-500">
                                <FaImage className="mr-2" /> Cargando imagen…
                              </div>
                            )
                          )}
                          {message.message_type === "sticker" && (
                            mediaUrl ? (
                              <img src={mediaUrl} alt="Sticker recibido por WhatsApp" className="max-h-40 max-w-40 object-contain" />
                            ) : (
                              <div className="flex h-28 w-28 items-center justify-center rounded-md bg-white/50 text-xs text-gray-500">
                                Cargando sticker…
                              </div>
                            )
                          )}
                          {message.message_type === "audio" && (
                            mediaUrl ? (
                              <audio controls preload="metadata" src={mediaUrl} className="h-10 w-64 max-w-full" aria-label="Audio recibido por WhatsApp" />
                            ) : (
                              <div className="flex h-10 min-w-56 items-center justify-center rounded-full bg-white/70 px-4 text-sm text-gray-500">
                                Cargando audio…
                              </div>
                            )
                          )}
                          {message.message_type === "document" && (
                            mediaUrl ? (
                              <div className="relative aspect-[210/297] w-64 max-w-full overflow-hidden rounded-md border border-gray-200 bg-white">
                                <div className="absolute inset-0 overflow-hidden">
                                  <iframe
                                    src={`${mediaUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                                    title="Vista previa del PDF"
                                    scrolling="no"
                                    className="h-full w-[calc(100%+18px)] pointer-events-none"
                                  />
                                </div>
                                <a
                                  href={mediaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="absolute inset-0"
                                  aria-label="Abrir PDF en una pestaña nueva"
                                />
                              </div>
                            ) : (
                              <div className="flex min-w-56 items-center gap-3 rounded-lg bg-white/80 p-3 text-sm text-gray-500">
                                <FaFilePdf className="text-xl text-red-500" /> Cargando PDF…
                              </div>
                            )
                          )}
                          {(message.text_body || !["image", "document", "sticker", "audio"].includes(message.message_type)) && (
                            <p className={`whitespace-pre-wrap px-1 text-sm ${["image", "document"].includes(message.message_type) ? "mt-2" : ""}`}>
                              {renderWhatsAppText(friendlyMessageText(message.text_body, message.message_type))}
                            </p>
                          )}
                          {canAnalyzePayment && !paymentAnalysis && (
                            <button
                              type="button"
                              onClick={() => analyzePayment(message, mediaUrl)}
                              disabled={!mediaUrl || !!paymentBusyId}
                              className="mt-2 !flex !w-full items-center justify-center gap-2 rounded-md border border-emerald-200 !bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:!bg-emerald-100 disabled:opacity-50"
                            >
                              <FaMoneyBillWave /> {analyzingPayment ? "Analizando comprobante…" : "Analizar como pago"}
                            </button>
                          )}
                          {paymentAnalysis && (
                            <div className={`mt-2 rounded-md border p-3 text-xs ${paymentAnalysis.status === "confirmed" ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                              <p className="flex items-center gap-2 font-bold text-gray-800">
                                {paymentAnalysis.status === "confirmed" ? <FaCheckCircle className="text-green-600" /> : <FaMoneyBillWave className="text-amber-700" />}
                                {paymentAnalysis.status === "confirmed" ? "Pago registrado" : "Posible pago detectado"}
                              </p>
                              <p className="mt-1 font-semibold text-gray-800">
                                ${Number(paymentAnalysis.receipt?.amount || 0).toLocaleString("es-AR")}
                              </p>
                              {paymentAnalysis.status === "no_match" && (
                                <p className="mt-1 text-amber-800">El importe no coincide con una combinación pendiente. Revisalo manualmente.</p>
                              )}
                              {paymentAnalysis.status !== "confirmed" && (paymentAnalysis.candidates || []).map((candidate) => (
                                <div key={candidate.id} className="mt-2 rounded-md border border-amber-200 bg-white p-2">
                                  <p className="leading-relaxed text-gray-700">{candidate.detail}</p>
                                  <button
                                    type="button"
                                    onClick={() => confirmPayment(message, candidate.id)}
                                    disabled={!!paymentBusyId}
                                    className="mt-2 !flex !w-full items-center justify-center gap-2 rounded-md !bg-green-600 px-3 py-2 font-semibold text-white hover:!bg-green-700 disabled:opacity-50"
                                  >
                                    <FaCheckCircle /> {analyzingPayment ? "Confirmando…" : "Confirmar pago"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className={`mt-1.5 flex items-center justify-end gap-2 px-1 text-[11px] ${sticker ? "text-gray-500" : "text-gray-400"}`}>
                            <span>{formatMessageDate(message.received_at)}</span>
                            {outbound && <FaCheckDouble className="text-sky-500" title="Enviado desde WhatsApp Business" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendReply();
                  }}
                  className="flex items-center gap-2 border-t bg-gray-100 p-3"
                >
                  <button type="button" disabled className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !bg-transparent !p-0 text-gray-400 hover:!bg-transparent" title="Adjuntar archivo"><FaPaperclip /></button>
                  <button type="button" disabled className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !bg-transparent !p-0 text-gray-400 hover:!bg-transparent" title="Enviar imagen"><FaImage /></button>
                  <input
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    disabled={busy || !selectedConversation}
                    placeholder={selectedConversation ? "Escribí un mensaje" : "Este contacto todavía no inició una conversación"}
                    className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={busy || !selectedConversation || !replyText.trim()}
                    className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !bg-green-600 !p-0 text-white hover:!bg-green-700 disabled:opacity-40"
                    aria-label="Enviar"
                  >
                    <FaPaperPlane />
                  </button>
                </form>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold"><FaRobot className="text-green-600" /> Bot de prueba</h2>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">NO ENVÍA</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Probá el recorrido con cualquier teléfono de la agenda. Consulta datos reales, pero todas las respuestas quedan dentro del simulador.</p>
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
              className="mt-3 !flex !w-full items-center justify-center gap-2 rounded-lg !bg-green-600 px-4 py-2.5 font-semibold text-white hover:!bg-green-700 disabled:opacity-50"
            >
              <FaPlay /> {simLog.length ? "Reiniciar conversación" : "Iniciar conversación"}
            </button>
            <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold">Contexto encontrado</p>
              {!simContext && <p className="mt-1 text-gray-500">Iniciá una conversación para consultar.</p>}
              {simContext && (
                <>
                  <p className="mt-1">Alumnos: <strong>{simContext.contacts?.length || 0}</strong></p>
                  <p>Matrículas activas: <strong>{simContext.enrollments?.length || 0}</strong></p>
                  <p className="mt-2 border-t pt-2">Estado: <strong className={simStep === "human" ? "text-amber-700" : "text-green-700"}>{simStep === "human" ? "Derivado a una persona" : "Bot atendiendo"}</strong></p>
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
                    <p className="whitespace-pre-wrap">{renderWhatsAppText(item.text)}</p>
                  </div>
                </div>
              ))}
              {simOptions.length > 0 && (
                <div className="ml-0 max-w-sm space-y-2">
                  {simOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => simulate(option.action || option.id, option.label, option.url)}
                      disabled={busy}
                      className="block !w-full rounded-lg border border-green-200 !bg-white px-4 py-2 text-left text-sm font-semibold text-green-700 shadow-sm hover:!bg-green-50"
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
                className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full !bg-green-600 !p-0 text-white hover:!bg-green-700 disabled:opacity-50"
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
