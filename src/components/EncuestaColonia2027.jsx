import { useEffect, useMemo, useState } from "react";
import { FaCheck, FaFlask, FaGamepad, FaLaptopCode, FaPalette, FaRobot, FaWhatsapp } from "react-icons/fa";

const DRAFT_KEY = "plugin_encuesta_colonia_2027_borrador";
const SUBMISSION_KEY = "plugin_encuesta_colonia_2027_envio";

const questions = {
  interes: {
    title: "¿Qué te parece la idea de una Colonia Tecnológica Plugin durante el verano?",
    options: [
      ["encanta", "¡Me encanta la idea!"],
      ["interesante", "Me parece interesante."],
      ["dudas", "Tengo algunas dudas."],
      ["no_interesa", "No me interesa."],
    ],
  },
  intencion_inscripcion: {
    title: "¿Considerarías inscribir a tu hijo/a?",
    options: [
      ["definitivamente", "Definitivamente sí."],
      ["probablemente", "Probablemente sí."],
      ["tal_vez", "Tal vez, depende de la propuesta."],
      ["no", "No."],
    ],
  },
  sede_preferida: {
    title: "¿Qué sede te resultaría más conveniente?",
    options: [
      ["centro", "Rosario Centro — Mendoza 3024."],
      ["fisherton", "Fisherton — Eva Perón 8128."],
      ["cualquiera", "Cualquiera de las dos."],
    ],
  },
  turno_preferido: {
    title: "¿Qué horario te resultaría más conveniente?",
    options: [
      ["manana", "Mañana — 8:30 a 12:00."],
      ["tarde", "Tarde — 13:30 a 17:00."],
      ["cualquiera", "Cualquiera de los dos."],
      ["ninguno", "Ninguno de esos horarios."],
    ],
  },
  periodo_interes: {
    title: "¿En qué período te interesaría participar?",
    options: [
      ["enero", "Enero 2027."],
      ["febrero", "Febrero 2027."],
      ["ambos", "Enero y febrero."],
      ["no_sabe", "Todavía no lo sé."],
    ],
  },
};

const activities = [
  ["robotica", "Robótica con LEGO", FaRobot],
  ["experimentos", "Experimentos científicos", FaFlask],
  ["arte", "Manualidades y arte", FaPalette],
  ["electronica", "Electrónica sencilla", FaRobot],
  ["juegos", "Juegos y desafíos grupales", FaGamepad],
  ["programacion", "Programación y videojuegos", FaLaptopCode],
];

const initialForm = {
  interes: "",
  intencion_inscripcion: "",
  sede_preferida: "",
  turno_preferido: "",
  periodo_interes: "",
  actividades: [],
  sugerencias: "",
  quiere_novedades: "",
  nombre_contacto: "",
  whatsapp_contacto: "",
  website: "",
};

function ChoiceCard({ name, value, checked, onChange, children }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${checked ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100" : "border-gray-200 bg-white hover:border-cyan-300"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-4 w-4 accent-cyan-600" />
      <span className="text-sm font-medium text-gray-800 sm:text-base">{children}</span>
    </label>
  );
}

function Question({ number, field, value, onChange }) {
  const question = questions[field];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">{number}</span>
        <h2 className="pt-1 font-bold leading-snug text-gray-900">{question.title}</h2>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {question.options.map(([optionValue, label]) => (
          <ChoiceCard key={optionValue} name={field} value={optionValue} checked={value === optionValue} onChange={onChange}>
            {label}
          </ChoiceCard>
        ))}
      </div>
    </section>
  );
}

