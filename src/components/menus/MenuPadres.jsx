import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBirthdayCake, FaExchangeAlt, FaHistory, FaTag, FaUserEdit, FaUserTimes } from "react-icons/fa";

export default function MenuPadres() {
  const [config, setConfig] = useState(null);
  const [cumplesHabilitado, setCumplesHabilitado] = useState(false);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/cumples_config?select=habilitado&id=eq.global`,
          {
            headers: {
              apikey: config.supabaseKey,
              Authorization: `Bearer ${config.supabaseKey}`,
            },
          }
        );
        const data = await res.json();
        const row = Array.isArray(data) ? data[0] : null;
        setCumplesHabilitado(Boolean(row?.habilitado));
      } catch {
        setCumplesHabilitado(false);
      }
    })();
  }, [config]);

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Menú para Padres</h1>

      <div className="relative">
        <Link
          to="/menu-inscripcion-padres"
          className="bg-white border-l-8 border-green-500 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex flex-col items-start gap-3"
        >
          <div className="flex items-center gap-4">
            <FaUserEdit className="text-green-500 text-3xl" />
            <span className="font-semibold text-lg">Formulario de Inscripción</span>
          </div>

          {/* ACA CAMBIAMOS SOLO EL SPAN SEGÚN LA OPCIÓN */}
          {/* ... */}
          <span className="mx-auto text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-md animate-blink glow-badge">
            Abierta la inscripción al Ciclo 2026!!
          </span>
        </Link>
      </div>

      <Link
        to="/promos"
        className="bg-white border-l-8 border-teal-400 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
      >
        <FaTag className="text-teal-500 text-3xl" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Promos</span>
          <span className="text-xs text-gray-500">Descuentos y beneficios vigentes</span>
        </div>
      </Link>

      {cumplesHabilitado ? (
        <Link
          to="/cumples-info?from=menu-padres"
          className="bg-white border-l-8 border-pink-500 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
        >
          <FaBirthdayCake className="text-pink-500 text-3xl" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Festeja tu cumple</span>
            <span className="text-xs text-gray-500">Cumples creativos para chicos de 7 a 12 años</span>
          </div>
        </Link>
      ) : (
        <div className="bg-gray-100 border-l-8 border-gray-300 text-gray-500 rounded-xl p-5 shadow-sm text-left flex items-center gap-4 cursor-not-allowed">
          <FaBirthdayCake className="text-pink-500 text-3xl" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Festeja tu cumple</span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 w-fit">Próximamente</span>
          </div>
        </div>
      )}

      <Link
        to="/recuperar?from=menu-padres"
        className="bg-white border-l-8 border-yellow-500 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
      >
        <FaHistory className="text-yellow-500 text-3xl" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Recuperar clases</span>
          <span className="text-xs text-gray-500">Elegi una fecha disponible para recuperar</span>
        </div>
      </Link>

      <Link
        to="/cambio-turno?from=menu-padres"
        className="bg-white border-l-8 border-purple-500 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
      >
        <FaExchangeAlt className="text-purple-500 text-3xl" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Cambiar turnos</span>
          <span className="text-xs text-gray-500">Solicita el cambio de día / horario</span>
        </div>
      </Link>

      <Link
        to="/dar-de-baja?from=menu-padres"
        className="bg-white border-l-8 border-red-500 text-gray-800 rounded-xl p-5 shadow hover:shadow-md transition hover:scale-[1.02] text-left flex items-center gap-4"
      >
        <FaUserTimes className="text-red-500 text-3xl" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Dar de baja</span>
          <span className="text-xs text-gray-500">Gestiona la baja de la matricula</span>
        </div>
      </Link>

      

      

    </div>
  );
}
