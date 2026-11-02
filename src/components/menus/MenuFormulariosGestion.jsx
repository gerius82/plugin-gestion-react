import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaEye, FaSun } from "react-icons/fa";

const CICLO_VERANO = "TDV_2027";

const fechaArgentina = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatearFecha = (valor) => {
  if (!valor) return "";
  const [anio, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
};

const rutaFormulario = (codigo) =>
  codigo === CICLO_VERANO
    ? "/formulario-verano?origen=gestion"
    : `/menu-inscripcion-cursos?origen=gestion&ciclo=${encodeURIComponent(codigo)}`;

export default function MenuFormulariosGestion() {
  const navigate = useNavigate();
  const [ciclos, setCiclos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const config = await fetch("/config.json").then((res) => res.json());
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/ciclos?select=*&order=orden.asc,fecha_inicio.desc`,
          {
            headers: {
              apikey: config.supabaseKey,
              Authorization: `Bearer ${config.supabaseKey}`,
            },
          }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setCiclos((Array.isArray(data) ? data : []).filter((ciclo) => ciclo.codigo !== "TDV"));
      } catch (err) {
        console.error(err);
        setError("No pude cargar los formularios configurados.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const hoy = fechaArgentina();

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-md">
        <button
          type="button"
          onClick={() => navigate("/menu-gestion")}
          aria-label="Volver al menú de gestión"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200"
        >
          <FaArrowLeft />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formularios de inscripción</h1>
          <p className="text-sm text-gray-600">
            Vista administrativa de los formularios que se muestran a las familias.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
        <strong>Acceso de administrador:</strong> podés abrir, completar y generar una inscripción
        desde cualquier formulario, aunque todavía no esté publicado para las familias.
      </div>

      {cargando && <div className="rounded-xl bg-white p-8 text-center text-gray-500">Cargando formularios…</div>}
      {!cargando && error && <div className="rounded-xl bg-white p-8 text-center text-red-600">{error}</div>}

      {!cargando && !error && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {ciclos.map((ciclo) => {
            const futura = ciclo.fecha_inicio && ciclo.fecha_inicio > hoy;
            const finalizada = ciclo.fecha_fin && ciclo.fecha_fin < hoy;
            const publicada = Boolean(ciclo.activo && !futura && !finalizada);
            const Icono = ciclo.codigo === CICLO_VERANO ? FaSun : FaCalendarAlt;

            return (
              <Link
                key={ciclo.id || ciclo.codigo}
                to={rutaFormulario(ciclo.codigo)}
                className="group rounded-2xl border-l-8 border-cyan-500 bg-white p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <Icono className={`mt-1 shrink-0 text-3xl ${ciclo.codigo === CICLO_VERANO ? "text-yellow-500" : "text-cyan-600"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{ciclo.nombre_publico || ciclo.codigo}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${publicada ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {publicada ? "Visible para familias" : futura ? "Próximamente" : finalizada ? "Finalizado" : "Oculto para familias"}
                      </span>
                    </div>
                    {ciclo.descripcion && <p className="mt-2 text-sm text-gray-600">{ciclo.descripcion}</p>}
                    {(ciclo.fecha_inicio || ciclo.fecha_fin) && (
                      <p className="mt-2 text-xs text-gray-500">
                        {ciclo.fecha_inicio ? `Desde ${formatearFecha(ciclo.fecha_inicio)}` : ""}
                        {ciclo.fecha_inicio && ciclo.fecha_fin ? " · " : ""}
                        {ciclo.fecha_fin ? `Hasta ${formatearFecha(ciclo.fecha_fin)}` : ""}
                      </p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-2 font-semibold text-cyan-700 group-hover:text-cyan-800">
                      <FaEye /> Ver formulario
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!cargando && !error && ciclos.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-gray-500">No hay ciclos configurados.</div>
      )}
    </div>
  );
}