export default function EncuestaColonia2027() {
  const [form, setForm] = useState(() => {
    try {
      return { ...initialForm, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") };
    } catch {
      return initialForm;
    }
  });
  const [config, setConfig] = useState(null);
  const [startedAt] = useState(Date.now());
  const [submissionId] = useState(() => {
    const stored = localStorage.getItem(SUBMISSION_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    localStorage.setItem(SUBMISSION_KEY, created);
    return created;
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/config.json").then((response) => response.json()).then(setConfig).catch(() => setError("No se pudo cargar la configuración."));
  }, []);

  useEffect(() => {
    if (!sent) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, sent]);

  const completed = useMemo(() => {
    const required = ["interes", "intencion_inscripcion", "sede_preferida", "turno_preferido", "periodo_interes"];
    if (required.some((field) => !form[field]) || !form.actividades.length || form.quiere_novedades === "") return false;
    if (form.quiere_novedades === "si" && (!form.nombre_contacto.trim() || !form.whatsapp_contacto.trim())) return false;
    return true;
  }, [form]);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const toggleActivity = (value) => {
    setForm((current) => ({
      ...current,
      actividades: current.actividades.includes(value)
        ? current.actividades.filter((item) => item !== value)
        : [...current.actividades, value],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!completed || !config) {
      setError("Completá todas las preguntas obligatorias.");
      return;
    }
    try {
      setSending(true);
      setError("");
      const response = await fetch(`${config.supabaseUrl}/functions/v1/encuesta-colonia-2027`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.supabaseKey },
        body: JSON.stringify({
          ...form,
          quiere_novedades: form.quiere_novedades === "si",
          nombre_contacto: form.quiere_novedades === "si" ? form.nombre_contacto : null,
          whatsapp_contacto: form.quiere_novedades === "si" ? form.whatsapp_contacto : null,
          submission_id: submissionId,
          started_at: startedAt,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "No pudimos guardar la respuesta.");
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(SUBMISSION_KEY);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (currentError) {
      setError(`${currentError.message} Tus respuestas siguen guardadas en este dispositivo.`);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <main className="w-full max-w-2xl py-8">
        <div className="rounded-3xl border border-cyan-200 bg-white p-8 text-center shadow-lg sm:p-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100 text-2xl text-cyan-700"><FaCheck /></div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">🤖 ¡Muchas gracias por participar!</h1>
          <p className="mt-4 text-gray-600">Tu opinión nos ayuda a preparar nuevas experiencias para los chicos.</p>
          <p className="mt-2 text-gray-600">¡Pronto compartiremos más novedades sobre la Colonia Tecnológica Plugin 2027!</p>
          <p className="mt-6 font-bold text-cyan-800">Equipo Plugin Robótica</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-3xl pb-10">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-700 via-blue-700 to-indigo-800 p-6 text-white shadow-xl sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-100">Colonia Tecnológica 2027</p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">☀️🤖 ¡Este verano, la diversión no depende del clima!</h1>
        <div className="mt-5 space-y-3 text-sm leading-relaxed text-blue-50 sm:text-base">
          <p>En Plugin Robótica estamos preparando una propuesta diferente para las vacaciones 2027.</p>
          <p>Una colonia tecnológica <strong>100% indoor</strong> para aprender, crear y divertirse sin depender del tiempo.</p>
        </div>
        <div className="mt-6 grid gap-2 rounded-2xl bg-white/10 p-4 text-sm backdrop-blur sm:grid-cols-2">
          <span>🚀 Robótica, juegos y desafíos</span><span>👧🧒 De 5 a 10 años</span>
          <span>📅 Enero y febrero de 2027</span><span>📍 Centro y Fisherton</span>
          <span>🕣 Mañana: 8:30 a 12:00</span><span>🕜 Tarde: 13:30 a 17:00</span>
        </div>
        <p className="mt-5 font-bold">¡Queremos conocer tu opinión!</p>
        <p className="mt-2 text-xs text-blue-100">La encuesta es informativa y no constituye una inscripción ni una reserva de vacante.</p>
      </header>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Question number="1" field="interes" value={form.interes} onChange={change} />
        <Question number="2" field="intencion_inscripcion" value={form.intencion_inscripcion} onChange={change} />
        <Question number="3" field="sede_preferida" value={form.sede_preferida} onChange={change} />
        <Question number="4" field="turno_preferido" value={form.turno_preferido} onChange={change} />
        <Question number="5" field="periodo_interes" value={form.periodo_interes} onChange={change} />

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">6</span>
            <div><h2 className="pt-1 font-bold text-gray-900">¿Qué actividades te gustaría que incluyamos?</h2><p className="mt-1 text-sm text-gray-500">Podés elegir varias.</p></div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {activities.map(([value, label, Icon]) => {
              const checked = form.actividades.includes(value);
              return (
                <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${checked ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100" : "border-gray-200 hover:border-cyan-300"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleActivity(value)} className="h-4 w-4 accent-cyan-600" />
                  <Icon className="shrink-0 text-cyan-700" /><span className="text-sm font-medium">{label}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">7</span><div><h2 className="pt-1 font-bold text-gray-900">¿Qué otra actividad o propuesta te gustaría encontrar?</h2><p className="mt-1 text-sm text-gray-500">Opcional.</p></div></div>
          <textarea name="sugerencias" value={form.sugerencias} onChange={change} rows="4" maxLength="1500" placeholder="Contanos tus ideas o sugerencias…" className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100" />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">8</span><h2 className="pt-1 font-bold text-gray-900">¿Te gustaría recibir novedades sobre la Colonia Tecnológica Plugin 2027?</h2></div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ChoiceCard name="quiere_novedades" value="si" checked={form.quiere_novedades === "si"} onChange={change}>Sí.</ChoiceCard>
            <ChoiceCard name="quiere_novedades" value="no" checked={form.quiere_novedades === "no"} onChange={change}>No.</ChoiceCard>
          </div>
          {form.quiere_novedades === "si" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-cyan-50 p-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">Nombre del adulto responsable<input name="nombre_contacto" value={form.nombre_contacto} onChange={change} maxLength="120" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-normal" /></label>
              <label className="text-sm font-semibold text-gray-700">WhatsApp de contacto<div className="relative mt-1.5"><FaWhatsapp className="absolute left-3 top-3 text-green-600" /><input name="whatsapp_contacto" type="tel" value={form.whatsapp_contacto} onChange={change} maxLength="40" placeholder="Ej.: 341 555 1234" className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 font-normal" /></div></label>
              <p className="text-xs text-gray-600 sm:col-span-2">Usaremos estos datos únicamente para enviarte novedades relacionadas con la colonia.</p>
            </div>
          )}
        </section>

        <input name="website" value={form.website} onChange={change} tabIndex="-1" autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={sending || !completed || !config} className="!w-full rounded-xl bg-cyan-700 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? "Enviando…" : "Enviar encuesta"}
        </button>
        <p className="text-center text-xs text-gray-500">No solicitamos DNI ni datos innecesarios.</p>
      </form>
    </main>
  );
}
