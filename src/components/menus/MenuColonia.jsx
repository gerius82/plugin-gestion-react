import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartBar, FaExternalLinkAlt, FaRobot, FaSun } from "react-icons/fa";

export default function MenuColonia() {
  const navigate = useNavigate();

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

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          to="/encuesta-colonia-2027"
          className="group rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl text-cyan-700"><FaRobot /></span>
            <FaExternalLinkAlt className="text-gray-400 transition group-hover:text-cyan-700" />
          </div>
          <h2 className="mt-5 text-lg font-bold text-gray-900">Ver encuesta pública</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Abrí el formulario exactamente como lo verán las familias.</p>
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

