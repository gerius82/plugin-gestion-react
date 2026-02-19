/*
  Formulario de Inscripción modificado para que al confirmar solo se muestre el mensaje de éxito
*/

import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import "../assets/formulario.css";
import { useNavigate, useSearchParams } from "react-router-dom";

const normalizarTextoComparacion = (valor = "") =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const FormularioInscripcionVerano = () => {
  const navigate = useNavigate();
  const [mensajeExito, setMensajeExito] = useState("");
  const [config, setConfig] = useState(null);
  //const [turnos, setTurnos] = useState({});
  const [turnoEnListaEspera, setTurnoEnListaEspera] = useState(false);
  const [telefonoValido, setTelefonoValido] = useState(true);
  const [emailValido, setEmailValido] = useState(true);
  //const [turnoEnListaEspera, setTurnoEnListaEspera] = useState(false);
  const [searchParams] = useSearchParams();
  const origen = searchParams.get("origen");
  const from = searchParams.get("from");

  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");      // ejemplo: "TDV" o "CICLO_2026"
  const [cursos, setCursos] = useState([]);
  const [cursoSelId, setCursoSelId] = useState(null);
  const [turnosConfig, setTurnosConfig] = useState(null);

  const [sedes, setSedes] = useState([]);
  const [dias, setDias] = useState([]);
  const [horarios, setHorarios] = useState([]);

  const [diaSel, setDiaSel] = useState("");
  const [horaSel, setHoraSel] = useState("");
  const [cupoMaximo, setCupoMaximo] = useState(null);
  const [anotadosTurno, setAnotadosTurno] = useState(0);
  const [turnosCards, setTurnosCards] = useState([]); // [{dia,hora,cupo,anotados,listaEspera}]
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const ordenarDias = (dias = []) => {
    const ordenMap = {
      lunes: 0,
      martes: 1,
      miercoles: 2,
      miércoles: 2,
      jueves: 3,
      viernes: 4,
      sabado: 5,
      sÁbado: 5,
      sábado: 5,
      domingo: 6,
    };
    return [...dias].sort((a, b) => {
      const ia = ordenMap[String(a || "").toLowerCase()] ?? 99;
      const ib = ordenMap[String(b || "").toLowerCase()] ?? 99;
      return ia - ib;
    });
  };


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
    curso: "Taller de Verano",
    turno_1: "",
    comentarios: ""
  });

  const TIPO_INSCRIPCION = "TDV";

  const supaHeaders = (cfg) => ({
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
  });

  const buscarPersonaId = async () => {
    if (!config) return null;
    const nombre = (formulario.nombre || "").trim();
    const apellido = (formulario.apellido || "").trim();
    const telefonoRaw = (formulario.telefono || "").trim();
    const telefono = telefonoRaw.replace(/\D/g, "");
    const email = (formulario.email || "").trim().toLowerCase();
    const nombreNorm = normalizarTextoComparacion(nombre);
    const apellidoNorm = normalizarTextoComparacion(apellido);
    const filtrosOr = [];

    if (apellido) {
      const prefApellido = `${apellido.slice(0, 4)}*`;
      filtrosOr.push(`apellido.ilike.${encodeURIComponent(prefApellido)}`);
    }
    if (telefono) {
      filtrosOr.push(`telefono.ilike.${encodeURIComponent(`*${telefono}*`)}`);
    }
    if (email) {
      filtrosOr.push(`email.ilike.${encodeURIComponent(email)}`);
    }
    if (filtrosOr.length === 0) return null;
    const url =
      `${config.supabaseUrl}/rest/v1/inscripciones` +
      `?select=id,persona_id,nombre,apellido,telefono,email,creado_en&order=creado_en.desc&limit=50&or=(${filtrosOr.join(",")})`;
    try {
      const res = await fetch(url, { headers: supaHeaders(config) });
      if (!res.ok) return null;
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];

      const persona = lista.find((p) => {
        const n = normalizarTextoComparacion(p?.nombre);
        const a = normalizarTextoComparacion(p?.apellido);
        return nombreNorm && apellidoNorm && n === nombreNorm && a === apellidoNorm;
      }) ||
      lista.find((p) => {
        const tel = String(p?.telefono || "").replace(/\D/g, "");
        return telefono && tel.includes(telefono);
      }) ||
      lista.find((p) => String(p?.email || "").trim().toLowerCase() === email) ||
      null;

      return persona?.persona_id || persona?.id || null;
    } catch {
      return null;
    }
  };

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

    const cicloCodigo = "TDV";
    const sede = formulario.sede;
    const dia = diaSel;
    const hora = horaSel;

    if (!sede || !dia || !hora) return { cupo: null, anotados: 0, listaEspera: false };

    const cupo = await obtenerCupoTurno({ cicloCodigo, sede, dia, hora });
    const anotados = await contarMatriculasActivasPorTurno({ cicloCodigo, sede, dia, hora });

    const listaEspera = cupo != null ? anotados >= cupo : false;

    setCupoMaximo(cupo);
    setAnotadosTurno(anotados);
    setTurnoEnListaEspera(listaEspera);

    return { cupo, anotados, listaEspera };
  };

  const cargarTurnosConEstado = async (sede) => {
    if (!config || !sede) return;
    setCargandoTurnos(true);

    try {
      const urlTurnos =
        `${config.supabaseUrl}/rest/v1/turnos` +
        `?select=dia,hora,cupo_maximo` +
        `&ciclo_codigo=eq.TDV` +
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
        `&ciclo_codigo=eq.TDV` +
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
        miércoles: 2,
        jueves: 3,
        viernes: 4,
        sabado: 5,
        sábado: 5,
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
      curso: "Taller de Verano",
      turno_1: "",
      comentarios: ""
    });
    setTurnoEnListaEspera(false);
    setCupoMaximo(null);
    setAnotadosTurno(0);
  };

  const mostrarResumenTurno = () => {
    if (turnoEnListaEspera) {
      return (
        <p className="text-red-600 text-sm mt-2">
          Este turno est� completo. Quedar�s en lista de espera y te avisaremos cuando se libere un lugar.
        </p>
      );
    }
    return null;
  };
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const direcciones = {
    Fisherton: "Eva Perón 8128",
    "Calle Mendoza": "Mendoza 3024"
  };

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));

    //fetch("/turnos_verano.json")
    //  .then((res) => res.json())
    //  .then((data) => setTurnos(data));

    emailjs.init("Vkl0XSUcG-KApScqq");
  }, []);

  useEffect(() => {
  if (!config) return;

  (async () => {
    // 1) Seteo ciclo fijo TDV
    setCicloSel("TDV");

    // 2) Traigo cursos activos del TDV (debería venir Robótica)
    const resCursos = await fetch(
      `${config.supabaseUrl}/rest/v1/cursos?select=id,nombre,ciclo,turnos_config&ciclo=eq.TDV&activo=eq.true&order=nombre.asc`,
      { headers: supaHeaders(config) }
    );
    const dataCursos = await resCursos.json();
    const lista = Array.isArray(dataCursos) ? dataCursos : [];
    setCursos(lista);

    // si hay uno solo, lo dejo seleccionado
    if (lista.length >= 1) {
      setCursoSelId(lista[0].id);
      setTurnosConfig(lista[0].turnos_config || {});
      // guardo el curso correcto en el formulario (no "Taller de Verano")
      setFormulario((prev) => ({ ...prev, curso: lista[0].nombre }));
    } else {
      setCursoSelId(null);
      setTurnosConfig({});
      setFormulario((prev) => ({ ...prev, curso: "" }));
    }
  })();
}, [config]);

