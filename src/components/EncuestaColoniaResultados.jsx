import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartBar, FaDownload, FaSyncAlt } from "react-icons/fa";
import { getSupabaseAuthClient } from "../lib/supabaseAuth";

const labels = {
  interes: { encanta: "Me encanta", interesante: "Interesante", dudas: "Tiene dudas", no_interesa: "No interesa" },
  intencion_inscripcion: { definitivamente: "Definitivamente sí", probablemente: "Probablemente sí", tal_vez: "Tal vez", no: "No" },
  sede_preferida: { centro: "Rosario Centro", fisherton: "Fisherton", cualquiera: "Cualquiera" },
  turno_preferido: { manana: "Mañana", tarde: "Tarde", cualquiera: "Cualquier turno", ninguno: "Ninguno" },
  periodo_interes: { enero: "Enero", febrero: "Febrero", ambos: "Enero y febrero", no_sabe: "No sabe" },
  actividades: { robotica: "Robótica con LEGO", experimentos: "Experimentos", arte: "Manualidades y arte", electronica: "Electrónica", juegos: "Juegos grupales", programacion: "Programación y videojuegos" },
};

const formatDate = (value) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function StatCard({ value, label, detail }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-3xl font-black text-cyan-700">{value}</p><p className="mt-1 font-bold text-gray-900">{label}</p>{detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}</div>;
}

