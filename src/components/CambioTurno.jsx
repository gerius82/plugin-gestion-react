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

  const [alumnos, setAlumnos] = useState([]); // [{matricula_id,alumno_id,nombre,apellido,sede,dia,hora,turno_1,ciclo_codigo,selected}]
  const [sede, setSede] = useState("");

  const [cicloCodigo, setCicloCodigo] = useState("");

  const [cuposMaximos, setCuposMaximos] = useState({}); // {"lunes||18:00": 15}
  const [conteoPorTurno, setConteoPorTurno] = useState({}); // {"lunes||18:00": 12}

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

  // Carga cupos desde la tabla turnos
  const cargarCupos = async (cicloSel, sedeSel) => {
    if (!config || !cicloSel || !sedeSel) return;
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/turnos?select=dia,hora,cupo_maximo` +
          `&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
          `&sede=eq.${encodeURIComponent(sedeSel)}` +
          `&activo=eq.true`,
        { headers: headers() }
      );
      const data = await res.json();
      const cupos = {};
      (Array.isArray(data) ? data : []).forEach((t) => {
        const key = `${t.dia}||${t.hora}`;
        cupos[key] = Number(t.cupo_maximo);
      });
      setCuposMaximos(cupos);
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
        `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,sede,dia,hora,ciclo_codigo,inscripciones!inner(nombre,apellido,telefono)` +
          `&estado=eq.activa` +
          `&inscripciones.telefono=ilike.*${tel}*`,
        { headers: headers() }
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setError("No se encontraron alumnos con ese teléfono.");
        setLoading(false);
        return;
      }

      const conCheck = data.map((a) => ({
        matricula_id: a.id,
        alumno_id: a.alumno_id,
        nombre: a.inscripciones?.nombre || "",
        apellido: a.inscripciones?.apellido || "",
        sede: a.sede,
        dia: a.dia,
        hora: a.hora,
        turno_1: `${a.dia} ${a.hora}`,
        ciclo_codigo: a.ciclo_codigo,
        selected: true,
      }));
      setAlumnos(conCheck);
      setSede(conCheck[0].sede);

      const ciclo = conCheck[0].ciclo_codigo || "";
      setCicloCodigo(ciclo);

      await cargarCupos(ciclo, conCheck[0].sede);
      await calcularDisponibilidad(conCheck, conCheck[0].sede, ciclo);
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
  const calcularDisponibilidad = async (alumnosList, sedeSel, cicloSel = cicloCodigo) => {
    if (!config) return;

    try {
      // Conteo actual de matriculas por turno en la sede
      const resInscriptos = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=dia,hora` +
          `&estado=eq.activa` +
          `&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
          `&sede=eq.${encodeURIComponent(sedeSel)}`,
        { headers: headers() }
      );
      const insc = await resInscriptos.json();
      const conteo = {};
      (Array.isArray(insc) ? insc : []).forEach((i) => {
        const key = `${i.dia}||${i.hora}`;
        conteo[key] = (conteo[key] || 0) + 1;
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
    if (!sedeSel || !Object.keys(cuposMaximos || {}).length) return;

    const turnosActuales = new Set(
      alumnosList.map((a) => `${a.dia}||${a.hora}`)
    );
    const base = Object.keys(cuposMaximos || {}).filter(
      (key) => !turnosActuales.has(key)
    );

    const lista = base.map((key) => {
      const max = cuposMaximos[key];
      const actuales = conteo[key] || 0;
      const [dia, hora] = key.split("||");
      return {
        dia,
        hora,
        turno: `${dia} ${hora}`,
        disponible: Number.isFinite(max) ? actuales + selectedCount <= max : true,
      };
    });

    // Si el seleccionado se quedó sin lugar, deseleccionar
    if (!lista.find((x) => x.turno === turnoSeleccionado && x.disponible)) {
      setTurnoSeleccionado("");
    }

    setTurnosDisponibles(lista);
  };

  const toggleAlumno = (matriculaId) => {
    setAlumnos((prev) =>
      prev.map((a) =>
        a.matricula_id === matriculaId ? { ...a, selected: !a.selected } : a
      )
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
      const idx = turnoSeleccionado.indexOf(" ");
      const diaNuevo = idx > -1 ? turnoSeleccionado.slice(0, idx) : turnoSeleccionado;
      const horaNuevo = idx > -1 ? turnoSeleccionado.slice(idx + 1) : "";
      for (const a of seleccionados) {
        await fetch(`${config.supabaseUrl}/rest/v1/matriculas?id=eq.${a.matricula_id}`, {
          method: "PATCH",
          headers: {
            ...headers(),
            "Content-Type": "application/json",
            prefer: "return=representation",
          },
          body: JSON.stringify({ dia: diaNuevo, hora: horaNuevo }),
        });
      }
      setOkMsg("Solicitud enviada y turno actualizado en el sistema.");
      // Refrescar datos de capacidad para reflejar el cambio
      await calcularDisponibilidad(
        alumnos.map((x) =>
          seleccionados.find((s) => s.matricula_id === x.matricula_id)
            ? { ...x, dia: diaNuevo, hora: horaNuevo, turno_1: turnoSeleccionado }
            : x
        ),
        sede,
        cicloCodigo
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
                <li key={a.matricula_id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={a.selected}
                    onChange={() => toggleAlumno(a.matricula_id)}
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