useEffect(() => {
  const s = Object.keys(turnosConfig || {});
  setSedes(s);

  // reset de selección
  setDias([]);
  setHorarios([]);
  setDiaSel("");
  setHoraSel("");
  setFormulario((prev) => ({ ...prev, sede: "", turno_1: "" }));
}, [turnosConfig]);

const elegirSede = (sede) => {
  setFormulario((prev) => ({ ...prev, sede, turno_1: "" }));
  const d = Object.keys((turnosConfig?.[sede]) || {});
  setDias(ordenarDias(d));

  setHorarios([]);
  setDiaSel("");
  setHoraSel("");
  setTurnoEnListaEspera(false);
  cargarTurnosConEstado(sede);
};

const elegirDia = async (dia) => {
  setDiaSel(dia);
  const h = (turnosConfig?.[formulario.sede]?.[dia]) || [];
  const activos = await obtenerHorariosActivos({
    cicloCodigo: "TDV",
    sede: formulario.sede,
    dia,
  });

  // deja solo los que estén activos en turnos
  const setActivos = new Set(activos);
  setHorarios(h.filter((x) => setActivos.has(x)));


  setHoraSel("");
  setFormulario((prev) => ({ ...prev, turno_1: "" }));
};

const elegirHorario = (hora) => {
  setHoraSel(hora);
  setFormulario((prev) => ({ ...prev, turno_1: `${diaSel} ${hora}` }));
};



  const handleChange = async (e) => {
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

    /*if (id === "sede" && value) {
      const nuevosTurnos = await cargarTurnosDisponibles(value);
      setTurnosDisponibles(nuevosTurnos);
    }
    */
  };
