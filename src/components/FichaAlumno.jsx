import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";

const FichaAlumno = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [beneficiariosDisponibles, setBeneficiariosDisponibles] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [ultimasAsistencias, setUltimasAsistencias] = useState([]);
  const [yaPagoInscripcion, setYaPagoInscripcion] = useState(false);
  const [confirmarInactivacion, setConfirmarInactivacion] = useState(false);
  const [formulario, setFormulario] = useState(null);
  const [turnosRegulares, setTurnosRegulares] = useState({});
  const [turnosVerano, setTurnosVerano] = useState({});

  const { id } = useParams();

  const refResponsable = useRef();
  const refTelefono = useRef();
  const refEmail = useRef();
  const refEdad = useRef();
  const refEscuela = useRef();
  const refSede = useRef();
  const refCurso = useRef();
  const refTurno = useRef();

  const headers = () => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`
  });

  useEffect(() => {
    if (id && alumnos.length > 0 && !alumnoSeleccionado) {
      seleccionarAlumno(id); // o id tal cual, si no usás números
    }
  }, [id, alumnos]);
  

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch("/config.json");
      const cfg = await res.json();
      setConfig(cfg);
    };

    const loadTurnos = async () => {
      const [resCiclo, resVerano] = await Promise.all([
        fetch("/turnos.json"),
        fetch("/turnos_verano.json"),
      ]);

      const [dataCiclo, dataVerano] = await Promise.all([
        resCiclo.json(),
        resVerano.json(),
      ]);

      setTurnosRegulares(dataCiclo || {});
      setTurnosVerano(dataVerano || {});
    };

    loadConfig();
    loadTurnos();
  }, []);


  useEffect(() => {
    if (!config) return;
    const cargarAlumnos = async () => {
      setCargando(true);
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,responsable,telefono,email,edad,escuela,sede,curso,turno_1,creado_en,tiene_promo,beneficiario_id,lista_espera`,
          { headers: headers() }
        );
        const data = await res.json();
        setAlumnos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error("Error cargando alumnos", err);
      } finally {
        setCargando(false);
      }
    };
    cargarAlumnos();
  }, [config]);

  const generarMesesDesdeInscripcion = (fechaISO) => {
    const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const fechaInicio = new Date(fechaISO);
    const hoy = new Date();
    const meses = [];
    let fechaIter = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
    while (
      fechaIter.getFullYear() < hoy.getFullYear() ||
      (fechaIter.getFullYear() === hoy.getFullYear() && fechaIter.getMonth() <= hoy.getMonth())
    ) {
      meses.push(nombres[fechaIter.getMonth()]);
      fechaIter.setMonth(fechaIter.getMonth() + 1);
    }
    return meses.reverse();
  };

  const formatearFechaCorta = (fechaISO) => {
    if (!fechaISO) return "-";
    const [año, mes, dia] = fechaISO.split("T")[0].split("-");
    return `${dia}/${mes}/${año}`;
  };

  const verificarPagoMes = async (alumnoId, mesTexto) => {
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${alumnoId}&mes=eq.${mesTexto}`, {
        headers: headers()
      });
      if (!res.ok) return false;
        const datos = await res.json();
      return datos.length > 0;
    } catch {
      return false;
    }
  };

  const fetchPagoInscripcion = async (id) => {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${id}&pago_inscripcion=is.true`, {
      headers: headers()
    });
    const pagos = await res.json();
    return pagos.length > 0;
  };

  const fetchPagosAlumno = async (id, meses) => {
    const estados = [];
    for (const mesTexto of meses) {
      const pagado = await verificarPagoMes(id, mesTexto);
      estados.push({ mes: mesTexto, pagado });
    }
    return estados;
  };

  const fetchAsistenciasAlumno = async (id) => {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/asistencias?alumno_id=eq.${id}&order=fecha.desc&limit=4&select=fecha,tipo,turno`, {
      headers: headers()
    });
    if (!res.ok) return [];
    return await res.json();
  };

  const seleccionarAlumno = async (id) => {
    const alumno = alumnos.find((a) => a.id === id);
    setAlumnoSeleccionado(alumno);
    setModoEdicion(false);
    setMensaje("");

    const otros = alumnos.filter((a) => a.id !== id);
    setBeneficiariosDisponibles(otros);

    if (alumno) {
      const meses = generarMesesDesdeInscripcion(alumno.creado_en);
      setHistorialPagos(await fetchPagosAlumno(alumno.id, meses));
      setUltimasAsistencias(await fetchAsistenciasAlumno(alumno.id));
      setYaPagoInscripcion(await fetchPagoInscripcion(alumno.id));
    }
  };

  const handleChange = (campo, valor) => {
    if (modoEdicion) {
      setFormulario((prev) => ({ ...prev, [campo]: valor }));
    } else {
      setAlumnoSeleccionado((prev) => ({ ...prev, [campo]: valor }));
    }
  };
  
  

  const guardarCambios = async () => {
    if (!formulario) return;
  
    const actualizado = {
      ...formulario, // usa ID y datos no editables
      responsable: refResponsable.current.value,
      telefono: refTelefono.current.value,
      email: refEmail.current.value,
      edad: refEdad.current.value,
      escuela: refEscuela.current.value,
      sede: refSede.current.value,
      curso: refCurso.current.value,
      turno_1: refTurno.current.value,
    };
  
    setMensaje("Guardando cambios...");
    const headersConfig = {
      ...headers(),
      "Content-Type": "application/json",
      prefer: "return=representation",
    };
  
    await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${actualizado.id}`,
      {
        method: "PATCH",
        headers: headersConfig,
        body: JSON.stringify(actualizado),
      }
    );
  
    if (!actualizado.tiene_promo && actualizado.beneficiario_id) {
      const otroId = actualizado.beneficiario_id;
      await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${otroId}`,
        {
          method: "PATCH",
          headers: headersConfig,
          body: JSON.stringify({
            tiene_promo: false,
            beneficiario_id: null,
          }),
        }
      );
      await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${actualizado.id}`,
        {
          method: "PATCH",
          headers: headersConfig,
          body: JSON.stringify({
            tiene_promo: false,
            beneficiario_id: null,
          }),
        }
      );
    }
  
    if (actualizado.tiene_promo && actualizado.beneficiario_id) {
      await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${actualizado.beneficiario_id}`,
        {
          method: "PATCH",
          headers: headersConfig,
          body: JSON.stringify({
            tiene_promo: true,
            beneficiario_id: actualizado.id,
          }),
        }
      );
    }
  
    setMensaje("✅ Cambios guardados correctamente");
    setTimeout(() => setMensaje(""), 2000);
    setModoEdicion(false);
  
    // Refrescar lista de alumnos y volver a seleccionar el alumno actualizado
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,responsable,telefono,email,edad,escuela,sede,curso,turno_1,creado_en,tiene_promo,beneficiario_id,lista_espera`,
      { headers: headers() }
    );
    const data = await res.json();
    setAlumnos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
  
    const actualizadoFinal = data.find((a) => a.id === actualizado.id);
    setAlumnoSeleccionado(actualizadoFinal);
  };
  
  
  useEffect(() => {
    if (modoEdicion) return; // ❌ no tocar formulario mientras editás
    if (alumnoSeleccionado) {
      setFormulario(null); // ✅ reset al salir de edición
    }
  }, [alumnoSeleccionado]);
  
  

  
  
  
  

  const Card = ({ title, children }) => (
    <div className="rounded-lg shadow-md p-4 bg-gray-50 mb-4">
      {title && <h4 className="text-xl font-bold border-b pb-2 mb-3">{title}</h4>}
      {children}
    </div>
  );

  const Badge = ({ children, success }) => (
    <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{children}</span>
  );

  const FormularioAlumno = ({
    formulario,
    turnosRegulares,
    turnosVerano,
    refResponsable,
    refTelefono,
    refEmail,
    refEdad,
    refEscuela,
    refSede,
    refCurso,
    refTurno,
  }) => {
    const [turnoKey, setTurnoKey] = useState(0); // para forzar re-render de select de turnos
  
    const sedeSeleccionada = refSede.current?.value ?? formulario?.sede ?? "";
    const cursoSeleccionado = refCurso.current?.value ?? formulario?.curso ?? "";

    const esTallerVerano =
      (cursoSeleccionado || "").toLowerCase() === "taller de verano";

    // según el curso, elegimos la fuente de turnos
    const mapaTurnos = esTallerVerano ? turnosVerano : turnosRegulares;

    const turnos = mapaTurnos?.[sedeSeleccionada]
      ? Object.keys(mapaTurnos[sedeSeleccionada])
      : [];
  
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="font-medium">Responsable:</label>
          <input
            className="w-full border rounded p-2"
            defaultValue={formulario?.responsable ?? ""}
            ref={refResponsable}
          />
        </div>
        <div>
          <label className="font-medium">Teléfono:</label>
          <input
            className="w-full border rounded p-2"
            defaultValue={formulario?.telefono ?? ""}
            ref={refTelefono}
          />
        </div>
        <div>
          <label className="font-medium">Email:</label>
          <input
            className="w-full border rounded p-2"
            defaultValue={formulario?.email ?? ""}
            ref={refEmail}
          />
        </div>
        <div>
          <label className="font-medium">Edad:</label>
          <input
            className="w-full border rounded p-2"
            defaultValue={formulario?.edad ?? ""}
            ref={refEdad}
          />
        </div>
        <div>
          <label className="font-medium">Escuela:</label>
          <input
            className="w-full border rounded p-2"
            defaultValue={formulario?.escuela ?? ""}
            ref={refEscuela}
          />
        </div>
        <div>
          <label className="font-medium">Sede:</label>
          <select
            className="w-full border rounded p-2"
            defaultValue={formulario?.sede ?? ""}
            ref={refSede}
            onChange={(e) => {
              refSede.current.value = e.target.value;
              refTurno.current.value = ""; // borrar turno
              setTurnoKey((k) => k + 1); // forzar re-render del select
            }}
          >
            <option value="">-- Seleccionar sede --</option>
            <option value="Calle Mendoza">Calle Mendoza</option>
            <option value="Fisherton">Fisherton</option>
          </select>
        </div>
        <div>
          <label className="font-medium">Curso:</label>
          <select
            className="w-full border rounded p-2"
            defaultValue={formulario?.curso ?? ""}
            ref={refCurso}
            onChange={(e) => {
              refCurso.current.value = e.target.value;
              // cuando cambia de curso, limpio el turno y fuerzo re-render
              refTurno.current.value = "";
              setTurnoKey((k) => k + 1);
            }}
          >
            <option value="">-- Seleccionar curso --</option>
            <option>Robótica Básica</option>
            <option>Robótica Avanzada</option>
            <option>Programación con Scratch</option>
            <option>Taller de Verano</option>
          </select>
        </div>
        <div>
          <label className="font-medium">Turno:</label>
          <select
            key={turnoKey} // clave única para forzar re-render
            className="w-full border rounded p-2"
            defaultValue={formulario?.turno_1 ?? ""}
            ref={refTurno}
          >
            <option value="">-- Seleccionar turno --</option>
            {turnos.map((turno) => (
              <option key={turno} value={turno}>
                {turno}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={formulario?.lista_espera || false}
              onChange={(e) =>
                handleChange("lista_espera", e.target.checked)
              }
            />
            Está en lista de espera
          </label>
        </div>

      </div>
      
    );
    
  };
  
  
  
  const marcarInactivo = async () => {
    if (!alumnoSeleccionado) return;
  
    const headersConfig = {
      ...headers(),
      "Content-Type": "application/json",
      prefer: "return=representation",
    };
  
    const id = alumnoSeleccionado.id;
    const beneficiarioId = alumnoSeleccionado.beneficiario_id;
  
    // 1) Si tenía promo, desactivar solo la promo del otro, no su estado "activo"
    if (alumnoSeleccionado.tiene_promo && beneficiarioId) {
      // Quitar promo del beneficiario solo si está vinculado de vuelta a este alumno
      await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${beneficiarioId}`, {
        method: "PATCH",
        headers: headersConfig,
        body: JSON.stringify({
          // si el beneficiario te tenía a vos vinculado, lo desvinculamos
          beneficiario_id: null,
          tiene_promo: false,
        }),
      });
    }
  
    // 2) Inactivar al alumno actual y dejarlo sin promo ni vínculo
    await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${id}`, {
      method: "PATCH",
      headers: headersConfig,
      body: JSON.stringify({
        activo: false,
        tiene_promo: false,
        beneficiario_id: null,
      }),
    });
  
    setMensaje("Alumno marcado como inactivo");
    setModoEdicion(false);
  
    // 3) Refrescar lista (solo activos)
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,responsable,telefono,email,edad,escuela,sede,curso,turno_1,creado_en,tiene_promo,beneficiario_id,lista_espera`,
      { headers: headers() }
    );
    const data = await res.json();
    setAlumnos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setAlumnoSeleccionado(null);
  };
  
  
    

  return (
    <div className="">
      <h2 className="text-3xl font-bold text-center mb-6">Ficha de Alumnos</h2>

      <Card title="Seleccionar alumno">
        {cargando ? (
          <p>Cargando alumnos...</p>
        ) : (
          <select
              className="w-full border rounded-lg p-2"
              value={alumnoSeleccionado?.id || ""}
              onChange={(e) => seleccionarAlumno(e.target.value)}
            >
              <option value="">-- Seleccionar --</option>
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
              ))}
            </select>
        )}
      </Card>

      {alumnoSeleccionado && (
        <>
          <Card title="Datos del alumno">
            <p className="text-sm text-gray-600 text-center mb-2">
              Fecha de inscripción:{" "}
              <span className="font-semibold">
                {new Date(alumnoSeleccionado.creado_en).toLocaleDateString('es-AR')}
              </span>
            </p>
          <div className="flex gap-3 mt-4 justify-center">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow transition hover:scale-105"
            onClick={() => {
              if (!modoEdicion) {
                setFormulario({ ...alumnoSeleccionado }); // ✅ copiar sólo una vez
                setModoEdicion(true);
              } else {
                setFormulario(null);
                setModoEdicion(false);
              }
            }}
            
          >
            {modoEdicion ? "Cancelar" : "Editar ficha"}
          </button>


            {modoEdicion && (
              <>
                <button
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow transition hover:scale-105"
                  onClick={guardarCambios}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setConfirmarInactivacion(true)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow transition hover:scale-105"
                >
                  Marcar inactivo
                </button>
                

              </>
            )}
            
          </div>
          
          {confirmarInactivacion && (
                  <div className="bg-red-50 border border-red-300 p-4 rounded shadow mt-2 text-center">
                    <p className="text-red-800 font-semibold mb-3">
                      ¿Estás seguro de que querés marcar como inactivo a <br />
                      <span className="font-bold">{alumnoSeleccionado.nombre} {alumnoSeleccionado.apellido}</span>?
                    </p>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={async () => {
                          await marcarInactivo();
                          setConfirmarInactivacion(false);
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                      >
                        Sí, confirmar
                      </button>
                      <button
                        onClick={() => setConfirmarInactivacion(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
          {mensaje && <p className="text-center text-green-700 font-medium mb-4 animate-fade-in">{mensaje}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modoEdicion && formulario ? (
              <FormularioAlumno
              formulario={formulario}
              turnosRegulares={turnosRegulares}
              turnosVerano={turnosVerano}
              refResponsable={refResponsable}
              refTelefono={refTelefono}
              refEmail={refEmail}
              refEdad={refEdad}
              refEscuela={refEscuela}
              refSede={refSede}
              refCurso={refCurso}
              refTurno={refTurno}
            />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3">
                <div>
                  <label className="font-medium">Responsable:</label>
                  <p>{alumnoSeleccionado?.responsable || ""}</p>
                </div>
                <div>
                  <label className="font-medium">Teléfono:</label>
                  <p>{alumnoSeleccionado?.telefono || ""}</p>
                </div>
                <div>
                  <label className="font-medium">Email:</label>
                  <p>{alumnoSeleccionado?.email || ""}</p>
                </div>
                <div>
                  <label className="font-medium">Edad:</label>
                  <p>{alumnoSeleccionado?.edad || ""}</p>
                </div>
                <div>
                  <label className="font-medium">Escuela:</label>
                  <p>{alumnoSeleccionado?.escuela || ""}</p>
                </div>
                <div>
                  <label className="font-medium">Sede:</label>
                  <p>{alumnoSeleccionado?.sede || ""}</p>
                </div>

                <div>
                  <label className="font-medium">Curso:</label>
                  <p>{alumnoSeleccionado?.curso || ""}</p>
                </div>

                <div>
                  <label className="font-medium">Turno:</label>
                  <p>{alumnoSeleccionado?.turno_1 || ""}</p>
                </div>
              </div>
            )}
         </div>
         <div>
            <label className="font-medium">Estado:</label>
            <p>
              {alumnoSeleccionado?.lista_espera
                ? "🕓 En lista de espera"
                : "✅ Con cupo confirmado"}
            </p>
          </div>



          

          {/* Tarjeta promoción similar a HTML */}
          <div className="promo-box">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={
                  modoEdicion
                    ? formulario?.tiene_promo || false
                    : alumnoSeleccionado?.tiene_promo || false
                }
                disabled={!modoEdicion}
                onChange={(e) =>
                  handleChange("tiene_promo", e.target.checked)
                }
              />
              Tiene promo (Hermanos o Mejores Amigos)
            </label>
          </div>

          {(modoEdicion ? formulario?.tiene_promo : alumnoSeleccionado?.tiene_promo) && (
            modoEdicion ? (
              <select
                className="w-full border rounded p-2 mt-2"
                value={formulario?.beneficiario_id ?? ""}
                onChange={(e) =>
                  handleChange("beneficiario_id", e.target.value)
                }
              >
                <option value="">-- Seleccionar beneficiario --</option>
                {beneficiariosDisponibles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} {b.apellido}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-gray-700">
                Beneficiario vinculado:{" "}
                {alumnoSeleccionado?.beneficiario_id
                  ? alumnos.find((a) => a.id === alumnoSeleccionado.beneficiario_id)?.nombre +
                    " " +
                    alumnos.find((a) => a.id === alumnoSeleccionado.beneficiario_id)?.apellido
                  : "No vinculado"}
              </p>
            )
          )}

        </Card>

        <Card>
            <div className="text-center">
              {yaPagoInscripcion ? (
                <p className="text-green-700 font-medium text-center">✅ Inscripción paga</p>
              ) : (
                <a href={`https://wa.me/54${alumnoSeleccionado.telefono?.replace(/\\D/g,'')}?text=${encodeURIComponent(`¡Hola ${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido}! 👋\n\nTe comparto los datos para completar la reserva de cupo:\n\n💲 Monto: $10.000\n🏦 Alias: plugin.robotica\n👤 Titular: Germán Iusto\n\n¡Muchas gracias por confiar en nosotros! 🙌\nCualquier duda, estoy a disposición.\n\n¡Saludos! 😊`)}`} target="_blank" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition hover:scale-105">
                  Enviar datos de inscripción 📲
                </a>
              )}
            </div>
          </Card>
        
          {historialPagos.length > 0 && (
            <Card title="Historial de pagos">
              <ul className="space-y-2">
                {historialPagos.map((p, i) => (
                  <li key={i} className="flex justify-between items-center p-2 rounded bg-white shadow-sm">
                    <span>{p.mes}</span>
                    <Badge success={p.pagado}>{p.pagado ? "Pagado" : "Sin pago"}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Historial de asistencias">
          {ultimasAsistencias.map((a, i) => {
            const fecha = formatearFechaCorta(a.fecha);
            const turno = a.turno || alumnoSeleccionado.turno_1 || "Turno no especificado";
            let estado = a.tipo === "regular" ? "Asistió" : a.tipo === "ausente" ? "Ausente" : a.tipo === "recuperacion" ? "Recuperación" : "Sin clasificar";
            let badgeClass = a.tipo === "regular" ? 'bg-green-100 text-green-800' : a.tipo === "ausente" ? 'bg-red-100 text-red-800' : a.tipo === "recuperacion" ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
            return (
              <li key={i} className="flex justify-between items-center p-2 rounded bg-white shadow-sm text-sm">
                <span>{fecha} - {turno}</span>
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${badgeClass}`}>{estado}</span>
              </li>
            );
          })}
          </Card>

         

          

          
        </>
      )}

    <div className="mt-6 w-fit mx-auto">
    <Link
          to="/alumnos-menu"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
      </Link>
    </div>



    </div>
  );
};

export default FichaAlumno;
