import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCreditCard, FaSyncAlt } from "react-icons/fa";
import { getSupabaseAuthClient } from "../lib/supabaseAuth";

const labels = {
  creando: "Creando",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  vencido: "Vencido",
  reintegrado: "Reintegrado",
  error: "Error",
};

const badge = {
  aprobado: "bg-green-100 text-green-800",
  pendiente: "bg-amber-100 text-amber-800",
  creando: "bg-amber-100 text-amber-800",
  rechazado: "bg-red-100 text-red-800",
  cancelado: "bg-gray-200 text-gray-700",
  vencido: "bg-gray-200 text-gray-700",
  reintegrado: "bg-purple-100 text-purple-800",
  error: "bg-red-100 text-red-800",
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const dateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default function ReservasVerano() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [rows, setRows] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => { fetch("/config.json").then((response) => response.json()).then(setConfig).catch(() => setError("No se pudo cargar la configuración.")); }, []);

  const load = async () => {
    if (!config) return;
    try {
      setLoading(true); setError("");
      const client = await getSupabaseAuthClient();
      const { data } = await client.auth.getSession();
      const response = await fetch(`${config.supabaseUrl}/functions/v1/mercadopago-reserva`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.supabaseKey, Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ action: "admin-list" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudieron cargar las reservas.");
      setRows(result.reservations || []);
      setConfigured(result.configured === true);
    } catch (currentError) { setError(currentError.message); } finally { setLoading(false); }
  };

  useEffect(() => { if (config) load(); }, [config]);

  const filtered = useMemo(() => rows.filter((row) => !filter || row.estado === filter), [filter, rows]);
  const approved = rows.filter((row) => row.estado === "aprobado");
  const total = approved.reduce((sum, row) => sum + Number(row.monto || 0), 0);

  return (
    <main className="w-full max-w-6xl pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/pagos-menu")} className="!flex !h-10 !w-10 items-center justify-center rounded-full border border-gray-200 !bg-gray-50 !p-0 text-gray-700 hover:!bg-gray-200"><FaArrowLeft /></button>
          <div><h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><FaCreditCard className="text-sky-600" /> Reservas Verano 2027</h1><p className="text-sm text-gray-500">Cobros de reserva realizados con Mercado Pago</p></div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="!flex !w-auto items-center gap-2 rounded-lg border !bg-white px-4 py-2 font-semibold text-gray-700 hover:!bg-gray-100"><FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualizar</button>
      </header>

      {!configured && !loading && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"><strong>Integración preparada.</strong> Falta conectar las credenciales de Mercado Pago para habilitar los cobros.</div>}
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Intentos</p><p className="text-3xl font-black text-gray-900">{rows.length}</p></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Reservas aprobadas</p><p className="text-3xl font-black text-green-700">{approved.length}</p></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">Total cobrado</p><p className="text-3xl font-black text-sky-700">{money.format(total)}</p></div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><h2 className="font-bold">Movimientos</h2><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Todos los estados</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {loading ? <p className="p-6 text-gray-500">Cargando reservas…</p> : !filtered.length ? <p className="p-6 text-gray-500">Todavía no hay reservas para mostrar.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr>{["Fecha", "Alumno", "Responsable", "Contacto", "Importe", "Estado", "Pago MP"].map((title) => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t"><td className="whitespace-nowrap px-4 py-3">{dateTime(row.creado_en)}</td><td className="px-4 py-3 font-semibold">{row.alumno ? `${row.alumno.nombre} ${row.alumno.apellido}` : "—"}</td><td className="px-4 py-3">{row.alumno?.responsable || "—"}</td><td className="px-4 py-3"><div>{row.alumno?.telefono || "—"}</div><div className="text-xs text-gray-500">{row.alumno?.email || ""}</div></td><td className="px-4 py-3 font-semibold">{money.format(Number(row.monto || 0))}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge[row.estado] || badge.error}`}>{labels[row.estado] || row.estado}</span></td><td className="px-4 py-3 font-mono text-xs">{row.mp_payment_id || row.mp_order_id || "—"}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </main>
  );
}