/*
  const cargarTurnosDisponibles = async (sedeSeleccionada) => {
    if (!config || !sedeSeleccionada || !turnos[sedeSeleccionada]) return [];

    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?select=turno_1&activo=eq.true&sede=eq.${encodeURIComponent(
        sedeSeleccionada
      )}&tipo_inscripcion=eq.${TIPO_INSCRIPCION}`,
      {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`
        }
      }
    );
    const data = await response.json();

    const conteo = {};
    data.forEach(({ turno_1 }) => {
      const turno = turno_1?.trim();
      if (turno) conteo[turno] = (conteo[turno] || 0) + 1;
    });

    return Object.entries(turnos[sedeSeleccionada]).map(([turno, max]) => {
      const cantidad = conteo[turno] || 0;
      const lleno = cantidad >= max;
      return {
        turno,
        label: turno,
        lleno
      };
    });
  };

  const cursosDisponibles = () => {
    const edad = parseInt(formulario.edad);
    return [
      { nombre: "Robótica Básica", habilitado: true },
      { nombre: "Robótica Avanzada", habilitado: true },
      { nombre: "Programación con Scratch", habilitado: edad >= 8 },
      { nombre: "Arduino", habilitado: false }
    ];
  };
*/
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formulario.sede || !diaSel || !horaSel) {
      alert("⚠️ Elegí sede, día y horario.");
      return;
    }

    await calcularDisponibilidadTurno();
    setMostrarResumen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const obtenerHorariosActivos = async ({ cicloCodigo, sede, dia }) => {
    const url =
      `${config.supabaseUrl}/rest/v1/turnos` +
      `?select=hora` +
      `&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}` +
      `&sede=eq.${encodeURIComponent(sede)}` +
      `&dia=eq.${encodeURIComponent(dia)}` +
      `&activo=eq.true`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      },
    });

    const data = await res.json();
    return Array.isArray(data) ? data.map((x) => x.hora) : [];
  };


  const confirmarEnvio = async () => {
  setMostrarResumen(false);
  setMensajeExito("Procesando inscripción... Esto puede tardar unos segundos.");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (!config) return;

  // Validación mínima del flujo nuevo
  if (!formulario.sede || !diaSel || !horaSel || !cursoSelId) {
    setMensajeExito("❌ Falta seleccionar sede, día y horario.");
    return;
  }

    const { listaEspera } = await calcularDisponibilidadTurno();

    const cursoObj = cursos.find((c) => c.id === Number(cursoSelId));
  const cursoNombre = cursoObj?.nombre || formulario.curso || "Robótica";

  const personaId = await buscarPersonaId();
  const payloadBase = {
    ...formulario,
    edad: parseInt(formulario.edad),
    tipo_inscripcion: TIPO_INSCRIPCION,  // TDV
    curso: cursoNombre,                  // ? Rob?tica (no "Taller de Verano")
    turno_1: `${diaSel} ${horaSel}`,      // legacy
      lista_espera: listaEspera || false,
  };
  const payload = {
    ...payloadBase,
    creado_en: new Date().toISOString(),
    persona_id: personaId || null,
  };

  try {
    // 1) crear o actualizar inscripcion
    let alumnoId = personaId || null;
    if (personaId) {
      await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${personaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...supaHeaders(config),
        },
        body: JSON.stringify(payloadBase),
      });
    } else {
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
      alumnoId = insData?.[0]?.id;

      if (!res.ok || !alumnoId) {
        setMensajeExito("? Ocurri? un error al enviar la inscripci?n. Intenta nuevamente.");
        return;
      }
    }
