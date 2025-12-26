import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSun, FaCalendarAlt, FaArrowLeft } from "react-icons/fa";

const meses = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatearFechaLarga(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  const dia = String(parseInt(d, 10)).padStart(2, "0");
  const mes = meses[parseInt(m, 10) - 1] || "";
  return `${dia} de ${mes} ${y}`;
}

function getRutaFormulario(codigo) {
  if (codigo === "TDV") {
    // Taller de Verano
    return "/formulario-verano?origen=padres";
  }
  // Cualquier otro ciclo va al formulario regular
  return `/formulario-inscripcion?origen=padres&ciclo=${encodeURIComponent(
    codigo
  )}`;
}

function getIcono(codigo) {
  if (codigo === "TDV") return <FaSun className="text-yellow-500 text-3xl" />;
  return <FaCalendarAlt className="text-gray-500 text-3xl" />;
}

export default function MenuInscripcionPadres() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [ciclos, setCiclos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const resCfg = await fetch("/config.json");
        const jsonCfg = await resCfg.json();
        setConfig(jsonCfg);

        const headers = {
          apikey: jsonCfg.supabaseKey,
          Authorization: `Bearer ${jsonCfg.supabaseKey}`,
        };

        const resCiclos = await fetch(
          `${jsonCfg.supabaseUrl}/rest/v1/ciclos?select=*`,
          { headers }
        );

        if (!resCiclos.ok) {
          const txt = await resCiclos.text();
          console.error("Error al cargar ciclos:", txt);
          throw new Error("No pude cargar los ciclos.");
        }

        const data = await resCiclos.json();
        const lista = Array.isArray(data) ? data : [];

        // Orden: primero por "orden", luego por fecha_inicio
        lista.sort((a, b) => {
          const ordA = a.orden ?? 9999;
          const ordB = b.orden ?? 9999;
          if (ordA !== ordB) return ordA - ordB;

          const fa = a.fecha_inicio || "";
          const fb = b.fecha_inicio || "";
          return fa.localeCompare(fb);
        });

        setCiclos(lista);
      } catch (e) {
        console.error(e);
        setError("No pude cargar los ciclos de inscripción.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const hoyISO = new Date().toISOString().split("T")[0];

  const renderCard = (c) => {
    const fechaIni = c.fecha_inicio || null;
    const fechaEnFuturo = fechaIni && fechaIni > hoyISO;
    const habilitadoPorFecha = !fechaIni || !fechaEnFuturo;
    const habilitado = c.activo && habilitadoPorFecha;

    const contenido = (
      <div
        className={`relative flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition
        ${
          habilitado
            ? "bg-white border-yellow-300 hover:shadow-md hover:border-yellow-400"
            : "bg-gray-100 border-gray-200 text-gray-400"
        }`}
      >
       


        <div className="ml-2 flex items-center gap-4">
          <div>{getIcono(c.codigo)}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`text-lg font-semibold ${
                  habilitado ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {c.nombre_publico || c.codigo}
              </h3>
              {!habilitado && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-300 text-gray-700">
                  Próximamente
                </span>
              )}
            </div>

            {c.descripcion && (
              <p
                className={`text-sm mt-1 ${
                  habilitado ? "text-gray-600" : "text-gray-500"
                }`}
              >
                {c.descripcion}
              </p>
            )}

            {!habilitado && fechaIni && (
              <p className="text-xs mt-1 text-gray-500">
                La inscripción abrirá el {formatearFechaLarga(fechaIni)}.
              </p>
            )}
          </div>
        </div>
      </div>
    );

    if (habilitado) {
      return (
        <Link key={c.id} to={getRutaFormulario(c.codigo)} className="block">
          {contenido}
        </Link>
      );
    }

    // Inactivo: sin Link, solo div
    return (
      <div key={c.id} className="block cursor-not-allowed">
        {contenido}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-center mb-2">
          Elegí el ciclo de inscripción
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Seleccioná si querés inscribir al Taller de Verano o a un ciclo
          lectivo.
        </p>

        {cargando && (
          <div className="text-center text-gray-500 py-10">
            Cargando ciclos…
          </div>
        )}

        {!cargando && error && (
          <div className="text-center text-red-600 mb-4 text-sm">{error}</div>
        )}

        {!cargando && !error && ciclos.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">
            No hay ciclos configurados todavía.
          </div>
        )}

        {!cargando && !error && ciclos.length > 0 && (
          <div className="space-y-3 mb-8">{ciclos.map(renderCard)}</div>
        )}

        {/* Botón volver */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/menu-padres")}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-md transition"
          >
            <FaArrowLeft />
            <span>Volver al menú</span>
          </button>
        </div>
      </div>
    </div>
  );
}
