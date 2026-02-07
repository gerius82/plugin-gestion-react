import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaMoneyBillWave } from "react-icons/fa";

export default function InfoCumples() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const rutaVolver = from === "cumples-menu" ? "/cumples-menu" : "/menu-padres";
  const [config, setConfig] = useState(null);
  const [precioCumple, setPrecioCumple] = useState(null);
  const [promoCumple, setPromoCumple] = useState("");
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
          `${config.supabaseUrl}/rest/v1/cumples_config?select=precio,promo&id=eq.global`,
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
      } catch {
        setPrecioCumple(null);
        setPromoCumple("");
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

  const continuar = () => {
    const origin = from ? `&origin=${encodeURIComponent(from)}` : "";
    navigate(`/cumples-reservas?from=info-cumples${origin}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">Festeja tu cumple</h1>
        <button
          onClick={() => navigate(rutaVolver)}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 rounded-2xl shadow p-6 max-w-4xl mx-auto text-sm text-gray-700 space-y-6 border border-emerald-100">
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
              <div>Siempre habrá dos profes encargados de coordinar actividades, juegos y acompañar a cada chico.</div>
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
              <div>Valor del cumple: {formatPrecio(precioCumple)}.</div>
              <div>{promoCumple || promoDefault}</div>
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

        <div className="pt-2 flex justify-center">
          <button
            onClick={continuar}
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          >
            Continuar a reservas
          </button>
        </div>
      </div>
    </div>
  );
}