// 2) crear o actualizar matricula activa
      const personaFinal = personaId || alumnoId;
      if (!personaId && alumnoId) {
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${alumnoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...supaHeaders(config),
          },
          body: JSON.stringify({ persona_id: alumnoId }),
        });
      }
      const matriculaPayload = {
        alumno_id: personaFinal,
        ciclo_codigo: "TDV",
        curso_id: Number(cursoSelId),
        curso_nombre: cursoNombre, // legacy opcional
        sede: formulario.sede,
        dia: diaSel,
        hora: horaSel,
        estado: "activa",
        lista_espera: listaEspera || false,
        fecha_inicio: new Date().toISOString().slice(0, 10),
      };
      const resMat = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=id&alumno_id=eq.${personaFinal}` +
          `&ciclo_codigo=eq.TDV&curso_id=eq.${Number(cursoSelId)}&order=creado_en.desc&limit=1`,
        { headers: supaHeaders(config) }
      );
      const dataMat = await resMat.json();
      const existente = Array.isArray(dataMat) ? dataMat[0] : null;
      if (existente?.id) {
        await fetch(`${config.supabaseUrl}/rest/v1/matriculas?id=eq.${existente.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...supaHeaders(config),
          },
          body: JSON.stringify(matriculaPayload),
        });
      } else {
        await fetch(`${config.supabaseUrl}/rest/v1/matriculas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...supaHeaders(config),
          },
          body: JSON.stringify(matriculaPayload),
        });
      }

    // Email
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
        lista_espera: listaEspera ? "Sí" : "No",
    });

    setMensajeExito("✅ Inscripción enviada correctamente. También se envió un correo de confirmación.");
  } catch (error) {
    console.error(error);
    setMensajeExito("❌ Error de conexión. Intenta nuevamente más tarde.");
  }
};

  return (
    <div className="max-w-[700px] w-full mx-auto p-8 bg-white rounded-xl shadow-lg mt-8">

      {mensajeExito ? (
        // ✅ Solo mensaje de éxito final
        <div className="mt-6 p-4 border-l-4 border-green-400 bg-green-50 text-green-800 rounded animate-fadeIn">
          <h4 className="text-lg font-semibold mb-1">
            ✅ ¡Inscripción completada con éxito!
          </h4>
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
          <h2 className="text-2xl font-bold text-center mb-6">Info e Inscripción Taller de Verano</h2>
          {/* Información introductoria del taller */}
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-sm animate-fadeIn">
            <h3 className="text-xl font-semibold text-yellow-700 mb-2">
              ☀️🤖¡Verano 2026 a pura creatividad con LEGO & Robótica!⚙️
            </h3>

            <p className="text-sm text-gray-700 leading-relaxed">
              Una propuesta pensada para chicos y chicas de <strong>5 a 12 años</strong> que quieran explorar, construir y divertirse mientras aprenden.
              Durante las vacaciones nos encontramos para vivir experiencias llenas de creatividad, tecnología y juego. No hace falta experiencia previa: solo ganas de experimentar y pasarlo bien. 😄
            </p>

            {/* Sedes */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">📍 Sedes disponibles:</p>
            <ul className="text-sm text-gray-800 space-y-1 mt-1">
              <li>🏫 <strong>Mendoza 3024 – Rosario (Macrocentro)</strong></li>
              <li>🏫 <strong>Eva Perón 8128 – Rosario (Fisherton)</strong></li>
            </ul>

            {/* Duración, fechas, modalidad */}
            <ul className="mt-4 space-y-1 text-sm text-gray-800">
              <li>📅 <strong>Duración:</strong> 2 meses (8 clases)</li>
              <li>🗓️ <strong>Inicio:</strong> Lunes 5 de enero</li>
              <li>🧩 <strong>Modalidad:</strong> 1 clase por semana de 90 minutos cada una</li>
            </ul>

            {/* Días y horarios */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">🕒 Días y horarios disponibles:</p>
            <ul className="text-sm text-gray-800 space-y-1">
              <li>👉 <strong>Martes:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Miércoles:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Jueves:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Sábados:</strong> 09:00 a 10:30hs · 11:00 a 12:30hs</li>
            </ul>

            {/* Precios y formas de pago */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">💳 Formas de pago</p>

            <ul className="mt-1 text-sm text-gray-800 space-y-1">
              <li>
                 🔒 <strong>Reserva de cupo:</strong> Inscripción mínima de <strong>$10.000</strong> para asegurar el lugar.
              </li>

              <li>
                 🎉 <strong>Primera clase de prueba:</strong> El taller se abona recién después de la primera clase, cuando el alumno ya vivió la experiencia y decide continuar.
              </li>

              <li>
                 💰 <strong>Opción 1 – Pago completo con descuento: </strong>  
                Si abonás el taller completo al inicio (después de la clase de prueba), obtenés un <strong>5% de descuento</strong>, quedando en <strong>$95.000</strong>.
              </li>

              <li>
                 💸 <strong>Opción 2 – Pago en cuotas: </strong>  
                $50.000 en enero y $50.000 en febrero.
              </li>
            </ul>

            <p className="text-sm text-gray-700 mt-3">
              Queremos que cada familia elija la modalidad que mejor se adapte a su momento, siempre priorizando la experiencia y el bienestar de los chicos.
            </p>
          </div>




            {/* Sección: Datos del alumno */}
            <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del alumno</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-tight">Completá los datos para inscribirte al Taller de Verano de Plugin Robótica.</p>
                <hr className="border-gray-200 mt-1" />
            </div>

          {/* Nombre */}
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

          {/* Apellido */}
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

          {/* Edad */}
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

          {/* Escuela */}
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
        {/* Sección: Datos del responsable */}
        <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del responsable</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">Necesitamos estos datos para contactarnos.</p>
            <hr className="border-gray-200 mt-1" />
        </div>

          {/* Responsable */}
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

          {/* Teléfono */}
          <div>
            <label htmlFor="telefono" className="block font-medium mb-1">Teléfono:</label>
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
            {!telefonoValido && <p className="text-red-500 text-sm mt-1">Solo números</p>}
          </div>

          {/* Email */}
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
              <p className="text-red-500 text-sm">Ingresa un email válido de la forma ejemplo@correo.com</p>
            )}
          </div>

            {/* Sección: Seleccioná la sede */}
          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Seleccioná la sede</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-tight">Elegí la sede donde se cursará el taller.</p>
              <hr className="border-gray-200 mt-1" />
          </div>

          {/* Sedes */}
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


        

        {/* Curso */}
        <div className="mb-4 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">
                Elección de taller
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
                Único curso disponible.
            </p>

            <div className="p-4 rounded-lg border border-green-300 bg-green-50 shadow-sm">
                <h4 className="text-lg font-semibold">Robótica con Lego</h4>
                <p className="text-sm text-gray-700">
                Propuestas creativas de robótica y programación para pasar unas vacaciones diferentes.
                </p>
                <span className="text-xs text-green-700">
                Taller de Verano
                </span>
            </div>
        </div>


          {/* Turnos */}
          {formulario.sede && (
            <div className="space-y-4">
              <div className="mt-4">
                <div className="font-semibold mb-2">Turno preferido:</div>

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

          {/* Comentarios */}
          <div>
            <label htmlFor="comentarios" className="block font-medium mb-1">Comentarios:</label>
            <textarea
              id="comentarios"
              placeholder="Información adicional o preguntas"
              value={formulario.comentarios}
              onChange={handleChange}
              rows="3"
              className="w-full border border-gray-300 rounded-lg p-3 placeholder-gray-400 placeholder:italic placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            />
          </div>

        {/* Botones del formulario principal */}
        {!mostrarResumen && !mensajeExito && (
        <div className="flex justify-center gap-4 mt-6">
            <button
              type="submit"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full max-w-sm mx-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-4 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(rutaSalida);
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
          {/* Título del resumen */}
            <div className="mb-4 p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800">Resumen de inscripción</h3>
            <p className="text-sm text-gray-600">Verificá que todos los datos sean correctos antes de confirmar.</p>
            <hr className="border-gray-200 mt-1" />
            </div>

            {/* Datos agrupados */}
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
                    <p><span className="font-semibold">Teléfono:</span> {formulario.telefono}</p>
                    <p><span className="font-semibold">Email:</span> {formulario.email}</p>
                </div>

                <div className="p-4 rounded-lg bg-white shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Taller seleccionado</h4>
                    <p><span className="font-semibold">Sede:</span> <span className="text-green-700">{formulario.sede}</span></p>
                    <p><span className="font-semibold">Taller:</span> <span className="text-green-700">{formulario.curso}</span></p>
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

            {/* Información importante mejorada */}
            <div className="mt-6 p-4 border-l-4 border-green-300 bg-green-50 rounded">
            <h4 className="text-lg font-semibold text-green-800 mb-2">📌 Información importante</h4>
            <p className="text-gray-700 text-sm leading-relaxed">
                Nos comunicamos telefónicamente con todos los inscriptos. Recibirán un mensaje de Whatsapp para el abono de la inscripción y concretar la reserva de banco.
            </p>
            <p className="mt-2 text-gray-700 text-sm leading-relaxed">
                Luego, si el nene/nena realiza la primer clase y decide no continuar, <strong>NO se debe abonar el mes</strong>. Si decide continuar, se deberá abonar la cuota correspondiente.
            </p>
            </div>

            {/* Normas en lista más visual */}
            <div className="mt-4 p-4 border-l-4 border-gray-300 bg-gray-50 rounded">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">📌 Normas del Instituto</h4>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Las ausencias justificadas podrán recuperarse en otros turnos según disponibilidad.</li>
                <li>Los feriados NO podrán recuperarse.</li>
                <li>Los pagos mensuales deberán ser cancelados dentro de los primeros 10 días del mes; luego tendrán un incremento del 5%.</li>
                <li>Agendá este número para recibir notificaciones: <strong>3412153057</strong></li>
            </ul>
            </div>

            
            {/* Botones en la pantalla de resumen */}
            
          <div className="flex justify-center gap-4 mt-6">
            <button type="submit"           onClick={() => {
                confirmarEnvio();
              }}
              className="w-full sm:w-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Confirmar envío
            </button>
            <button type="submit"          onClick={() => {
                setMostrarResumen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
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

export default FormularioInscripcionVerano;




