import { useNavigate } from "react-router-dom";
import { FaChild, FaHandshake, FaSun } from "react-icons/fa";

export default function PromosMenu() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">Promos vigentes</h1>
        <button
          onClick={() => navigate("/menu-padres")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-600 text-center mb-6">
          Beneficios pensados para familias que quieren compartir la experiencia.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="border border-emerald-200 rounded-2xl p-5 bg-emerald-50 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <FaChild className="text-emerald-600 text-xl" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Promo Hermanos</h3>
                <p className="text-xs text-emerald-700 font-semibold">10% de descuento</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              10% de descuento en la cuota mensual para hermanos.
            </p>
          </div>

          <div className="border border-blue-200 rounded-2xl p-5 bg-blue-50 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FaHandshake className="text-blue-600 text-xl" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Promo Mejores Amigos</h3>
                <p className="text-xs text-blue-700 font-semibold">10% de descuento</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              10% de descuento en la cuota mensual para mejores amigos que vengan juntos.
            </p>
          </div>

          <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <FaSun className="text-amber-600 text-xl" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Taller de Verano</h3>
                <p className="text-xs text-amber-700 font-semibold">Inscripción Bonificada</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Si realizaron Taller de Verano durante Enero y Febrero, no abonan inscripción al Ciclo 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
