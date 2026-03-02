import { Link } from "react-router-dom";
import { FaFileInvoiceDollar, FaUserCheck, FaAddressBook, FaAmbulance } from "react-icons/fa";

export default function MenuPadres() {
  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Menú para Profes</h1>

        <Link
            to="/pagos?from=menu-profes"
            className="bg-white rounded-xl border-l-8 border-yellow-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
            <FaFileInvoiceDollar className="text-yellow-500 text-3xl" />
            <span className="font-semibold text-lg">Registrar Pago</span>
        </Link>

        <Link
          to="/asistencias?from=menu-profes"
          className="bg-white rounded-xl border-l-8 border-red-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaUserCheck className="text-red-500 text-3xl" />
          <span className="font-semibold text-lg">Registrar Asistencia</span>
        </Link>

        <Link
          to="/profes-contacto-alumnos"
          className="bg-white rounded-xl border-l-8 border-blue-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaAddressBook className="text-blue-500 text-3xl" />
          <span className="font-semibold text-lg">Contacto de alumnos</span>
        </Link>

        <Link
          to="/profes-urgencias"
          className="bg-white rounded-xl border-l-8 border-cyan-500 p-5 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-4"
        >
          <FaAmbulance className="text-cyan-600 text-3xl" />
          <span className="font-semibold text-lg">Urgencias</span>
        </Link>

    </div>
  );
}
