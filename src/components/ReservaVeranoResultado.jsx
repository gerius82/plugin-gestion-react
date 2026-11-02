import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaClock, FaExclamationCircle, FaSyncAlt } from "react-icons/fa";

const content = {
  aprobado: { icon: FaCheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200", title: "¡Reserva abonada!", text: "El pago de $10.000 fue confirmado y quedó asociado a la inscripción." },
  pendiente: { icon: FaClock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", title: "Pago pendiente", text: "Mercado Pago todavía está procesando el pago. Podés actualizar el estado en unos minutos." },
  creando: { icon: FaClock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", title: "Comprobando el pago", text: "Estamos esperando la confirmación de Mercado Pago." },
  rechazado: { icon: FaExclamationCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "El pago no fue aprobado", text: "La inscripción está guardada, pero la reserva todavía no fue abonada." },
  cancelado: { icon: FaExclamationCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "Pago cancelado", text: "La inscripción está guardada, pero la reserva todavía no fue abonada." },
  vencido: { icon: FaExclamationCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "El pago venció", text: "La inscripción está guardada, pero deberás generar un nuevo pago para reservar el cupo." },
  error: { icon: FaExclamationCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "No pudimos confirmar el pago", text: "La inscripción está guardada. Comunicate con PLUGIN si el importe fue debitado." },
};

export default function ReservaVeranoResultado() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [config, setConfig] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/config.json").then((response) => response.json()).then(setConfig).catch(() => setError("No se pudo cargar la configuración."));
  }, []);

  const load = async () => {
    if (!config || !token) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${config.supabaseUrl}/functions/v1/mercadopago-reserva`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
        body: JSON.stringify({ action: "status", token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo consultar el pago.");
      setReservation(result.reservation);
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (config) load(); }, [config]);

  const state = reservation?.estado || "creando";
  const view = content[state] || content.error;
  const Icon = view.icon;

  return (
    <main className="w-full max-w-xl rounded-2xl border bg-white p-6 text-center shadow-lg">
      {loading ? (
        <div className="py-10 text-gray-600"><FaSyncAlt className="mx-auto mb-3 animate-spin text-3xl" />Comprobando el pago…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
      ) : (
        <div className={`rounded-xl border p-6 ${view.bg}`}>
          <Icon className={`mx-auto text-5xl ${view.color}`} />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{view.title}</h1>
          <p className="mt-2 text-gray-700">{view.text}</p>
          <p className="mt-3 text-sm text-gray-500">Reserva: $10.000 · Taller de Verano 2027</p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {!loading && !error && state !== "aprobado" && <button type="button" onClick={load} className="!w-auto rounded-lg !bg-sky-500 px-5 py-2.5 font-semibold text-white hover:!bg-sky-600"><FaSyncAlt className="mr-2 inline" />Actualizar estado</button>}
        <button type="button" onClick={() => navigate("/menu-padres")} className="!w-auto rounded-lg !bg-gray-700 px-5 py-2.5 font-semibold text-white hover:!bg-gray-800">Volver al menú</button>
      </div>
    </main>
  );
}
