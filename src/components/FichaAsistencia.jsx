import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FichaAsistencia = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from")}`;

  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [sede, setSede] = useState("");
  const [dia, setDia] = useState("");
  const [horario, setHorario] = useState("");
  const [fecha, setFecha] = useState("");
  const [listaMostrada, setListaMostrada] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cicloCodigo, setCicloCodigo] = useState("");
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);

  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await (await fetch("/config.json")).json();
      setConfig(cfg);
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      );
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setCiclosDisponibles(lista);
      if (!cicloCodigo && lista.length > 0) {
        const activo = lista.find((c) => c.activo) || lista[0];
        setCicloCodigo(activo?.codigo || "");
      }
    })();
  }, [config, cicloCodigo]);

  useEffect(() => {
    if (!config) return;

    const loadData = async () => {
      setCargando(true);
      const filtroCiclo = cicloCodigo ? `&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}` : "";
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,ciclo_codigo,sede,dia,hora,estado,curso_nombre,inscripciones(nombre,apellido)&estado=eq.activa${filtroCiclo}`,
        {
          headers: {
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
        }
      );
      const data = await res.json();
      const lista = (Array.isArray(data) ? data : []).map((m) => {
        const alumno = Array.isArray(m.inscripciones) ? m.inscripciones[0] : m.inscripciones || {};
        return {
          id: m.id,
          alumno_id: m.alumno_id,
          nombre: alumno.nombre,
          apellido: alumno.apellido,
          sede: m.sede,
          dia: m.dia,
          hora: m.hora,
          curso: m.curso_nombre,
          ciclo_codigo: m.ciclo_codigo,
        };
      });
      setAlumnos(lista);
      setSede("");
      setDia("");
      setHorario("");
      setListaMostrada([]);
      setCargando(false);
    };

    loadData();
  }, [config, cicloCodigo]);

  const ordenDias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const normalizarDia = (valor = "") =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const ordenarDias = (lista = []) =>
    [...new Set(lista)].sort((a, b) => {
      const ia = ordenDias.indexOf(normalizarDia(a));
      const ib = ordenDias.indexOf(normalizarDia(b));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const inicioDeRango = (valor) => {
    const m = String(valor || "").match(/(\d{1,2}:\d{2})/);
    return m ? m[1].padStart(5, "0") : String(valor || "");
  };

  const ordenarHorarios = (lista = []) =>
    [...new Set(lista)].sort((a, b) => inicioDeRango(a).localeCompare(inicioDeRango(b)));

  const sedesDisponibles = [...new Set(alumnos.map((a) => a.sede).filter(Boolean))].sort();
  const diasDisponibles = ordenarDias(
    alumnos
      .filter((a) => (!sede || a.sede === sede))
      .map((a) => a.dia)
      .filter(Boolean)
  );
  const horariosDisponibles = ordenarHorarios(
    alumnos
      .filter((a) => (!sede || a.sede === sede) && (!dia || a.dia === dia))
      .map((a) => a.hora)
      .filter(Boolean)
  );

  const turnoCompleto = [dia, horario].filter(Boolean).join(" ");

  const cargarListaTurno = async () => {
    if (!config || !sede || !dia || !horario) return;

    const fechaISO = fecha || new Date().toISOString().split("T")[0];
    const headersAuth = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };

    const seleccionadosBase = alumnos
      .filter((a) => a.sede === sede && a.dia === dia && a.hora === horario)
      .map((a) => ({
        ...a,
        presente: true,
        esRecuperacion: false,
        asistencia_id: null,
      }));

    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?select=id,alumno_id,tipo,fecha,turno,sede,inscripciones(nombre,apellido)&fecha=eq.${fechaISO}&sede=eq.${encodeURIComponent(sede)}&turno=eq.${encodeURIComponent(turnoCompleto)}`,
        { headers: headersAuth }
      );
      const data = await res.json();
      const existentes = Array.isArray(data) ? data : [];
      const porAlumno = new Map(existentes.map((item) => [String(item.alumno_id), item]));

      const listaRegular = seleccionadosBase.map((a) => {
        const existente = porAlumno.get(String(a.alumno_id));
        return {
          ...a,
          presente: String(existente?.tipo || "regular") !== "ausente",
          asistencia_id: existente?.id || null,
        };
      });

      const idsBase = new Set(listaRegular.map((a) => String(a.alumno_id)));
      const listaRecuperaciones = existentes
        .filter((item) => String(item.tipo || "") === "recuperacion" && !idsBase.has(String(item.alumno_id)))
        .map((item) => {
          const alumno = Array.isArray(item.inscripciones) ? item.inscripciones[0] : item.inscripciones || {};
          return {
            id: item.alumno_id,
            alumno_id: item.alumno_id,
            nombre: alumno.nombre || "",
            apellido: alumno.apellido || "",
            sede,
            dia,
            hora: horario,
            curso: "",
            presente: true,
            esRecuperacion: true,
            asistencia_id: item.id,
          };
        });

      setListaMostrada([...listaRegular, ...listaRecuperaciones]);
    } catch {
      setListaMostrada(seleccionadosBase);
    }
  };

  const agregarRecuperador = (id) => {
    if (!id) return;
    const alumno = alumnos.find((a) => String(a.id) === String(id));
    if (!alumno) return;
    setListaMostrada((prev) => {
      if (prev.some((item) => String(item.alumno_id) === String(alumno.alumno_id))) return prev;
      return [
        ...prev,
        {
          ...alumno,
          presente: true,
          esRecuperacion: true,
          asistencia_id: null,
        },
      ];
    });
  };

  const marcarAusenciaRecuperada = async (headersAuth, headersJson, alumnoId, fechaISO) => {
    const resAusencias = await fetch(
      `${config.supabaseUrl}/rest/v1/asistencias?select=id,fecha&alumno_id=eq.${alumnoId}&tipo=eq.ausente&recuperada=is.false`,
      { headers: headersAuth }
    );
    const ausenciasPendientes = await resAusencias.json();
    const listaPendientes = Array.isArray(ausenciasPendientes) ? ausenciasPendientes : [];
    if (listaPendientes.length === 0) return;

    const fechaRecuperacionMs = new Date(`${fechaISO}T00:00:00`).getTime();
    const ausenciaObjetivo = listaPendientes
      .map((item) => ({
        ...item,
        distancia: Math.abs(new Date(`${String(item.fecha).split("T")[0]}T00:00:00`).getTime() - fechaRecuperacionMs),
      }))
      .sort((a, b) => a.distancia - b.distancia)[0];

    if (!ausenciaObjetivo?.id) return;

    await fetch(`${config.supabaseUrl}/rest/v1/asistencias?id=eq.${ausenciaObjetivo.id}`, {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify({ recuperada: true }),
    });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!config || guardando) return;
    if (!sede || !turnoCompleto) {
      setMensaje("Selecciona sede y turno antes de guardar.");
      return;
    }

    setGuardando(true);

    const fechaISO = fecha || new Date().toISOString().split("T")[0];
    const headersAuth = { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` };
    const headersJson = { ...headersAuth, "Content-Type": "application/json" };

    const presentes = listaMostrada.filter((a) => a.presente && !a.esRecuperacion);
    const ausentes = listaMostrada.filter((a) => !a.presente && !a.esRecuperacion);
    const recuperacionesPresentes = listaMostrada.filter((a) => a.presente && a.esRecuperacion);
    const recuperacionesAusentes = listaMostrada.filter((a) => !a.presente && a.esRecuperacion);

    const payloadRaw = [
      ...presentes.map((a) => ({
        alumno_id: a.alumno_id || a.id,
        fecha: fechaISO,
        turno: turnoCompleto,
        sede,
        tipo: "regular",
      })),
      ...ausentes.map((a) => ({
        alumno_id: a.alumno_id || a.id,
        fecha: fechaISO,
        turno: turnoCompleto,
        sede,
        tipo: "ausente",
      })),
      ...recuperacionesPresentes.map((a) => ({
        alumno_id: a.alumno_id || a.id,
        fecha: fechaISO,
        turno: turnoCompleto,
        sede,
        tipo: "recuperacion",
      })),
    ];

    const payloadMap = new Map();
    const prioridadTipo = { regular: 1, ausente: 2, recuperacion: 3 };
    payloadRaw.forEach((p) => {
      if (!p?.alumno_id) return;
      const key = String(p.alumno_id);
      const prev = payloadMap.get(key);
      if (!prev || (prioridadTipo[p.tipo] || 0) >= (prioridadTipo[prev.tipo] || 0)) {
        payloadMap.set(key, p);
      }
    });
    const payload = Array.from(payloadMap.values());

    try {
      const existentesRes = await fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?select=id,alumno_id,tipo,fecha,turno,sede,recuperada&fecha=eq.${fechaISO}&sede=eq.${encodeURIComponent(sede)}&turno=eq.${encodeURIComponent(turnoCompleto)}`,
        { headers: headersAuth }
      );
      const existentes = await existentesRes.json();
      const existentesLista = Array.isArray(existentes) ? existentes : [];

      const porAlumno = new Map();
      existentesLista.forEach((r) => {
        const idAlumno = String(r?.alumno_id || "");
        if (!idAlumno) return;
        if (!porAlumno.has(idAlumno)) porAlumno.set(idAlumno, []);
        porAlumno.get(idAlumno).push(r);
      });

      const ops = [];

      recuperacionesAusentes.forEach((a) => {
        const existentesAlumno = porAlumno.get(String(a.alumno_id || a.id)) || [];
        existentesAlumno
          .filter((row) => String(row.tipo || "") === "recuperacion")
          .forEach((row) => {
            ops.push(
              fetch(`${config.supabaseUrl}/rest/v1/asistencias?id=eq.${row.id}`, {
                method: "DELETE",
                headers: headersAuth,
              })
            );
          });
      });

      payload.forEach((p) => {
        const idAlumno = String(p.alumno_id);
        const existentesAlumno = porAlumno.get(idAlumno) || [];

        const existeExacto = existentesAlumno.some(
          (eRow) =>
            String(eRow.fecha) === String(p.fecha) &&
            String(eRow.turno || "") === String(p.turno || "") &&
            String(eRow.sede || "") === String(p.sede || "") &&
            String(eRow.tipo || "regular") === String(p.tipo || "regular")
        );
        if (existeExacto) return;

        if (existentesAlumno.length > 0) {
          const aActualizar = existentesAlumno[0];
          ops.push(
            fetch(`${config.supabaseUrl}/rest/v1/asistencias?id=eq.${aActualizar.id}`, {
              method: "PATCH",
              headers: headersJson,
              body: JSON.stringify({ tipo: p.tipo }),
            })
          );
          return;
        }

        ops.push(
          fetch(`${config.supabaseUrl}/rest/v1/asistencias`, {
            method: "POST",
            headers: headersJson,
            body: JSON.stringify(p),
          })
        );
      });

      if (ops.length > 0) await Promise.all(ops);

      for (const alumnoRecupera of recuperacionesPresentes) {
        await marcarAusenciaRecuperada(headersAuth, headersJson, alumnoRecupera.alumno_id, fechaISO);
      }

      setMensaje("Asistencia guardada correctamente.");
      setTimeout(() => {
        setMensaje("");
        setListaMostrada([]);
      }, 3000);
    } catch {
      setMensaje("No se pudo guardar la asistencia.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Registro de Asistencia</h2>
        <button
          onClick={() => navigate(from)}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
        {cargando ? (
          <p className="text-center">Cargando datos...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="font-medium block mb-1">Ciclo:</label>
                <select
                  className="w-full border p-2 rounded"
                  value={cicloCodigo}
                  onChange={(e) => setCicloCodigo(e.target.value)}
                >
                  <option value="">Todos</option>
                  {ciclosDisponibles.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.nombre_publico || c.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1">Sede:</label>
                <select className="w-full border p-2 rounded" value={sede} onChange={(e) => setSede(e.target.value)}>
                  <option value="">-- Seleccionar sede --</option>
                  {sedesDisponibles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-medium block mb-1">Dia:</label>
                <select className="w-full border p-2 rounded" value={dia} onChange={(e) => setDia(e.target.value)}>
                  <option value="">-- Seleccionar dia --</option>
                  {diasDisponibles.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-medium block mb-1">Horario:</label>
                <select className="w-full border p-2 rounded" value={horario} onChange={(e) => setHorario(e.target.value)}>
                  <option value="">-- Seleccionar horario --</option>
                  {horariosDisponibles.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-medium block mb-1">Fecha:</label>
                <input className="w-full border p-2 rounded" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-4 justify-center mb-6">
              <button onClick={cargarListaTurno} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
                Buscar alumnos
              </button>
            </div>

            {mensaje && (
              <div className="mb-4 text-center text-green-800 font-semibold bg-green-100 border border-green-300 px-4 py-3 rounded shadow animate-fade-in-out">
                {mensaje}
              </div>
            )}

            {listaMostrada.length > 0 && (
              <form onSubmit={handleGuardar} className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold mb-2">Alumnos asignados</h4>

                  <ul className="space-y-2">
                    {listaMostrada.map((a, i) => {
                      const ausente = !a.presente;
                      return (
                        <li
                          key={`${a.alumno_id}-${a.esRecuperacion ? "rec" : "reg"}`}
                          className={`flex items-center gap-4 p-3 rounded border transition ${
                            a.esRecuperacion
                              ? ausente
                                ? "bg-amber-100 border-amber-300"
                                : "bg-sky-50 border-sky-300"
                              : ausente
                              ? "bg-red-100 border-red-300"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={a.presente}
                            onChange={() => {
                              const copia = [...listaMostrada];
                              copia[i].presente = !copia[i].presente;
                              setListaMostrada(copia);
                            }}
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500 border-gray-300"
                          />
                          <div>
                            <p className="font-medium">
                              {a.nombre} {a.apellido}
                            </p>
                            <p className="text-sm text-gray-600">{a.esRecuperacion ? "Recuperando clase" : a.curso}</p>
                          </div>
                          {a.esRecuperacion && (
                            <span className="ml-auto rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                              Recupera
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  Presentes: {listaMostrada.filter((a) => a.presente).length} | Ausentes:{" "}
                  {listaMostrada.filter((a) => !a.presente).length}
                </p>

                <div>
                  <h4 className="text-xl font-semibold mb-2">Agregar recuperadores</h4>
                  <select
                    className="w-full border p-2 rounded"
                    defaultValue=""
                    onChange={(e) => {
                      agregarRecuperador(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">-- Seleccionar alumno --</option>
                    {alumnos
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} {a.apellido}
                        </option>
                      ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Se agregan a la lista principal y quedan identificados como recuperacion.
                  </p>
                </div>
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={guardando}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2 rounded shadow"
                  >
                    {guardando ? "Guardando..." : "Guardar asistencia"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FichaAsistencia;
