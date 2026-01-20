import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import "../assets/formulario.css";
import { useNavigate, useSearchParams } from "react-router-dom";

const FormularioInscripcion = () => {
  const navigate = useNavigate();
  const [mensajeExito, setMensajeExito] = useState("");
  const [config, setConfig] = useState(null);
  const [telefonoValido, setTelefonoValido] = useState(true);
  const [emailValido, setEmailValido] = useState(true);
  const [turnoEnListaEspera, setTurnoEnListaEspera] = useState(false);
  const [searchParams] = useSearchParams();
  const origen = searchParams.get("origen");
  const from = searchParams.get("from");

  const rutaSalida =
    origen === "gestion"
      ? "/menu-gestion"
      : from === "menu-intermedio"
      ? "/menu-inscripcion-padres"
      : "/menu-padres";

  const [formulario, setFormulario] = useState({
    nombre: "",
    apellido: "",
    edad: "",
    escuela: "",
    responsable: "",
    telefono: "",
    email: "",
    sede: "",
    curso: "",
    turno_1: "",
    comentarios: ""
  });

  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");
  const [cursos, setCursos] = useState([]);
  const [cursoSelId, setCursoSelId] = useState(null);
  const [turnosConfig, setTurnosConfig] = useState(null);

  const [sedes, setSedes] = useState([]);
  const [diaSel, setDiaSel] = useState("");
  const [horaSel, setHoraSel] = useState("");
  const [cupoMaximo, setCupoMaximo] = useState(null);
  const [anotadosTurno, setAnotadosTurno] = useState(0);
  const [turnosCards, setTurnosCards] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  const supaHeaders = (cfg) => ({
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
  });

  const parseTurnosConfig = (cfg) => {
    if (!cfg) return {};
    if (typeof cfg === "string") {
      try {
        return JSON.parse(cfg);
      } catch (error) {
        console.error("turnos_config invalido", error);
        return {};
      }
    }
    return cfg;
  };

  const limpiarFormulario = () => {
    setFormulario({
      nombre: "",
      apellido: "",
      edad: "",
      escuela: "",
      responsable: "",
      telefono: "",
      email: "",
      sede: "",
      curso: "",
      turno_1: "",
      comentarios: ""
    });
    setTurnoEnListaEspera(false);
    setDiaSel("");
    setHoraSel("");
    setCupoMaximo(null);
    setAnotadosTurno(0);
    setTurnosCards([]);
  };

  const mostrarResumenTurno = () => {
    if (turnoEnListaEspera) {
      return (
        <p className="text-red-600 text-sm mt-2">
          Este turno esta completo. Quedaras en lista de espera y te avisaremos cuando se libere un lugar.
        </p>
      );
    }
    return null;
  };

  const [mostrarResumen, setMostrarResumen] = useState(false);

  const direcciones = {
    Fisherton: "Eva Peron 8128",
    "Calle Mendoza": "Mendoza 3024"
  };

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));
    emailjs.init("Vkl0XSUcG-KApScqq");
  }, []);

  useEffect(() => {
    if (!config) return;

    (async () => {
      const resCiclos = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
        { headers: supaHeaders(config) }
      );
      const dataCiclos = await resCiclos.json();
      const lista = Array.isArray(dataCiclos) ? dataCiclos : [];
      setCiclos(lista);
      const activo = lista.find((c) => c.activo) || lista[0];
      setCicloSel(activo?.codigo || "");
    })();
  }, [config]);

  useEffect(() => {
    if (!config || !cicloSel) {
      setCursos([]);
      setCursoSelId(null);
      setTurnosConfig({});
      return;
    }

    (async () => {
      const resCursos = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?select=id,nombre,ciclo,turnos_config,imagen_url&ciclo=eq.${encodeURIComponent(
          cicloSel
        )}&activo=eq.true&order=nombre.asc`,
        { headers: supaHeaders(config) }
      );
      const dataCursos = await resCursos.json();
      const lista = Array.isArray(dataCursos) ? dataCursos : [];
      setCursos(lista);

      if (lista.length >= 1) {
        const curso = lista[0];
        setCursoSelId(curso.id);
        setTurnosConfig(parseTurnosConfig(curso.turnos_config));
        setFormulario((prev) => ({ ...prev, curso: curso.nombre || "" }));
      } else {
        setCursoSelId(null);
        setTurnosConfig({});
        setFormulario((prev) => ({ ...prev, curso: "" }));
      }
    })();
  }, [config, cicloSel]);

  useEffect(() => {
    const s = Object.keys(turnosConfig || {});
    setSedes(s);

    setDiaSel("");
    setHoraSel("");
    setFormulario((prev) => ({ ...prev, sede: "", turno_1: "" }));
    setTurnosCards([]);
    setTurnoEnListaEspera(false);
  }, [turnosConfig]);

  const contarMatriculasActivasPorTurno = async ({ cicloCodigo, sede, dia, hora }) => {
    const url =
      `${config.supabaseUrl}/rest/v1/matriculas` +
      `?select=id` +
      `&estado=eq.activa` +
      `&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}` +
      `&sede=eq.${encodeURIComponent(sede)}` +
      `&dia=eq.${encodeURIComponent(dia)}` +
      `&hora=eq.${encodeURIComponent(hora)}`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        Prefer: "count=exact",
      },
    });

    const cr = res.headers.get("content-range") || "";
    const total = parseInt(cr.split("/")[1] || "0", 10);
    return Number.isFinite(total) ? total : 0;
  };

  const obtenerCupoTurno = async ({ cicloCodigo, sede, dia, hora }) => {
    const url =
      `${config.supabaseUrl}/rest/v1/turnos` +
      `?select=cupo_maximo` +
      `&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}` +
      `&sede=eq.${encodeURIComponent(sede)}` +
      `&dia=eq.${encodeURIComponent(dia)}` +
      `&hora=eq.${encodeURIComponent(hora)}` +
      `&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      },
    });

    const data = await res.json();
    const cupo = data?.[0]?.cupo_maximo ?? null;
    return cupo != null ? Number(cupo) : null;
  };

  const calcularDisponibilidadTurno = async () => {
    if (!config) return { cupo: null, anotados: 0, listaEspera: false };

    const cicloCodigo = cicloSel;
    const sede = formulario.sede;
    const dia = diaSel;
    const hora = horaSel;

    if (!cicloCodigo || !sede || !dia || !hora) return { cupo: null, anotados: 0, listaEspera: false };

    const cupo = await obtenerCupoTurno({ cicloCodigo, sede, dia, hora });
    const anotados = await contarMatriculasActivasPorTurno({ cicloCodigo, sede, dia, hora });

    const listaEspera = cupo != null ? anotados >= cupo : false;

    setCupoMaximo(cupo);
    setAnotadosTurno(anotados);
    setTurnoEnListaEspera(listaEspera);

    return { cupo, anotados, listaEspera };
  };

  const cargarTurnosConEstado = async (sede) => {
    if (!config || !sede || !cicloSel) return;
    setCargandoTurnos(true);

    try {
      const urlTurnos =
        `${config.supabaseUrl}/rest/v1/turnos` +
        `?select=dia,hora,cupo_maximo` +
        `&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
        `&sede=eq.${encodeURIComponent(sede)}` +
        `&activo=eq.true`;

      const resTurnos = await fetch(urlTurnos, {
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
      });
      const turnos = await resTurnos.json();

      const urlMats =
        `${config.supabaseUrl}/rest/v1/matriculas` +
        `?select=dia,hora` +
        `&estado=eq.activa` +
        `&ciclo_codigo=eq.${encodeURIComponent(cicloSel)}` +
        `&sede=eq.${encodeURIComponent(sede)}`;

      const resMats = await fetch(urlMats, {
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
      });
      const mats = await resMats.json();

      const counts = new Map();
      (Array.isArray(mats) ? mats : []).forEach((m) => {
        const key = `${m.dia}||${m.hora}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      const cards = (Array.isArray(turnos) ? turnos : []).map((t) => {
        const key = `${t.dia}||${t.hora}`;
        const anotados = counts.get(key) || 0;
        const cupo = Number(t.cupo_maximo);
        const listaEspera = Number.isFinite(cupo) ? anotados >= cupo : false;

        return {
          dia: t.dia,
          hora: t.hora,
          cupo,
          anotados,
          listaEspera,
        };
      });

      const ordenMap = {
        lunes: 0,
        martes: 1,
        miercoles: 2,
        jueves: 3,
        viernes: 4,
        sabado: 5,
        domingo: 6,
      };

      cards.sort((a, b) => {
        const da = ordenMap[String(a.dia || "").toLowerCase()] ?? 99;
        const db = ordenMap[String(b.dia || "").toLowerCase()] ?? 99;
        if (da !== db) return da - db;
        return String(a.hora).localeCompare(String(b.hora));
      });

      setTurnosCards(cards);
    } catch (e) {
      console.error(e);
      setTurnosCards([]);
    } finally {
      setCargandoTurnos(false);
    }
  };

  const elegirSede = (sede) => {
    setFormulario((prev) => ({ ...prev, sede, turno_1: "" }));
    setDiaSel("");
    setHoraSel("");
    setTurnoEnListaEspera(false);
    cargarTurnosConEstado(sede);
  };

  const seleccionarCurso = (curso) => {
    setCursoSelId(curso.id);
    setTurnosConfig(parseTurnosConfig(curso.turnos_config));
    setFormulario((prev) => ({ ...prev, curso: curso.nombre || "" }));
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormulario((prev) => ({ ...prev, [id]: value }));

    if (id === "telefono") {
      const soloNumeros = /^\d*$/;
      setTelefonoValido(soloNumeros.test(value));
    }

    if (id === "email") {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValido(regex.test(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cicloSel || !cursoSelId || !formulario.sede || !diaSel || !horaSel) {
      alert("Elegi ciclo, curso, sede, dia y horario.");
      return;
    }

    await calcularDisponibilidadTurno();
    setMostrarResumen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const imagenCurso = (curso) => {
    if (curso?.imagen_url) return curso.imagen_url;
    const n = String(curso?.nombre || "").toLowerCase();
    if (n.includes("basica")) return "/img/robotica-basica.jpg";
    if (n.includes("avanzada")) return "/img/robotica-avanzada.jpg";
    if (n.includes("scratch")) return "/img/scratch.jpg";
    if (n.includes("arduino")) return "/img/arduino.jpg";
    return "/Logo_Plugin_2025.png";
  };

  const confirmarEnvio = async () => {
    setMostrarResumen(false);
    setMensajeExito("Procesando inscripcion... Esto puede tardar unos segundos.");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (!config) return;

    if (!cicloSel || !cursoSelId || !formulario.sede || !diaSel || !horaSel) {
      setMensajeExito("Falta seleccionar ciclo, curso, sede, dia y horario.");
      return;
    }

    const { listaEspera } = await calcularDisponibilidadTurno();

    const cursoObj = cursos.find((c) => c.id === Number(cursoSelId));
    const cursoNombre = cursoObj?.nombre || formulario.curso || "";

    const payload = {
      ...formulario,
      edad: parseInt(formulario.edad),
      creado_en: new Date().toISOString(),
      tipo_inscripcion: cicloSel,
      curso: cursoNombre,
      turno_1: `${diaSel} ${horaSel}`,
      lista_espera: listaEspera || false,
    };

    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...supaHeaders(config),
          prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      const insData = await res.json();
      const alumnoId = insData?.[0]?.id;

      if (!res.ok || !alumnoId) {
        setMensajeExito("Ocurrio un error al enviar la inscripcion. Intenta nuevamente.");
        return;
      }

      await fetch(`${config.supabaseUrl}/rest/v1/matriculas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...supaHeaders(config),
        },
        body: JSON.stringify({
          alumno_id: alumnoId,
          ciclo_codigo: cicloSel,
          curso_id: Number(cursoSelId),
          curso_nombre: cursoNombre,
          sede: formulario.sede,
          dia: diaSel,
          hora: horaSel,
          estado: "activa",
          lista_espera: listaEspera || false,
          fecha_inicio: new Date().toISOString().slice(0, 10),
        }),
      });

      await emailjs.send("service_efu6ess", "template_92ev0wo", {
        nombre: formulario.nombre,
        apellido: formulario.apellido,
        edad: formulario.edad,
        responsable: formulario.responsable,
        telefono: formulario.telefono,
        email: formulario.email,
        sede: formulario.sede,
        curso: cursoNombre,
        turno_1: `${diaSel} ${horaSel}`,
        escuela: formulario.escuela,
        comentarios: formulario.comentarios,
        lista_espera: listaEspera ? "Si" : "No",
      });

      setMensajeExito("Inscripcion enviada correctamente. Tambien se envio un correo de confirmacion.");
    } catch (error) {
      console.error(error);
      setMensajeExito("Error de conexion. Intenta nuevamente mas tarde.");
    }
  };

  return (
    <div className="max-w-[700px] w-full mx-auto p-8 bg-white rounded-xl shadow-lg mt-8">
      {mensajeExito ? (
        <div className="mt-6 p-4 border-l-4 border-green-400 bg-green-50 text-green-800 rounded animate-fadeIn">
          <h4 className="text-lg font-semibold mb-1">Inscripcion completada con exito</h4>
          <p className="text-sm leading-relaxed">{mensajeExito}</p>
          <div className="mt-4 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                limpiarFormulario();
                setMensajeExito("");
                setMostrarResumen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Inscribir otro alumno
            </button>
            <button
              type="button"
              onClick={() => {
                setMensajeExito("");
                setMostrarResumen(false);
                limpiarFormulario();
                navigate(rutaSalida);
              }}
              className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Terminar
            </button>
          </div>
        </div>
      ) : !mostrarResumen ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-center mb-6">Formulario de Inscripcion</h2>

          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del alumno</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">
              Por favor completa la informacion basica del estudiante.
            </p>
            <hr className="border-gray-200 mt-1" />
          </div>

          <div>
            <label htmlFor="nombre" className="block font-medium mb-1">Nombre:</label>
            <input
              id="nombre"
              type="text"
              placeholder="Nombre del alumno/a"
              value={formulario.nombre}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="apellido" className="block font-medium mb-1">Apellido:</label>
            <input
              id="apellido"
              type="text"
              placeholder="Apellido del alumno/a"
              value={formulario.apellido}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="edad" className="block font-medium mb-1">Edad:</label>
            <input
              id="edad"
              type="number"
              value={formulario.edad}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="escuela" className="block font-medium mb-1">Escuela:</label>
            <input
              id="escuela"
              type="text"
              value={formulario.escuela}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            />
          </div>

          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del responsable</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">Necesitamos estos datos para contactarnos.</p>
            <hr className="border-gray-200 mt-1" />
          </div>

          <div>
            <label htmlFor="responsable" className="block font-medium mb-1">Responsable:</label>
            <input
              id="responsable"
              type="text"
              value={formulario.responsable}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block font-medium mb-1">Telefono:</label>
            <input
              id="telefono"
              type="text"
              placeholder="Formato sugerido: 3415076241"
              value={formulario.telefono}
              onChange={handleChange}
              className={`w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition ${
                telefonoValido ? "border-gray-300 focus:ring-green-100" : "border-red-300 focus:ring-red-100"
              }`}
              required
            />
            {!telefonoValido && <p className="text-red-500 text-sm mt-1">Solo numeros</p>}
          </div>

          <div>
            <label htmlFor="email" className="block font-medium mb-1">Email:</label>
            <input
              id="email"
              type="email"
              placeholder="ejemplo@correo.com"
              value={formulario.email}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
            {!emailValido && (
              <p className="text-red-500 text-sm">Ingresa un email valido de la forma ejemplo@correo.com</p>
            )}
          </div>

          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Ciclo y curso</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">Elegi el ciclo y el curso a inscribir.</p>
            <hr className="border-gray-200 mt-1" />
          </div>

          <div>
            <label htmlFor="ciclo" className="block font-medium mb-1">Ciclo:</label>
            <select
              id="ciclo"
              value={cicloSel}
              onChange={(e) => setCicloSel(e.target.value)}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            >
              <option value="">Seleccionar ciclo</option>
              {ciclos.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre_publico || c.codigo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cursos.map((c) => {
                const seleccionado = cursoSelId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => seleccionarCurso(c)}
                    className={`overflow-hidden rounded-xl border shadow-sm text-left transition ${
                      seleccionado
                        ? "border-green-300 ring-2 ring-green-200 bg-white hover:bg-white"
                        : "border-gray-200 hover:shadow-md bg-white"
                    }`}
                  >
                    <img
                      src={imagenCurso(c)}
                      alt={`Foto de ${c.nombre}`}
                      className="h-36 w-full object-cover"
                    />
                    <div className="p-3">
                      <div className="font-semibold text-gray-800">{c.nombre}</div>
                      <div className="text-xs text-gray-500">{seleccionado ? "Seleccionado" : "Tocar para elegir"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Selecciona la sede</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">Elegi la sede donde se cursara.</p>
            <hr className="border-gray-200 mt-1" />
          </div>

          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {sedes.map((sede) => {
                const seleccionada = formulario.sede === sede;
                return (
                  <button
                    key={sede}
                    type="button"
                    onClick={() => elegirSede(sede)}
                    className={`p-2 rounded-lg border shadow-md text-center transition-transform duration-200 ${
                      seleccionada
                        ? "bg-green-100 border-green-200 ring-2 ring-green-300 hover:bg-green-300"
                        : "bg-white border-gray-200 hover:bg-gray-50 hover:scale-105"
                    }`}
                  >
                    <h4 className="text-lg">{sede}</h4>
                    <p className="text-sm text-gray-500">{direcciones[sede] || ""}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {formulario.sede && (
            <div className="space-y-4">
              <div className="mt-4">
                <div className="font-semibold mb-2">Turnos disponibles:</div>

                <div className="flex items-center gap-4 text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded border bg-green-100 border-green-400" />
                    Disponible
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded border bg-red-100 border-red-300" />
                    Lista de espera
                  </div>
                </div>

                {cargandoTurnos ? (
                  <div className="text-sm text-gray-600">Cargando turnos...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {turnosCards.map((t) => {
                      const seleccionado = diaSel === t.dia && horaSel === t.hora;

                      return (
                        <button
                          key={`${t.dia}-${t.hora}`}
                          type="button"
                          onClick={() => {
                            setDiaSel(t.dia);
                            setHoraSel(t.hora);
                            setTurnoEnListaEspera(t.listaEspera);
                            setFormulario((prev) => ({ ...prev, turno_1: `${t.dia} ${t.hora}` }));
                          }}
                          className={[
                            "text-left rounded-xl p-4 border shadow-sm transition",
                            t.listaEspera
                              ? "bg-red-50 border-red-200 hover:bg-red-100"
                              : "bg-green-50 border-green-200 hover:bg-green-100",
                            seleccionado ? "ring-2 ring-green-400" : "hover:shadow-md",
                          ].join(" ")}
                        >
                          <div className={t.listaEspera ? "text-red-700 font-medium" : "text-green-800 font-medium"}>
                            {t.dia} {t.hora}hs
                          </div>
                          <div className="text-xs mt-1">
                            Cupo:{" "}
                            <span className={t.listaEspera ? "text-red-700 font-semibold" : "text-green-700 font-semibold"}>
                              {t.listaEspera ? "Lista de espera" : "Disponible"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="comentarios" className="block font-medium mb-1">Comentarios:</label>
            <textarea
              id="comentarios"
              placeholder="Informacion adicional o preguntas"
              value={formulario.comentarios}
              onChange={handleChange}
              rows="3"
              className="w-full border border-gray-300 rounded-lg p-3 placeholder-gray-400 placeholder:italic placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            />
          </div>

          {!mostrarResumen && !mensajeExito && (
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="submit"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full max-w-sm mx-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-4 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
              >
                Siguiente
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(rutaSalida);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full max-w-sm mx-auto bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 sm:py-3 px-4 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
              >
                Volver
              </button>
            </div>
          )}
        </form>
      ) : (
        <div>
          <div className="mb-4 p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800">Resumen de inscripcion</h3>
            <p className="text-sm text-gray-600">Verifica que todos los datos sean correctos antes de confirmar.</p>
            <hr className="border-gray-200 mt-1" />
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Datos del alumno</h4>
              <p><span className="font-semibold">Nombre:</span> {formulario.nombre} {formulario.apellido}</p>
              <p><span className="font-semibold">Edad:</span> {formulario.edad}</p>
              <p><span className="font-semibold">Escuela:</span> {formulario.escuela || "No especificada"}</p>
            </div>

            <div className="p-4 rounded-lg bg-white shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Datos del responsable</h4>
              <p><span className="font-semibold">Responsable:</span> {formulario.responsable}</p>
              <p><span className="font-semibold">Telefono:</span> {formulario.telefono}</p>
              <p><span className="font-semibold">Email:</span> {formulario.email}</p>
            </div>

            <div className="p-4 rounded-lg bg-white shadow-sm">
              <h4 className="font-semibold text-gray-700 mb-2">Taller seleccionado</h4>
              <p><span className="font-semibold">Ciclo:</span> <span className="text-green-700">{cicloSel}</span></p>
              <p><span className="font-semibold">Curso:</span> <span className="text-green-700">{formulario.curso}</span></p>
              <p><span className="font-semibold">Sede:</span> <span className="text-green-700">{formulario.sede}</span></p>
              <p><span className="font-semibold">Turno:</span> {formulario.turno_1}</p>
              {cupoMaximo != null && (
                <p className="text-sm">
                  <span className="font-medium">Cupo:</span>{" "}
                  {turnoEnListaEspera ? (
                    <span className="text-red-600 font-semibold">Lista de espera</span>
                  ) : (
                    <span className="text-green-700 font-semibold">Disponible</span>
                  )}
                </p>
              )}
              {mostrarResumenTurno()}
            </div>

            {formulario.comentarios && (
              <div className="p-4 rounded-lg bg-white shadow-sm">
                <h4 className="font-semibold text-gray-700 mb-2">Comentarios adicionales</h4>
                <p>{formulario.comentarios}</p>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => {
                confirmarEnvio();
              }}
              className="w-full sm:w-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Confirmar envio
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarResumen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full sm:w-auto bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default FormularioInscripcion;
