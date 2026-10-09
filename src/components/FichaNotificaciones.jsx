import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const DESTINOS = [
  { value: "/menu-gestion", label: "Menú de Gestión" },
  { value: "/alumnos-menu", label: "Alumnos" },
  { value: "/asistencia-menu", label: "Asistencia" },
  { value: "/pagos-menu", label: "Pagos" },
  { value: "/cumples-alumnos", label: "Cumples alumnos" },
  { value: "/menu-resumen", label: "Resúmenes y gastos" },
];

const ETIQUETAS = {
  new_student: "Nueva inscripción",
  payment_received: "Pago recibido",
  attendance_recorded: "Asistencia",
  daily_summary: "Resumen diario",
  birthday_summary: "Cumpleaños",
  custom_notification: "Personalizada",
};

const resumenEvento = (evento) => {
  const payload = evento?.payload || {};
  if (evento.event_type === "custom_notification") return payload.body || "";
  if (evento.event_type === "new_student") return payload.name || "Nuevo alumno";
  if (evento.event_type === "payment_received") {
    return `${payload.payment_method || "Pago"}${payload.amount ? ` · $${Number(payload.amount).toLocaleString("es-AR")}` : ""}`;
  }
  if (evento.event_type === "attendance_recorded") {
    return `${payload.site || "Sede"} · ${payload.shift || "Turno"}`;
  }
  if (evento.event_type === "daily_summary") return `Resumen del ${payload.date || "día"}`;
  if (evento.event_type === "birthday_summary") {
    const cantidad = Array.isArray(payload.birthdays) ? payload.birthdays.length : 0;
    return cantidad ? `${cantidad} cumpleaños` : "Sin cumpleaños";
  }
  return "Notificación";
};

const fechaHora = (valor) => {
  if (!valor) return "";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(valor));
};

export default function FichaNotificaciones() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [codigo, setCodigo] = useState(() => sessionStorage.getItem("plugin-notifications-code") || "");
  const [autorizado, setAutorizado] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    url: "/menu-gestion",
    actionTitle: "Abrir",
  });

  useEffect(() => {
    fetch("/config.json")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setMensaje("No se pudo cargar la configuración."));
  }, []);

  const functionUrl = useMemo(
    () => (config ? `${config.supabaseUrl}/functions/v1/push-notifications` : ""),
    [config]
  );

  const ejecutar = async (body) => {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        apikey: config.supabaseKey,
        "Content-Type": "application/json",
        "x-admin-code": codigo.trim(),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data?.ok === false) throw new Error(data?.error || "No se pudo completar la operación.");
    return data;
  };

  const cargarHistorial = async () => {
    if (!config || !codigo.trim()) {
      setMensaje("Ingresá el código privado.");
      return;
    }
    setCargando(true);
    setMensaje("");
    try {
      const data = await ejecutar({ action: "notification_history" });
      setEventos(data.events || []);
      setAutorizado(true);
      sessionStorage.setItem("plugin-notifications-code", codigo.trim());
    } catch (error) {
      setAutorizado(false);
      setMensaje(error.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (config && codigo.trim()) cargarHistorial();
    // La carga automática se realiza una sola vez al recuperar el código de esta sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const enviar = async (event) => {
    event.preventDefault();
    setCargando(true);
    setMensaje("");
    try {
      await ejecutar({ action: "send_custom_notification", ...form });
      setForm((actual) => ({ ...actual, title: "", body: "" }));
      await cargarHistorial();
      setMensaje("Notificación enviada correctamente.");
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setCargando(false);
    }
  };

  const eliminar = async (evento) => {
    if (!confirm("¿Eliminar esta notificación del historial?")) return;
    setCargando(true);
    setMensaje("");
    try {
      await ejecutar({ action: "delete_notification_event", eventId: evento.id });
      setEventos((actuales) => actuales.filter((item) => item.id !== evento.id));
      setMensaje("Notificación eliminada del historial.");
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 px-4 pb-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <button
          type="button"
          onClick={() => navigate("/menu-gestion")}
          className="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200 text-sm font-medium"
        >
          Volver
        </button>
      </div>

      {!autorizado ? (
        <div className="bg-white rounded-xl shadow p-5 max-w-md mx-auto">
          <label className="block text-sm font-medium mb-2">Código privado</label>
          <input
            type="password"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && cargarHistorial()}
            className="w-full border rounded-lg px-3 py-2"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={cargarHistorial}
            disabled={cargando || !config}
            className="mt-3 w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2"
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6">
          <form onSubmit={enviar} className="bg-white rounded-xl shadow p-5 h-fit">
            <h2 className="text-lg font-semibold mb-4">Crear notificación</h2>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input
              required
              maxLength={80}
              value={form.title}
              onChange={(event) => setForm((actual) => ({ ...actual, title: event.target.value }))}
              className="w-full border rounded-lg px-3 py-2 mb-3"
              placeholder="Ej.: Recordatorio"
            />
            <label className="block text-sm font-medium mb-1">Mensaje</label>
            <textarea
              required
              maxLength={500}
              rows={5}
              value={form.body}
              onChange={(event) => setForm((actual) => ({ ...actual, body: event.target.value }))}
              className="w-full border rounded-lg px-3 py-2 mb-3 resize-y"
              placeholder="Escribí el mensaje que querés recibir..."
            />
            <label className="block text-sm font-medium mb-1">Abrir al tocar</label>
            <select
              value={form.url}
              onChange={(event) => setForm((actual) => ({ ...actual, url: event.target.value }))}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            >
              {DESTINOS.map((destino) => (
                <option key={destino.value} value={destino.value}>{destino.label}</option>
              ))}
            </select>
            <label className="block text-sm font-medium mb-1">Texto del botón</label>
            <input
              maxLength={30}
              value={form.actionTitle}
              onChange={(event) => setForm((actual) => ({ ...actual, actionTitle: event.target.value }))}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5"
            >
              {cargando ? "Enviando..." : "Enviar ahora"}
            </button>
          </form>

          <section className="bg-white rounded-xl shadow p-5 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Historial</h2>
              <button
                type="button"
                onClick={cargarHistorial}
                disabled={cargando}
                className="text-sm px-3 py-1.5 rounded-lg border bg-gray-50 hover:bg-gray-100"
              >
                Actualizar
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Eliminar quita el registro del historial, pero no una notificación que Android ya mostró.
            </p>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {eventos.length === 0 && <p className="text-sm text-gray-500">No hay notificaciones registradas.</p>}
              {eventos.map((evento) => (
                <article key={evento.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{evento.payload?.title || ETIQUETAS[evento.event_type] || evento.event_type}</div>
                      <div className="text-sm text-gray-700 whitespace-pre-line break-words mt-1">{resumenEvento(evento)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminar(evento)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 flex-none"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>{fechaHora(evento.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full border ${evento.status === "sent" ? "bg-green-50 border-green-200 text-green-700" : evento.status === "failed" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                      {evento.status === "sent" ? "Enviada" : evento.status === "failed" ? "Fallida" : "Pendiente"}
                    </span>
                    {evento.error && <span className="text-red-600">{evento.error}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {mensaje && <p className="mt-4 text-center text-sm font-medium text-gray-700">{mensaje}</p>}
    </div>
  );
}
