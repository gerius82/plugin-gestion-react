import { Link } from "react-router-dom";
import { FaUserEdit, FaClipboardList, FaUserCheck, FaMoneyBillWave, FaThLarge, FaChartPie } from "react-icons/fa";

export default function MenuGestion() {
  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Menú de Gestión</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ✅ Formulario de Inscripción */}
        <Link
          to="/formulario?origen=gestion"
          className="bg-white rounded-xl border-l-8 border-green-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaUserEdit className="text-green-500 text-3xl" />
          <span className="font-semibold text-lg">Formulario de Inscripción</span>
        </Link>

        {/* ✅ Ficha Alumno */}
        <Link
          to="/alumnos-menu"
          className="bg-white rounded-xl border-l-8 border-blue-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaClipboardList className="text-blue-500 text-3xl" />
          <span className="font-semibold text-lg">Alumnos</span>
        </Link>

        {/* ✅ Asistencia */}
        <Link
          to="/asistencia-menu"
          className="bg-white rounded-xl border-l-8 border-red-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaUserCheck className="text-red-500 text-3xl" />
          <span className="font-semibold text-lg">Asistencia</span>
        </Link>

        {/* ✅ Pagos */}
        <Link
          to="/pagos-menu"
          className="bg-white rounded-xl border-l-8 border-yellow-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaMoneyBillWave className="text-yellow-500 text-3xl" />
          <span className="font-semibold text-lg">Pagos</span>
        </Link>

        <Link
          to="/grilla-turnos"
          className="bg-white rounded-xl border-l-8 border-purple-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaThLarge className="text-purple-500 text-3xl" />
          <span className="font-semibold text-lg">Grilla Completa</span>
        </Link>

        <Link
          to="/menu-resumen"
          className="bg-white rounded-xl border-l-8 border-indigo-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaChartPie className="text-indigo-500 text-3xl" />
          <span className="font-semibold text-lg">Resúmenes & Gastos</span>
        </Link>

      </div>
    </div>
  );
}
