import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function CambioTurno() {
  // Ruta de regreso coherente con FichaRecuperar: /menu-padres o /alumnos-menu
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const rutaVolver = from === "alumnos-menu" ? "/alumnos-menu" : "/menu-padres";

  const [config, setConfig] = useState(null);
  const [telefono, setTelefono] = useState("");

  const [alumnos, setAlumnos] = useState([]); // [{id,nombre,apellido,sede,turno_1,selected}]
  const [sede, setSede] = useState("");

  const [tipoInscripcion, setTipoInscripcion] = useState("");

  const [cuposMaximos, setCuposMaximos] = useState({}); // {SEDE: {"lunes 18:00": 15, ...}}
  const [conteoPorTurno, setConteoPorTurno] = useState({}); // {"lunes 18:00": 12}

  const [turnosDisponibles, setTurnosDisponibles] = useState([]); // [{turno, disponible}]
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Cargar config + cupos
  useEffect(() => {
    fetch("/config.json")
      .then((r) => r.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar la configuración (config.json)."));

  }, []);

  const headers = () => ({
    apikey: config?.supabaseKey ?? "",
    Authorization: `Bearer ${config?.supabaseKey ?? ""}`,
  });

  // 👇 nuevo: carga turnos.json o turnos_verano.json
  const cargarCupos = async (tipo) => {
    try {
      const archivo =
        tipo === "TDV" ? "/turnos_verano.json" : "/turnos.json";

      const r = await fetch(archivo);
      const json = await r.json();
      setCuposMaximos(json || {});
    } catch (e) {
      console.error(e);
      setError((prev) => prev || "No pude cargar los cupos de turnos.");
    }
  };

  const selectedCount = useMemo(
    () => alumnos.filter((a) => a.selected).length,
    [alumnos]
  );

  // Buscar alumnos por teléfono
  const buscar = async () => {
    setError("");
    setOkMsg("");
    setAlumnos([]);
    setTurnosDisponibles([]);
    setTurnoSeleccionado("");

    const tel = telefono.trim().replace(/\D/g, "");
    if (!tel) {
      setError("Ingresá un número de teléfono válido.");
      return;
    }
    if (!config) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?telefono=ilike.*${tel}*&select=id,nombre,apellido,sede,turno_1,tipo_inscripcion`,
        { headers: headers() }
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setError("No se encontraron alumnos con ese teléfono.");
        setLoading(false);
        return;
      }

      const conCheck = data.map((a) => ({ ...a, selected: true }));
      setAlumnos(conCheck);
      setSede(conCheck[0].sede);

      // 👇 nuevo: deducir tipo_inscripcion (default: CICLO_2025)
      const tipo =
        conCheck[0].tipo_inscripcion && conCheck[0].tipo_inscripcion !== ""
          ? conCheck[0].tipo_inscripcion
          : "CICLO_2025";

      setTipoInscripcion(tipo);

      // cargar turnos correctos y calcular disponibilidad
      await cargarCupos(tipo);

      await calcularDisponibilidad(conCheck, conCheck[0].sede, tipo);
    } catch (e) {
      console.error(e);
      setError("Error al buscar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Recalcular disponibilidad si cambia selección o conteos
  useEffect(() => {
    if (!sede || alumnos.length === 0) return;
    calcularListaTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCount, conteoPorTurno, sede, cuposMaximos, alumnos]);

  // Obtiene conteo por turno en la sede y arma lista de turnos (excluyendo turno actual)
  const calcularDisponibilidad = async (alumnosList, sedeSel, tipo = tipoInscripcion) => {
    if (!config) return;

    try {
      const tipoQuery = tipo
      ? `&tipo_inscripcion=eq.${encodeURIComponent(tipo)}`
      : "";

      // Conteo actual de inscriptos por turno en la sede
      const resInscriptos = await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&sede=eq.${encodeURIComponent(
          sedeSel
        )}${tipoQuery}&select=turno_1`,
        { headers: headers() }
      );
      const insc = await resInscriptos.json();
      const conteo = {};
      insc.forEach((i) => {
        const t = i.turno_1;
        conteo[t] = (conteo[t] || 0) + 1;
      });
      setConteoPorTurno(conteo);

      // Generar lista de turnos filtrando el/los turnos actuales
      calcularListaTurnos(alumnosList, sedeSel, conteo);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || "No pude calcular la disponibilidad.");
    }
  };

  const calcularListaTurnos = (
    alumnosList = alumnos,
    sedeSel = sede,
    conteo = conteoPorTurno
  ) => {
    if (!sedeSel || !cuposMaximos[sedeSel]) return;

    const turnosActuales = new Set(alumnosList.map((a) => a.turno_1));
    const base = Object.keys(cuposMaximos[sedeSel] || {})
      .filter((t) => !turnosActuales.has(t));

    const lista = base.map((t) => {
      const max = cuposMaximos[sedeSel][t];
      const actuales = conteo[t] || 0;
      return {
        turno: t,
        disponible: actuales + selectedCount <= max,
      };
    });

    // Si el seleccionado se quedó sin lugar, deseleccionar
    if (!lista.find((x) => x.turno === turnoSeleccionado && x.disponible)) {
      setTurnoSeleccionado("");
    }

    setTurnosDisponibles(lista);
  };

  const toggleAlumno = (id) => {
    setAlumnos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  };

  const confirmarCambio = async () => {
    setError("");
    setOkMsg("");

    const seleccionados = alumnos.filter((a) => a.selected);
    if (seleccionados.length === 0) {
      setError("Seleccioná al menos un alumno.");
      return;
    }
    if (!turnoSeleccionado) {
      setError("Seleccioná un turno nuevo antes de confirmar.");
      return;
    }

    // Abrir WhatsApp con el mensaje formateado
    const mensaje = encodeURIComponent(
      `_Solicitud de cambio de turno:_\n` +
        seleccionados
          .map(
            (a) => `👤 *Alumno:* ${a.nombre} ${a.apellido}\n🕒 *Turno actual:* ${a.turno_1}\n🆕 *Nuevo turno:* ${turnoSeleccionado}`
          )
          .join("\n\n")
    );
    const link = `https://wa.me/543412153057?text=${mensaje}`;
    window.open(link, "_blank");

    if (!config) return;

    setProcessing(true);
    try {
      // Actualizar inscripciones en Supabase
      for (const a of seleccionados) {
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${a.id}`,
          {
            method: "PATCH",
            headers: {
              ...headers(),
              "Content-Type": "application/json",
              prefer: "return=representation",
            },
            body: JSON.stringify({ turno_1: turnoSeleccionado }),
          }
        );
      }
      setOkMsg("Solicitud enviada y turno actualizado en el sistema.");
      // Refrescar datos de capacidad para reflejar el cambio
      await calcularDisponibilidad(
        alumnos.map((x) =>
          seleccionados.find((s) => s.id === x.id)
            ? { ...x, turno_1: turnoSeleccionado }
            : x
        ),
        sede,
        tipoInscripcion
      );
    } catch (e) {
      console.error(e);
      setError("No pude actualizar el turno. Revisá la conexión e intentá nuevamente.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow">
      <h2 className="text-2xl font-bold text-center mb-2">Solicitar cambio de turno</h2>
      <p className="text-sm text-gray-600 text-center mb-4">
        Podés solicitar un cambio de turno si hay disponibilidad en la misma sede.
      </p>

      <label className="block font-medium mb-1">Buscar por teléfono</label>
      <input
        type="tel"
        className="w-full border p-2 rounded mb-3"
        placeholder="Ej: 3411234567"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <button
        onClick={buscar}
        disabled={loading || !config}
        className="px-4 py-2 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "Buscando..." : "Buscar"}
      </button>

      {(error || okMsg) && (
        <div className={`mt-4 text-sm font-medium ${error ? "text-red-600" : "text-emerald-700"}`}>
          {error || okMsg}
        </div>
      )}

      {alumnos.length > 0 && (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Alumnos encontrados</h3>
            <ul className="space-y-2">
              {alumnos.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={a.selected}
                    onChange={() => toggleAlumno(a.id)}
                  />
                  <span className="text-gray-800 text-sm">
                    {a.nombre} {a.apellido}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 border rounded-md p-3">
            <h4 className="font-medium mb-1">Turno(s) actual(es)</h4>
            <ul className="list-disc list-inside text-sm text-gray-700">
              {[...new Set(alumnos.map((a) => a.turno_1))].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Turnos disponibles en la misma sede</h4>
            {turnosDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600">No hay turnos configurados para esta sede.</p>
            ) : (
              <div className="space-y-2">
                {turnosDisponibles.map((t) => {
                  const habil = t.disponible;
                  const isSel = turnoSeleccionado === t.turno;
                  return (
                    <button
                      key={t.turno}
                      type="button"
                      onClick={() => habil && setTurnoSeleccionado(t.turno)}
                      disabled={!habil}
                      className={[
                        "w-full text-left px-4 py-2 rounded border text-sm transition",
                        habil
                          ? isSel
                            ? "bg-green-200 border-green-500 font-semibold hover:bg-green-300"
                            : "bg-green-50 border-green-200 hover:bg-green-100"
                          : "bg-red-100 border-red-300 text-red-700 hover:bg-red-200 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {t.turno}
                    </button>
                  );
                })}
              </div>
            )}
            {turnosDisponibles.filter((t) => t.disponible).length === 0 && turnosDisponibles.length > 0 && (
              <p className="text-sm font-semibold text-red-700 mt-2">
                No hay turnos disponibles para la cantidad seleccionada.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={confirmarCambio}
              disabled={processing}
              className="flex-1 px-4 py-2 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50"
            >
              {processing ? "Enviando..." : "Solicitar por WhatsApp"}
            </button>
          </div>
        </div>
      )}

      {/* Botón volver */}
      <div className="mt-2 w-fit mx-auto">
        <Link
          to={rutaVolver}
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
        </Link>
      </div>
    </div>
  );
}
