import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function FichaRecuperar() {
  // Ruta de regreso: por defecto /menu-padres; si viene con ?from=alumnos-menu => /alumnos-menu
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const rutaVolver = from === "alumnos-menu" ? "/alumnos-menu" : "/menu-padres";

  const [config, setConfig] = useState(null);
  const [telefono, setTelefono] = useState("");
  const [alumnos, setAlumnos] = useState([]); // [{matricula_id, alumno_id, nombre, apellido, sede, dia, hora, turno_1, ciclo_codigo, selected}]
  const [sede, setSede] = useState("");


  const [ausencias, setAusencias] = useState([]); // ["12 de agosto", "19 de agosto (próxima clase)"]
  const [faltaSeleccionada, setFaltaSeleccionada] = useState("");

  const [turnos, setTurnos] = useState([]); // [{turno: "lunes 18:00", disponible: true}]
  const [turnoSeleccionado, setTurnoSeleccionado] = useState("");

  const [conteoPorTurno, setConteoPorTurno] = useState({}); // {"lunes||18:00": 12}
  const [cuposMaximos, setCuposMaximos] = useState({}); // {"lunes||18:00": max}

  const [diaSeleccionado, setDiaSeleccionado] = useState(null); // {date: Date, iso: "YYYY-MM-DD", etiqueta: "lun 12/08", diaNombre: "lunes"}

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Cargar config
  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar la configuración (config.json)."));
  }, []);

  const headers = () => ({
    apikey: config?.supabaseKey ?? "",
    Authorization: `Bearer ${config?.supabaseKey ?? ""}`,
  });

  const selectedCount = useMemo(
    () => alumnos.filter((a) => a.selected).length,
    [alumnos]
  );

  // Generar las próximas 2 semanas (14 días) mostrando lunes a sábado
  const diasCalendario = useMemo(() => {
    const hoy = new Date();
    const lista = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const day = d.getDay(); // 0 dom ... 6 sab
      if (day === 0) continue; // excluir domingos
      const etiqueta = etiquetaCortaDia(d);
      const iso = toISO(d);
      const diaNombre = nombreDia(d); // "lunes".."sábado"
      lista.push({ date: d, iso, etiqueta, diaNombre });
    }
    return lista;
  }, []);

  // Buscar por teléfono
  const buscar = async () => {
    setError("");
    setOkMsg("");
    setAlumnos([]);
    setAusencias([]);
    setTurnos([]);
    setTurnoSeleccionado("");
    setFaltaSeleccionada("");
    setDiaSeleccionado(null);

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

      // Deducir ciclo
      const ciclo = conCheck[0].ciclo_codigo || "";
      await cargarAusenciasYCapacidad(conCheck, conCheck[0].sede, ciclo);
    } catch (e) {
      console.error(e);
      setError("Error al buscar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Carga ausencias, calcula próxima clase y capacidad por turno
  const cargarAusenciasYCapacidad = async (alumnosList, sedeSel, ciclo) => {
    if (!config) return;
    let cuposLocal = {};

    // 1) Ausencias sin recuperar + fecha futura (próxima clase)
    try {
      const ids = alumnosList.map((a) => a.alumno_id);
      const resFaltas = await fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?alumno_id=in.(${ids.join(",")})&tipo=eq.ausente&recuperada=is.false&order=fecha.desc&limit=4&select=fecha`,
        { headers: headers() }
      );
      const faltas = await resFaltas.json();

      const yaIncluidas = new Set();
      const opciones = [];

      // pasadas
      faltas.forEach((a) => {
        const [y, m, d] = a.fecha.split("T")[0].split("-");
        const f = `${parseInt(d)} de ${obtenerNombreMes(parseInt(m))}`;
        if (!yaIncluidas.has(f)) {
          opciones.push(f);
          yaIncluidas.add(f);
        }
      });

      // próxima futura según turno_1 del primer alumno
      const turnoOriginal = alumnosList[0].turno_1?.toLowerCase();
      const proxima = calcularProximaClase(turnoOriginal);
      if (proxima && !yaIncluidas.has(proxima)) {
        opciones.push(`${proxima} (próxima clase)`);
        yaIncluidas.add(proxima);
      }

      if (opciones.length === 0) opciones.push("No hay fechas para recuperar");

      setAusencias(opciones);
      setFaltaSeleccionada(opciones[0] || "");
    } catch (e) {
      console.error(e);
      setError("No pude cargar las ausencias.");
    }

    // 2) Cupos máximos por sede
    try {
      const resTurnos = await fetch(
        `${config.supabaseUrl}/rest/v1/turnos?select=dia,hora,cupo_maximo` +
          `&ciclo_codigo=eq.${encodeURIComponent(ciclo)}` +
          `&sede=eq.${encodeURIComponent(sedeSel)}` +
          `&activo=eq.true`,
        { headers: headers() }
      );
      const turnosData = await resTurnos.json();
      const cupos = {};
      (Array.isArray(turnosData) ? turnosData : []).forEach((t) => {
        const key = `${t.dia}||${t.hora}`;
        cupos[key] = Number(t.cupo_maximo);
      });
      cuposLocal = cupos;
      setCuposMaximos(cupos);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || "No pude cargar los cupos de turnos.");
    }

    // 3) Conteo actual de inscriptos por turno en la sede
    try {
      const resInscriptos = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=dia,hora` +
          `&estado=eq.activa` +
          `&ciclo_codigo=eq.${encodeURIComponent(ciclo)}` +
          `&sede=eq.${encodeURIComponent(sedeSel)}`,
        { headers: headers() }
      );

      const inscriptos = await resInscriptos.json();
      const conteo = {};
      (Array.isArray(inscriptos) ? inscriptos : []).forEach((i) => {
        const key = `${i.dia}||${i.hora}`;
        conteo[key] = (conteo[key] || 0) + 1;
      });
      setConteoPorTurno(conteo);

      const lista = Object.keys(cuposLocal || {}).map((key) => {
        const [dia, hora] = key.split("||");
        return {
          dia,
          hora,
          turno: `${dia} ${hora}`,
          disponible: true,
        };
      });
      setTurnos(lista);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || "No pude calcular la disponibilidad.");
    }
  };

  // Recalcular disponibilidad cuando cambian seleccionados / cupos / conteos
  useEffect(() => {
    if (!sede || !Object.keys(cuposMaximos || {}).length) return;
    const lista = Object.keys(cuposMaximos || {}).map((key) => {
      const max = cuposMaximos[key];
      const actuales = conteoPorTurno[key] || 0;
      const [dia, hora] = key.split("||");
      return {
        dia,
        hora,
        turno: `${dia} ${hora}`,
        disponible: actuales + selectedCount <= max,
      };
    });
    // Si el turno seleccionado quedó sin disponibilidad, lo deseleccionamos
    if (!lista.find((x) => x.turno === turnoSeleccionado && x.disponible)) {
      setTurnoSeleccionado("");
    }
    setTurnos(lista);
  }, [selectedCount, cuposMaximos, conteoPorTurno, sede]);

  // Resetear turno cuando cambia el día
  useEffect(() => {
    setTurnoSeleccionado("");
  }, [diaSeleccionado]);

  // Click en checkbox alumno
  const toggleAlumno = (matriculaId) => {
    setAlumnos((prev) =>
      prev.map((a) =>
        a.matricula_id === matriculaId ? { ...a, selected: !a.selected } : a
      )
    );
  };

  // Botón WhatsApp + escritura en Supabase
  const confirmarPorWhatsapp = async () => {
    setError("");
    setOkMsg("");

    const seleccionados = alumnos.filter((a) => a.selected);
    if (seleccionados.length === 0) {
      setError("Seleccioná al menos un alumno para recuperar.");
      return;
    }
    if (!diaSeleccionado) {
      setError("Seleccioná un día en el almanaque.");
      return;
    }
    if (!turnoSeleccionado) {
      setError("Seleccioná un turno antes de confirmar.");
      return;
    }

    const falta = faltaSeleccionada || "sin especificar";
    const nombres = seleccionados.map((a) => `${a.nombre} ${a.apellido}`);

    // Abrir WhatsApp con el mensaje formateado
    const mensaje = encodeURIComponent(
      `_Solicitud de recuperación de clase:_\n` +
        `👤 *Solicitante:* ${nombres.join("\n👤 *Solicitante:* ")}\n` +
        `❌ *Ausencia:* ${falta}\n` +
        `📅 *Fecha elegida:* ${formatearFechaLarga(diaSeleccionado.date)}\n` +
        `✅ *Recupera:* ${turnoSeleccionado}`
    );
    const link = `https://wa.me/543412153057?text=${mensaje}`;
    window.open(link, "_blank");

    if (!config) return;

    // Operaciones en Supabase
    setProcessing(true);
    try {
      for (const a of seleccionados) {
        const fechaHoy = new Date().toISOString().split("T")[0];
        const fechaRecuperaISO = diaSeleccionado?.iso || fechaHoy;
        const faltaEsProxima = falta.toLowerCase().includes("próxima");

        if (falta !== "No hay fechas para recuperar") {
          if (!faltaEsProxima) {
            // 1) Buscar registro de ausencia exacto y marcar recuperada=true
            const fechaFaltaISO = convertirFechaTextoAISO(falta);
            const resBuscar = await fetch(
              `${config.supabaseUrl}/rest/v1/asistencias?alumno_id=eq.${a.alumno_id}&fecha=eq.${fechaFaltaISO}&tipo=eq.ausente&select=id`,
              { headers: headers() }
            );
            const [registro] = await resBuscar.json();
            if (registro?.id) {
              await fetch(
                `${config.supabaseUrl}/rest/v1/asistencias?id=eq.${registro.id}`,
                {
                  method: "PATCH",
                  headers: {
                    ...headers(),
                    "Content-Type": "application/json",
                    prefer: "return=representation",
                  },
                  body: JSON.stringify({ recuperada: true }),
                }
              );
            }
          } else {
            // 2) Si es "próxima clase": crear un ausente recuperada en la fecha futura (según falta)
            const fechaProximaISO = convertirFechaTextoAISO(falta);
            await fetch(`${config.supabaseUrl}/rest/v1/asistencias`, {
              method: "POST",
              headers: { ...headers(), "Content-Type": "application/json" },
              body: JSON.stringify({
                alumno_id: a.alumno_id,
                fecha: fechaProximaISO,
                tipo: "ausente",
                recuperada: true,
                turno: alumnos[0]?.turno_1,
                sede: alumnos[0]?.sede,
              }),
            });
          }
        }

        // 3) Registrar movimiento de recuperación en la fecha elegida
        await fetch(`${config.supabaseUrl}/rest/v1/asistencias`, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({
            alumno_id: a.alumno_id,
            fecha: fechaRecuperaISO,
            tipo: "recuperacion",
            turno: turnoSeleccionado,
            sede: alumnos[0]?.sede,
          }),
        });
      }
      setOkMsg("Solicitud enviada y registros actualizados.");
    } catch (e) {
      console.error(e);
      setError("No pude actualizar los registros. Revisá la conexión e intentá de nuevo.");
    } finally {
      setProcessing(false);
    }
  };

  // Turnos filtrados por el día elegido (coincidencia por nombre del día al inicio)
  const turnosDelDia = useMemo(() => {
    if (!diaSeleccionado) return [];
    const pref = normalizarDia(diaSeleccionado.diaNombre);
    return turnos.filter(
      (t) => normalizarDia(t.dia || t.turno?.split(" ")[0]) === pref
    );
  }, [turnos, diaSeleccionado]);

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded-2xl shadow">
      <h2 className="text-2xl font-bold text-center mb-2">Recuperar una clase</h2>
      <p className="text-sm text-gray-600 text-center mb-4">
        En esta sección podés consultar las clases para recuperar, ver tus ausencias y elegir un turno disponible.
      </p>
      <div className="bg-gray-50 border rounded-md p-3 text-sm text-gray-700 mb-4">
        <p className="font-semibold mb-1">Recordamos:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>✅ Las ausencias justificadas podrán recuperarse en otros turnos según disponibilidad.</li>
          <li>🚫 Los feriados NO podrán recuperarse.</li>
        </ul>
      </div>

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
                  <span className="text-gray-800 text-sm">{a.nombre} {a.apellido}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block font-medium mb-1">Seleccioná una ausencia</label>
            <select
              className="w-full border p-2 rounded"
              value={faltaSeleccionada}
              onChange={(e) => setFaltaSeleccionada(e.target.value)}
            >
              {ausencias.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Almanaque de 2 semanas (lunes a sábado) */}
          <div>
            <h4 className="font-medium mb-2">Elegí un día para recuperar (próximas 2 semanas)</h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {diasCalendario.map((d) => {
                const seleccionado = diaSeleccionado?.iso === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setDiaSeleccionado(d)}
                    className={[
                      "px-2 py-2 rounded-md text-sm border transition",
                      seleccionado
                        ? "bg-green-100 border-green-500 font-semibold hover:bg-green-200"
                        : "bg-white border-gray-200 hover:bg-green-50"
                    ].join(" ")}
                    aria-pressed={seleccionado}
                  >
                    <div className="text-xs text-gray-600 capitalize">{d.diaNombre.slice(0,3)}</div>
                    <div className="font-medium">{d.etiqueta.split(" ")[1]}</div>
                  </button>
                );
              })}
            </div>
            {!diaSeleccionado && (
              <p className="text-xs text-gray-500 mt-2">Tip: primero elegí el día y después el turno.</p>
            )}
          </div>

          <div>
            <h4 className="font-medium mb-2">Turnos disponibles para recuperar</h4>
            {!diaSeleccionado ? (
              <p className="text-sm text-gray-600">Seleccioná un día del almanaque para ver los turnos.</p>
            ) : (
              <>
                <p className="text-xs text-gray-600 mb-2">
                  Turnos del <span className="font-medium">{formatearFechaLarga(diaSeleccionado.date)}</span>
                </p>
                <div className="space-y-2">
                  {turnosDelDia.map((t) => {
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
                {turnosDelDia.length === 0 && (
                  <p className="text-sm text-gray-600 mt-2">No hay turnos configurados para este día.</p>
                )}
                {turnosDelDia.filter((t) => t.disponible).length === 0 && turnosDelDia.length > 0 && (
                  <p className="text-sm font-semibold text-red-700 mt-2">
                    No hay turnos disponibles para la cantidad seleccionada.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={confirmarPorWhatsapp}
              disabled={processing}
              className="flex-1 px-4 py-2 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50"
            >
              {processing ? "Enviando..." : "Enviar solicitud por WhatsApp"}
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

// Utils
function obtenerNombreMes(m) {
  return [
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
  ][m - 1];
}

function normalizarDia(valor) {
  const lower = String(valor || "").toLowerCase();
  const arreglado = lower
    .replace("miç¸rcoles", "miercoles")
    .replace("miã©rcoles", "miercoles")
    .replace("sç­bado", "sabado")
    .replace("sã¡bado", "sabado");
  return arreglado.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcularProximaClase(turno) {
  if (!turno) return "";
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const hoy = new Date();
  const [diaNombre] = turno.split(" ");
  const diaDeseado = dias.findIndex((d) => normalizarDia(d) === normalizarDia(diaNombre));
  if (diaDeseado === -1) return "";
  const delta = ((diaDeseado - hoy.getDay() + 7) % 7) || 7;
  const proxima = new Date(hoy);
  proxima.setDate(hoy.getDate() + delta);
  return `${proxima.getDate()} de ${obtenerNombreMes(proxima.getMonth() + 1)}`;
}

function convertirFechaTextoAISO(texto) {
  // "12 de agosto" o "12 de agosto (próxima clase)"
  const limpio = texto.replace(/\s*\(próxima clase\)\s*/i, "");
  const partes = limpio.split(" ");
  const dia = partes[0].padStart(2, "0");
  const mesTexto = partes[2];
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
  const mes = (meses.indexOf(mesTexto?.toLowerCase()) + 1).toString().padStart(2, "0");
  const hoy = new Date();
  const anio = hoy.getFullYear();
  return `${anio}-${mes}-${dia}`;
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nombreDia(d) {
  return [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ][d.getDay()];
}

function etiquetaCortaDia(d) {
  // ej: "lun 12/08"
  const abrevs = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${abrevs[d.getDay()]} ${dd}/${mm}`;
}

function formatearFechaLarga(d) {
  return `${d.getDate()} de ${obtenerNombreMes(d.getMonth() + 1)}`;
}
