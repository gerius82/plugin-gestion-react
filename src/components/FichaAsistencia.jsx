import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FichaAsistencia = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from")}`;
  
  const [turnosPorSede, setTurnosPorSede] = useState({});
  const [alumnos, setAlumnos] = useState([]);
  const [sede, setSede] = useState("");
  const [dia, setDia] = useState("");
  const [horario, setHorario] = useState("");
  const [fecha, setFecha] = useState("");
  const [recuperadores, setRecuperadores] = useState([]);
  const [listaMostrada, setListaMostrada] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");


  useEffect(() => {
    const loadData = async () => {
      const cfg = await (await fetch("/config.json")).json();
      const turnos = await (await fetch("/turnos.json")).json();
      setConfig(cfg);
      setTurnosPorSede(turnos);
      const res = await fetch(
        `${cfg.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,sede,turno_1,curso,creado_en`,
        {
          headers: {
            apikey: cfg.supabaseKey,
            Authorization: `Bearer ${cfg.supabaseKey}`,
          },
        }
      );
      const data = await res.json();
      setAlumnos(data);
      setCargando(false);
    };
    loadData();
  }, []);

  const turnoCompleto = `${dia} ${horario}`;

  const alumnosDelTurno = alumnos
    .filter((a) => a.sede === sede && a.turno_1 === turnoCompleto)
    .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!config) return;
    const fechaISO = fecha || new Date().toISOString().split("T")[0];
    const presentes = listaMostrada.filter((a) => a.presente);
    const ausentes = listaMostrada.filter((a) => !a.presente);

    const payload = [
      ...presentes.map((a) => ({ alumno_id: a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "regular" })),
      ...ausentes.map((a) => ({ alumno_id: a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "ausente" })),
      ...recuperadores.map((a) => ({ alumno_id: a.id, fecha: fechaISO, turno: turnoCompleto, sede, tipo: "recuperacion" })),
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
      .filter((a) => a.sede === sede && a.turno_1 === turnoCompleto)
      .map((a) => ({ ...a, presente: true }));
    setListaMostrada(seleccionados);
  };

  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6">Registro de Asistencia</h2>

      {cargando ? (
        <p className="text-center">Cargando datos...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="font-medium">Sede:</label>
              <select className="w-full border p-2 rounded" value={sede} onChange={(e) => setSede(e.target.value)}>
                <option value="">-- Seleccionar sede --</option>
                <option value="Calle Mendoza">Calle Mendoza</option>
                <option value="Fisherton">Fisherton</option>
              </select>
            </div>
            <div>
              <label className="font-medium">Día:</label>
              <select className="w-full border p-2 rounded" value={dia} onChange={(e) => setDia(e.target.value)}>
                <option value="">-- Seleccionar día --</option>
                {dias.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-medium">Horario:</label>
              <select className="w-full border p-2 rounded" value={horario} onChange={(e) => setHorario(e.target.value)}>
                <option value="">-- Seleccionar horario --</option>
                {sede && dia &&
                  Object.keys(turnosPorSede[sede] || {})
                    .filter((t) => t.startsWith(dia))
                    .map((t) => t.split(" ").slice(1).join(" "))
                    .map((h, i) => (
                      <option key={i} value={h}>{h}</option>
                    ))}
              </select>
            </div>
            <div>
              <label className="font-medium">Fecha:</label>
              <input className="w-full border p-2 rounded" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-4 justify-center mb-6">
            <button onClick={handleBuscar} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">Buscar alumnos</button>
            <button onClick={() => navigate(from)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 transition">← Volver</button>
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
  );
};

export default FichaAsistencia;