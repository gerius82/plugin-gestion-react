import { Link, useNavigate } from "react-router-dom";
import { FaSun, FaCalendarAlt, FaArrowLeft } from "react-icons/fa";

export default function MenuInscripcionPadres() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-4">
      <h1 className="text-2xl font-bold mb-2 text-center">
        Elegí el ciclo de inscripción
      </h1>

      <p className="text-center text-sm text-gray-600 mb-4">
        Seleccioná si querés inscribir al Taller de Verano o al Ciclo 2026.
      </p>

      {/* Opción: Taller de Verano */}
      <Link
        to="/formulario-verano?origen=padres&from=menu-intermedio"
        className="bg-white border-l-8 border-yellow-400 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
      >
        <FaSun className="text-yellow-400 text-3xl" />
        <div>
          <div className="font-semibold">Taller de Verano</div>
          <p className="text-sm text-gray-600">
            Info e inscripción para el Taller de Verano.
          </p>
        </div>
      </Link>

      {/* Opción: Ciclo 2026 → usa tu formulario actual */}
      <div className="relative">
        <div
            className="bg-gray-200 border-l-8 border-gray-400 text-gray-500 rounded-xl p-5 shadow cursor-not-allowed opacity-60 flex items-center gap-4"
        >
            <FaCalendarAlt className="text-gray-400 text-3xl" />
            <div>
            <div className="font-semibold">Ciclo 2026</div>
            <p className="text-sm text-gray-600">La inscripción abrirá el 01 de Febrero 2026</p>
            </div>
        </div>

        {/* Badge */}
        <span className="absolute -top-2 right-2 bg-gray-600 text-white text-xs font-semibold px-2 py-1 rounded-md">
            Próximamente
        </span>
        </div>

      {/* Volver al menú padre */}
      <button
        onClick={() => navigate("/menu-padres")}
        className="w-full bg-gray-100 border border-gray-300 text-gray-700 rounded-xl p-3 shadow-sm hover:bg-gray-200 transition flex items-center justify-center gap-2 mt-4"
      >
        <FaArrowLeft />
        Volver al menú de padres
      </button>
    </div>
  );
}
