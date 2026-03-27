import { Link } from "react-router-dom";
import { FaUserCheck, FaChartBar, FaCalendarAlt } from "react-icons/fa";

export default function AsistenciaMenu() {
  return (
    <div className="max-w-5xl mx-auto mt-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Gestion de Asistencia</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/asistencias?from=asistencia-menu"
          className="bg-white rounded-xl border-l-8 border-red-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaUserCheck className="text-red-500 text-3xl" />
          <span className="font-semibold text-lg">Registrar Asistencia</span>
        </Link>

        <Link
          to="/estadisticas-asistencias"
          className="bg-white rounded-xl border-l-8 border-blue-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaChartBar className="text-blue-500 text-3xl" />
          <span className="font-semibold text-lg">Estadisticas</span>
        </Link>

        <Link
          to="/control-asistencias"
          className="bg-white rounded-xl border-l-8 border-emerald-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaCalendarAlt className="text-emerald-500 text-3xl" />
          <span className="font-semibold text-lg">Control mensual</span>
        </Link>
      </div>

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/menu-gestion"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menu</span>
        </Link>
      </div>
    </div>
  );
}
