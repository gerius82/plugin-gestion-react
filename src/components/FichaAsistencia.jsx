import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FichaAsistencia = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from")}`;
  const [alumnos, setAlumnos] = useState([]);
  const [sede, setSede] = useState("");
  const [dia, setDia] = useState("");
  const [horario, setHorario] = useState("");
  const [fecha, setFecha] = useState("");
  const [recuperadores, setRecuperadores] = useState([]);
  const [listaMostrada, setListaMostrada] = useState([]);
  const [cargando, setCargando] = useState(true);
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
      const filtroCiclo = cicloCodigo
        ? `&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}`
        : "";
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
      setRecuperadores([]);
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

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!config) return;
    const fechaISO = fecha || new Date().toISOString().split("T")[0];
    const presentes = listaMostrada.filter((a) => a.presente);
    const ausentes = listaMostrada.filter((a) => !a.presente);

    const payload = [
      ...presentes.map((a) => ({ alumno_id: a.alumno_id || a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "regular" })),
      ...ausentes.map((a) => ({ alumno_id: a.alumno_id || a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "ausente" })),
      ...recuperadores.map((a) => ({ alumno_id: a.alumno_id || a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "recuperacion" })),
    ];

    const existentesRes = await fetch(
      `${config.supabaseUrl}/rest/v1/asistencias?fecha=eq.${fechaISO}&select=alumno_id`,
      { headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` } }
    );
    const ya = await existentesRes.json();
    const existentes = new Set(ya.map((r) => r.alumno_id));
    const nuevos = payload.filter((p) => !existentes.has(p.alumno_id));

    await Promise.all(
      nuevos.map((r) =>
        fetch(`${config.supabaseUrl}/rest/v1/asistencias`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
          },
          body: JSON.stringify(r),
        })
      )
    );
    setMensaje("✅ Asistencia guardada correctamente.");
    setTimeout(() => {
    setMensaje("");
    setListaMostrada([]);
    setRecuperadores([]);
    }, 3000);
  };
  const handleBuscar = () => {
    if (!sede || !dia || !horario) return;
    const seleccionados = alumnos
      .filter((a) => a.sede === sede && a.dia === dia && a.hora === horario)
      .map((a) => ({ ...a, presente: true }));
    setListaMostrada(seleccionados);
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
            {/* Selector de ciclo / tipo de inscripción */}
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
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-medium block mb-1">Día:</label>
              <select className="w-full border p-2 rounded" value={dia} onChange={(e) => setDia(e.target.value)}>
                <option value="">-- Seleccionar día --</option>
                {diasDisponibles.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-medium block mb-1">Horario:</label>
              <select className="w-full border p-2 rounded" value={horario} onChange={(e) => setHorario(e.target.value)}>
                <option value="">-- Seleccionar horario --</option>
                {horariosDisponibles.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-medium block mb-1">Fecha:</label>
              <input className="w-full border p-2 rounded" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-4 justify-center mb-6">
            <button onClick={handleBuscar} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">Buscar alumnos</button>
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
                            key={a.id}
                            className={`flex items-center gap-4 p-3 rounded border transition ${
                            ausente ? "bg-red-100 border-red-300" : "bg-white border-gray-300"
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
                            <p className="font-medium">{a.nombre} {a.apellido}</p>
                            <p className="text-sm text-gray-600">{a.curso}</p>
                            </div>
                        </li>
                        );
                    })}
                </ul>


              </div>
              <p className="text-sm text-gray-700 mb-3">
                ✅ Presentes: {listaMostrada.filter(a => a.presente).length + recuperadores.length} | ❌ Ausentes: {listaMostrada.filter(a => !a.presente).length}
              </p>

              <div>
                <h4 className="text-xl font-semibold mb-2">Agregar recuperadores</h4>
                <select className="w-full border p-2 rounded" onChange={(e) => {
                  const id = e.target.value;
                  const ya = recuperadores.find(r => r.id === id);
                  if (!id || ya) return;
                  const alumno = alumnos.find(a => a.id === id);
                  if (alumno) setRecuperadores([...recuperadores, alumno]);
                }}>
                  <option value="">-- Seleccionar alumno --</option>
                  {alumnos
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                    ))}
                </select>
                <ul className="mt-2 space-y-1">
                  {recuperadores.map((a, i) => (
                    <li
                      key={a.id}
                      className="cursor-pointer text-blue-700 hover:underline"
                      onClick={() => {
                        const copia = [...recuperadores];
                        copia.splice(i, 1);
                        setRecuperadores(copia);
                      }}
                    >
                      {a.nombre} {a.apellido} (clic para quitar)
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-center">
                <button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded shadow">Guardar asistencia</button>
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

