const AutorizacionImagenesModal = ({ abierto, nombreAlumno, procesando, onDecidir, onVolver }) => {
  if (!abierto) return null;

  const nombre = String(nombreAlumno || "").trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-autorizacion-imagenes"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 px-6 py-6 sm:px-8">
          <div className="mb-3 text-4xl" aria-hidden="true">📸🤖</div>
          <h2 id="titulo-autorizacion-imagenes" className="text-2xl font-bold text-slate-900">
            ¿Nos autorizás a compartir sus proyectos?
          </h2>
          <p className="mt-3 leading-relaxed text-slate-700">
            En PLUGIN nos encanta mostrar cómo {nombre || "los chicos y chicas"} crea, aprende y supera
            desafíos. Las fotos y videos de las actividades nos ayudan a celebrar ese trabajo y a que otras
            familias conozcan la experiencia del taller.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6 sm:px-8">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            El material podrá utilizarse únicamente con fines institucionales y para difundir las actividades
            de PLUGIN en sus redes y comunicaciones.
          </div>

          <p className="text-sm text-slate-600">
            La decisión es voluntaria, no modifica la inscripción y puede cambiarse más adelante comunicándose
            con el instituto.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir(true)}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-wait disabled:opacity-60"
            >
              Sí, autorizo
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir(false)}
              className="rounded-xl border-2 border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
            >
              Prefiero no autorizar
            </button>
          </div>

          <button
            type="button"
            disabled={procesando}
            onClick={onVolver}
            className="w-full py-1 text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline disabled:opacity-60"
          >
            Volver al resumen
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutorizacionImagenesModal;
