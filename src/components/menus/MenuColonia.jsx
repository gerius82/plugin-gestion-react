import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartBar, FaExternalLinkAlt, FaRobot, FaSun } from "react-icons/fa";
import { getSupabaseAuthClient } from "../../lib/supabaseAuth";

export default function MenuColonia() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/config.json")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => {
        setError("No se pudo cargar la configuración.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!config) return;
    fetch(`${config.supabaseUrl}/functions/v1/encuesta-colonia-2027?action=status`, {
      headers: { apikey: config.supabaseKey },
    })
      .then((response) => response.json())
      .then((result) => setVisible(result?.visible === true))
      .catch(() => setError("No se pudo consultar el estado de la encuesta."))
      .finally(() => setLoading(false));
  }, [config]);

  const changeVisibility = async () => {
    try {
      setSaving(true);
      setError("");
      const client = await getSupabaseAuthClient();
      const { data } = await client.auth.getSession();
      const next = !visible;
      const response = await fetch(`${config.supabaseUrl}/functions/v1/encuesta-colonia-2027`, {
        method: "POST",
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${data.session?.access_token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "set_visibility", visible: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo cambiar la visibilidad.");
      setVisible(next);
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="w-full max-w-3xl">
      <header className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => navigate("/menu-gestion")}
          className="!flex !h-10 !w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 !p-0 text-gray-700 hover:bg-gray-100"
          aria-label="Volver al menú de Gestión"
        >
          <FaArrowLeft />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xl text-cyan-700">
            <FaSun />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Colonia Tecnológica</h1>
            <p className="text-sm text-gray-500">Encuesta y análisis de interés para 2027</p>
          </div>
        </div>
      </header>

      <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${visible ? "bg-green-500" : "bg-gray-400"}`} />
            <h2 className="font-bold text-gray-900">Publicación de la encuesta</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {loading
              ? "Consultando estado…"
              : visible
                ? "Visible en el Menú para Padres y habilitada para responder."
                : "Oculta del Menú para Padres y cerrada para nuevas respuestas."}
          </p>
        </div>
        <button
          type="button"
          onClick={changeVisibility}
          disabled={loading || saving || !config}
          className={`!w-full rounded-xl px-5 py-2.5 font-bold text-white transition disabled:opacity-50 sm:!w-auto ${visible ? "bg-gray-700 hover:bg-gray-800" : "bg-green-600 hover:bg-green-700"}`}
        >
          {saving ? "Guardando…" : visible ? "Ocultar encuesta" : "Mostrar encuesta"}
        </button>
      </section>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          to="/encuesta-colonia-2027?preview=gestion"
          className="group rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl text-cyan-700"><FaRobot /></span>
            <FaExternalLinkAlt className="text-gray-400 transition group-hover:text-cyan-700" />
          </div>
          <h2 className="mt-5 text-lg font-bold text-gray-900">Vista previa de la encuesta</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Revisá el formulario completo aunque todavía esté oculto para las familias.</p>
        </Link>

        <Link
          to="/encuesta-colonia-resultados"
          className="group rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-2xl text-indigo-700"><FaChartBar /></span>
          <h2 className="mt-5 text-lg font-bold text-gray-900">Resultados de la encuesta</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Consultá estadísticas, cruces, respuestas y exportá el archivo CSV.</p>
        </Link>
      </div>

      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
        La encuesta pública se puede compartir directamente por WhatsApp. Las familias no necesitan iniciar sesión.
      </div>
    </main>
  );
}