function BarChart({ title, rows, total, multiple = false }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span>{row.label}</span><strong>{row.count}{total ? ` · ${Math.round((row.count / total) * 100)}%` : ""}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${(row.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      {multiple && <p className="mt-4 text-xs text-gray-500">Se podían elegir varias opciones; los porcentajes pueden superar el 100%.</p>}
    </section>
  );
}

const countField = (rows, field) => Object.entries(labels[field]).map(([key, label]) => ({ key, label, count: rows.filter((row) => row[field] === key).length }));
const countActivities = (rows) => Object.entries(labels.actividades).map(([key, label]) => ({ key, label, count: rows.filter((row) => row.actividades?.includes(key)).length }));

function CrossTable({ title, rowKeys, rowLabels, columnKeys, columnLabels, rows, rowField, columnField }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <h2 className="p-5 font-bold text-gray-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-4 py-3">Sede</th>{columnKeys.map((key) => <th key={key} className="px-4 py-3 text-center">{columnLabels[key]}</th>)}</tr></thead>
          <tbody>{rowKeys.map((rowKey) => <tr key={rowKey} className="border-t"><th className="px-4 py-3 text-left">{rowLabels[rowKey]}</th>{columnKeys.map((columnKey) => <td key={columnKey} className="px-4 py-3 text-center font-semibold">{rows.filter((row) => row[rowField] === rowKey && row[columnField] === columnKey).length}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function EncuestaColoniaResultados() {
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", sede: "", turno: "", periodo: "", intencion: "" });

  useEffect(() => { fetch("/config.json").then((response) => response.json()).then(setConfig).catch(() => setError("No se pudo cargar la configuración.")); }, []);

  const load = async () => {
    if (!config) return;
    try {
      setLoading(true); setError("");
      const client = await getSupabaseAuthClient();
      const { data } = await client.auth.getSession();
      const response = await fetch(`${config.supabaseUrl}/functions/v1/encuesta-colonia-2027`, { headers: { apikey: config.supabaseKey, Authorization: `Bearer ${data.session?.access_token || ""}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudieron cargar los resultados.");
      setResponses(result.responses || []);
    } catch (currentError) { setError(currentError.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [config]);

  const filtered = useMemo(() => responses.filter((row) => {
    const date = new Date(row.created_at);
    if (filters.from && date < new Date(`${filters.from}T00:00:00`)) return false;
    if (filters.to && date > new Date(`${filters.to}T23:59:59`)) return false;
    if (filters.sede && row.sede_preferida !== filters.sede) return false;
    if (filters.turno && row.turno_preferido !== filters.turno) return false;
    if (filters.periodo && row.periodo_interes !== filters.periodo) return false;
    if (filters.intencion && row.intencion_inscripcion !== filters.intencion) return false;
    return true;
  }), [filters, responses]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const interested = filtered.filter((row) => ["encanta", "interesante"].includes(row.interes)).length;
    const likely = filtered.filter((row) => ["definitivamente", "probablemente"].includes(row.intencion_inscripcion)).length;
    const news = filtered.filter((row) => row.quiere_novedades).length;
    return { total, interested, likely, news, interestedPct: total ? Math.round((interested / total) * 100) : 0 };
  }, [filtered]);

  const exportCsv = () => {
    const headers = ["Fecha", "Interés", "Intención", "Sede", "Turno", "Período", "Actividades", "Sugerencias", "Quiere novedades", "Nombre", "WhatsApp"];
    const lines = filtered.map((row) => [formatDate(row.created_at), labels.interes[row.interes], labels.intencion_inscripcion[row.intencion_inscripcion], labels.sede_preferida[row.sede_preferida], labels.turno_preferido[row.turno_preferido], labels.periodo_interes[row.periodo_interes], (row.actividades || []).map((item) => labels.actividades[item] || item).join(" | "), row.sugerencias || "", row.quiere_novedades ? "Sí" : "No", row.nombre_contacto || "", row.whatsapp_contacto || ""].map(csvCell).join(";"));
    const blob = new Blob(["\ufeff", [headers.map(csvCell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `encuesta-colonia-2027-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const highIntent = filtered.filter((row) => ["definitivamente", "probablemente"].includes(row.intencion_inscripcion));

  return (
    <main className="w-full max-w-7xl pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3"><button type="button" onClick={() => navigate("/colonia-gestion")} className="!flex !h-10 !w-10 items-center justify-center rounded-full border border-gray-200 !bg-gray-50 !p-0 text-gray-700 transition-colors hover:!bg-gray-200"><FaArrowLeft /></button><div><h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><FaChartBar className="text-cyan-700" /> Encuesta Colonia 2027</h1><p className="text-sm text-gray-500">Resultados reales almacenados en Supabase</p></div></div>
        <div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={load} disabled={loading} className="!flex !w-auto flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 !bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:!bg-gray-100 disabled:!bg-gray-50 disabled:text-gray-400 sm:flex-none"><FaSyncAlt className={loading ? "animate-spin" : ""} /> Actualizar</button><button type="button" onClick={exportCsv} disabled={!filtered.length} className="!flex !w-auto flex-1 items-center justify-center gap-2 rounded-lg !bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:!bg-cyan-800 disabled:!bg-cyan-300 disabled:opacity-50 sm:flex-none"><FaDownload /> Exportar CSV</button></div>
      </header>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <section className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Filtros</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-semibold text-gray-600">Desde<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-gray-600">Hasta<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" /></label>
          {[["sede", "Sede", "sede_preferida"], ["turno", "Turno", "turno_preferido"], ["periodo", "Período", "periodo_interes"], ["intencion", "Intención", "intencion_inscripcion"]].map(([key, title, labelKey]) => <label key={key} className="text-xs font-semibold text-gray-600">{title}<select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"><option value="">Todos</option>{Object.entries(labels[labelKey]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
        </div>
      </section>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={stats.total} label="Encuestas recibidas" />
        <StatCard value={`${stats.interestedPct}%`} label="Les encanta o interesa" detail={`${stats.interested} familias`} />
        <StatCard value={stats.likely} label="Inscribirían probablemente" detail="Definitivamente o probablemente sí" />
        <StatCard value={stats.news} label="Pidieron novedades" />
      </div>

      {!loading && !filtered.length ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-gray-500">Todavía no hay respuestas para los filtros seleccionados.</div> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart title="Interés general" rows={countField(filtered, "interes")} total={stats.total} />
            <BarChart title="Intención de inscripción" rows={countField(filtered, "intencion_inscripcion")} total={stats.total} />
            <BarChart title="Sede preferida" rows={countField(filtered, "sede_preferida")} total={stats.total} />
            <BarChart title="Turno preferido" rows={countField(filtered, "turno_preferido")} total={stats.total} />
            <BarChart title="Período de interés" rows={countField(filtered, "periodo_interes")} total={stats.total} />
            <BarChart title="Actividades más elegidas" rows={countActivities(filtered)} total={stats.total} multiple />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <CrossTable title="Sede × turno" rowKeys={["centro", "fisherton", "cualquiera"]} rowLabels={labels.sede_preferida} columnKeys={["manana", "tarde", "cualquiera", "ninguno"]} columnLabels={labels.turno_preferido} rows={filtered} rowField="sede_preferida" columnField="turno_preferido" />
            <CrossTable title="Sede × período" rowKeys={["centro", "fisherton", "cualquiera"]} rowLabels={labels.sede_preferida} columnKeys={["enero", "febrero", "ambos", "no_sabe"]} columnLabels={labels.periodo_interes} rows={filtered} rowField="sede_preferida" columnField="periodo_interes" />
            <div className="xl:col-span-2"><CrossTable title="Demanda con intención alta: sede × turno" rowKeys={["centro", "fisherton", "cualquiera"]} rowLabels={labels.sede_preferida} columnKeys={["manana", "tarde", "cualquiera", "ninguno"]} columnLabels={labels.turno_preferido} rows={highIntent} rowField="sede_preferida" columnField="turno_preferido" /></div>
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="p-5"><h2 className="font-bold">Respuestas individuales</h2><p className="text-xs text-gray-500">Los datos de contacto solo están disponibles dentro de este panel protegido.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-gray-50 text-left text-gray-600"><tr>{["Fecha", "Interés", "Intención", "Sede", "Turno", "Período", "Actividades", "Sugerencias", "Contacto"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t align-top"><td className="whitespace-nowrap px-4 py-3">{formatDate(row.created_at)}</td><td className="px-4 py-3">{labels.interes[row.interes]}</td><td className="px-4 py-3">{labels.intencion_inscripcion[row.intencion_inscripcion]}</td><td className="px-4 py-3">{labels.sede_preferida[row.sede_preferida]}</td><td className="px-4 py-3">{labels.turno_preferido[row.turno_preferido]}</td><td className="px-4 py-3">{labels.periodo_interes[row.periodo_interes]}</td><td className="px-4 py-3">{(row.actividades || []).map((item) => labels.actividades[item]).join(", ")}</td><td className="max-w-xs whitespace-pre-wrap px-4 py-3">{row.sugerencias || "—"}</td><td className="px-4 py-3">{row.quiere_novedades ? <><strong>{row.nombre_contacto}</strong><br />{row.whatsapp_contacto}</> : "No solicitó"}</td></tr>)}</tbody></table></div>
          </section>
        </>
      )}
    </main>
  );
}
