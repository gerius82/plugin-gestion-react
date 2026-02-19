import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaWhatsapp } from "react-icons/fa";

export default function InfoCumples() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const rutaVolver = from === "cumples-menu" ? "/cumples-menu" : "/menu-padres";
  const [config, setConfig] = useState(null);
  const [precioCumple, setPrecioCumple] = useState(null);
  const [promoCumple, setPromoCumple] = useState("");
  const [mostrarPrecioInfo, setMostrarPrecioInfo] = useState(true);
  const promoDefault = "Promo lanzamiento reservando en febrero 20% off: $450.000.";

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
          `${config.supabaseUrl}/rest/v1/cumples_config?select=*&id=eq.global`,
          {
            headers: {
              apikey: config.supabaseKey,
              Authorization: `Bearer ${config.supabaseKey}`,
            },
          }
        );
        const data = await res.json();
        const row = Array.isArray(data) ? data[0] : null;
        setPrecioCumple(row?.precio ?? null);
        setPromoCumple(row?.promo || "");
        setMostrarPrecioInfo(row?.mostrar_precio !== false);
      } catch {
        setPrecioCumple(null);
        setPromoCumple("");
        setMostrarPrecioInfo(true);
      }
    })();
  }, [config]);

  const formatPrecio = (valor) => {
    if (valor == null || Number.isNaN(Number(valor))) return "$570.000";
    const formatted = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(valor));
    return `$${formatted}`;
  };

  const telefonoWhatsapp = String(config?.whatsappCumples || "5493415064891").replace(/\D/g, "");
  const mensajeWhatsapp = [
    "🎈✨ ¡Hola Plugin!",
    "Estamos pensando en festejar un cumpleaños con ustedes 🤖🎂",
    "",
    "¿Podrían enviarme información sobre precios, fechas disponibles y cómo hacer la reserva?",
    "",
    "¡Muchas gracias! 😊",
  ].join("\n");
  const whatsappHref = `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(
    mensajeWhatsapp
  )}`;

  return (
    <div className="w-full mt-8 px-2 sm:px-4 lg:px-6">
      <div className="w-full flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">Festeja tu cumple</h1>
        <button
          onClick={() => navigate(rutaVolver)}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="w-full text-sm text-gray-700 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            Experiencia Plugin
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            🎉 Cumpleaños en Plugin – Información para familias 🤖🎂
          </div>
          <p className="max-w-2xl mx-auto">
            En Plugin celebramos cumpleaños distintos, llenos de juego, robótica y diversión. A
            continuación te contamos todos los detalles para que tengas claridad antes de contratar:
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-emerald-100 border border-emerald-200" />
            <div>
              <div className="font-semibold">Duración</div>
              <div>2 horas y media de actividades guiadas, juegos y festejo.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-sky-100 border border-sky-200" />
            <div>
              <div className="font-semibold">Cantidad de niños</div>
              <div>Máximo 15 chicos en total, incluído el cumpleañero.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-amber-100 border border-amber-200" />
            <div>
              <div className="font-semibold">Edad del cumpleañero</div>
              <div>Cumpleaños pensados para niños y niñas de 7 a 12 años.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-pink-100 border border-pink-200" />
            <div>
              <div className="font-semibold">Presencia de adultos</div>
              <div>Participan solo los chicos.</div>
              <div>Los únicos adultos que pueden permanecer durante el cumpleaños son los padres del cumpleañero.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm md:col-span-2 flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-lime-100 border border-lime-200" />
            <div>
              <div className="font-semibold">Menú para los chicos</div>
              <div>El menú se elige previamente por los padres y puede incluir:</div>
              <ul className="list-disc list-inside">
                <li>Fingers de pollo + papas Noisette + Snacks</li>
                <li>Super Pancho + Snacks</li>
              </ul>
              <div>👉 Opción para celíacos disponible, avisando con anticipación.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-cyan-100 border border-cyan-200" />
            <div>
              <div className="font-semibold">Bebidas</div>
              <div>Bebida libre durante todo el cumple, provista por el local:</div>
              <div>Coca-Cola · Sprite · Fanta · Agua</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-rose-100 border border-rose-200" />
            <div>
              <div className="font-semibold">Torta</div>
              <div>La torta la trae el cumpleañero/a.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-violet-100 border border-violet-200" />
            <div>
              <div className="font-semibold">Piñata</div>
              <div>El relleno es entregado por el salón (bolsa de caramelos).</div>
              <div>La familia puede agregar contenido si así lo desea.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-orange-100 border border-orange-200" />
            <div>
              <div className="font-semibold">Regalo sorpresa para el cumpleañero</div>
              <div>El cumpleañero se lleva un regalito sorpresa de Plugin como recuerdo del día.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-indigo-100 border border-indigo-200" />
            <div>
              <div className="font-semibold">Profes a cargo</div>
              <div>Siempre habrá profes especializados en actividades infantiles y robótica, encargados de coordinar actividades, juegos y acompañar a cada chico.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-emerald-100 border border-emerald-200" />
            <div>
              <div className="font-semibold">Seguridad</div>
              <div>El espacio cuenta con seguro médico de Urgencias para mayor tranquilidad de las familias.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm md:col-span-2 flex gap-3">
            <span className="mt-0.5 text-yellow-600 text-lg leading-none">
              <FaMoneyBillWave />
            </span>
            <div>
              <div className="font-semibold">Precio</div>
              {mostrarPrecioInfo ? (
                <>
                  <div>Valor del cumple: {formatPrecio(precioCumple)}.</div>
                  <div className="whitespace-pre-line">{promoCumple || promoDefault}</div>
                </>
              ) : (
                <div className="font-bold italic">Consultar precio por whatsapp</div>
              )}
              <div>Reserva con el 50%.</div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm md:col-span-2 flex gap-3">
            <span className="mt-0.5 h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] flex-none rounded-full bg-teal-100 border border-teal-200" />
            <div>
              <div className="font-semibold">Políticas de cancelación</div>
              <div>
                Hasta 14 días previos al día del evento se puede reintegrar la reserva. Luego se
                cobrará un 50% de la misma.
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 border border-gray-100 p-4 shadow-sm md:col-span-2 flex gap-3">
            <span className="mt-0.5 text-sky-600 text-lg leading-none">📍</span>
            <div>
              <div className="font-semibold">Ubicación</div>
              <div>
                El cumpleaños se realiza en nuestra sucursal de Fisherton, Eva Perón 8128, un espacio preparado
                especialmente para celebrar y disfrutar con comodidad.
              </div>
              <div className="mt-2">
                <iframe
                  title="Mapa de Fisherton"
                  className="w-full h-56 rounded-lg border"
                  loading="lazy"
                  src="https://www.google.com/maps?q=Eva%20Per%C3%B3n%208128%20Rosario&output=embed"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Consultar por WhatsApp"
        className="fixed bottom-5 right-5 z-[9999] h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg border border-green-600 flex items-center justify-center"
      >
        <FaWhatsapp className="text-3xl" />
      </a>
    </div>
  );
}
