import { Link } from "react-router-dom";
import { FaClipboardList, FaTable, FaUserSlash, FaHistory, FaExchangeAlt, FaUserTimes, FaBullhorn } from "react-icons/fa";

export default function AlumnosMenu() {
  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Gestión de Alumnos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/ficha"
          className="bg-white rounded-xl border-l-8 border-blue-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaClipboardList className="text-blue-500 text-3xl" />
          <span className="font-semibold text-lg">Ficha Individual</span>
        </Link>

        <Link
          to="/resumen-alumnos"
          className="bg-white rounded-xl border-l-8 border-gray-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaTable className="text-gray-600 text-3xl" />
          <span className="font-semibold text-lg">Lista de alumnos</span>
        </Link>

        <Link
            to="/inactivos"
            className="bg-white rounded-xl border-l-8 border-red-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
            >
            <FaUserSlash className="text-red-500 text-3xl" />
            <span className="font-semibold text-lg">Inactivos</span>
        </Link>

        <Link
            to="/recuperar?from=alumnos-menu"
            className="bg-white rounded-xl border-l-8 border-green-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
            >
            <FaHistory className="text-green-500 text-3xl" />
            <span className="font-semibold text-lg">Recuperar clase</span>
        </Link>

        <Link
            to="/cambio-turno?from=alumnos-menu"
            className="bg-white rounded-xl border-l-8 border-purple-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
            >
            <FaExchangeAlt className="text-purple-500 text-3xl" />
            <span className="font-semibold text-lg">Cambiar turnos</span>
        </Link>

        <Link
            to="/dar-de-baja?from=alumnos-menu"
            className="bg-white rounded-xl border-l-8 border-red-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
            >
            <FaUserTimes className="text-red-500 text-3xl" />
            <span className="font-semibold text-lg">Dar de baja</span>
        </Link>

        <Link
            to="/avisos"
            className="bg-white rounded-xl border-l-8 border-green-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
            >
            <FaBullhorn className="text-green-500 text-3xl" />
            <span className="font-semibold text-lg">Avisos</span>
        </Link>



      </div>

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/menu-gestion"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
        </Link>
      </div>
    </div>
  );
}
