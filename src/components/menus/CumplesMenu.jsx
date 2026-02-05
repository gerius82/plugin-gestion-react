import { Link } from "react-router-dom";
import { FaBirthdayCake, FaClipboardList } from "react-icons/fa";

export default function CumplesMenu() {
  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Festeja tu cumple</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/cumples-gestion"
          className="bg-white rounded-xl border-l-8 border-emerald-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaClipboardList className="text-emerald-500 text-3xl" />
          <span className="font-semibold text-lg">Gestion completa</span>
        </Link>

        <Link
          to="/cumples-info?from=cumples-menu"
          className="bg-white rounded-xl border-l-8 border-pink-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaBirthdayCake className="text-pink-500 text-3xl" />
          <span className="font-semibold text-lg">Reservas (padres)</span>
        </Link>
      </div>

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/menu-gestion"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">&lt;-</span>
          <span className="font-medium text-gray-700">Volver al menu</span>
        </Link>
      </div>
    </div>
  );
}
