import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const TZ = "America/Argentina/Buenos_Aires";

function headersFrom(config) {
  return {
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
  };
}

function formatTurno(dia, hora) {
  if (!dia && !hora) return "";
  const base = `${dia} ${hora}`.trim();
  return /hs\.?$/i.test(base) ? base : `${base}hs`;
}

function normalizeSedeToConfig(sede, turnosConfig) {
  const s = String(sede || "").trim();
  if (!s) return "";
  const keys = Object.keys(turnosConfig || {});
  if (keys.includes(s)) return s;

  // alias explícito
  const alias = {
    Mendoza: "Calle Mendoza",
    "Mendoza 3024": "Calle Mendoza",
  };
  if (alias[s] && keys.includes(alias[s])) return alias[s];

  // match bidireccional: s incluye key o key incluye s
  const sLow = s.toLowerCase();
  const found =
    keys.find((k) => sLow.includes(String(k).toLowerCase())) ||
    keys.find((k) => String(k).toLowerCase().includes(sLow));

  return found || s;
}

const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const formatFecha = (valor) => {
  const raw = String(valor || "").trim();
  if (!raw) return "-";
  const base = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
  const [yyyy, mm, dd] = base.split("-");
  if (!yyyy || !mm || !dd) return raw;
  return `${dd}-${mm}-${yyyy}`;
};


const MESES_ORDEN = [
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
const ordenarMeses = (a = "", b = "") => {
  const ia = MESES_ORDEN.indexOf(String(a).toLowerCase());
  const ib = MESES_ORDEN.indexOf(String(b).toLowerCase());
  if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};
const ordenarDias = (lista = []) =>
  [...lista].sort((a, b) => {
    const ia = ORDEN_DIAS.indexOf(a);
    const ib = ORDEN_DIAS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

const inicioDeRango = (valor) => {
  const m = String(valor || "").match(/(\d{1,2}:\d{2})/);
  return m ? m[1].padStart(5, "0") : String(valor || "");
};
const ordenarHorarios = (lista = []) =>
  [...lista].sort((a, b) => inicioDeRango(a).localeCompare(inicioDeRango(b)));

const Card = ({ title, children }) => (
  <div className="rounded-lg shadow-md p-4 bg-gray-50 mb-4">
    {title && <h4 className="text-xl font-bold border-b pb-2 mb-3">{title}</h4>}
    {children}
  </div>
);

const normalizeText = (txt = "") =>
  String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export default function FichaAlumno() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const headers = useMemo(() => headersFrom(config), [config]);

  const [mensaje, setMensaje] = useState("");

const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
const [alumnos, setAlumnos] = useState([]);
const [incluirInactivos, setIncluirInactivos] = useState(false);
const [incluirFinalizadas, setIncluirFinalizadas] = useState(false);
const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
const [inscripcionesPersona, setInscripcionesPersona] = useState([]);
const [modoEdicionAlumno, setModoEdicionAlumno] = useState(false);
const [modoEdicionMatriculaId, setModoEdicionMatriculaId] = useState(null); // id de la matrícula que estás editando
const [pagosAlumno, setPagosAlumno] = useState([]);
const [grupoPromoId, setGrupoPromoId] = useState(null);
const [grupoIntegrantes, setGrupoIntegrantes] = useState([]); // [{id,nombre,apellido}]
const [grupoDescuento, setGrupoDescuento] = useState(10); // porcentaje de descuento del grupo

  

  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);

  // Matrículas del alumno
  const [matriculasAlumno, setMatriculasAlumno] = useState([]);
  const [matriculaSeleccionada, setMatriculaSeleccionada] = useState(null);

  // Modo edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [formAlumno, setFormAlumno] = useState(null);
  const [matriculaForm, setMatriculaForm] = useState(null);

  // Cursos y turnos
  const [cursosDisponibles, setCursosDisponibles] = useState([]);
  const [cargandoCursos, setCargandoCursos] = useState(false);
  const [turnosConfig, setTurnosConfig] = useState({});
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  // ----------------------------
  // Cargar config
  // ----------------------------
  useEffect(() => {
    (async () => {
      const res = await fetch("/config.json");
      const cfg = await res.json();
      setConfig(cfg);
    })();
  }, []);

  // ----------------------------
  // Cargar alumnos
  // ----------------------------
  const cargarAlumnos = async () => {
    if (!config) return [];
    setCargandoAlumnos(true);
    try {
      const baseSelect = "select=id,persona_id,nombre,apellido,fecha_nacimiento,edad,escuela,responsable,telefono,email,curso,sede,turno_1,tiene_promo,beneficiario_id,creado_en,actualizado_en";
      const filtroActivo = incluirInactivos ? "" : "activo=eq.true&";

      const resMat = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?select=alumno_id,estado&or=(estado.eq.activa,estado.eq.finalizada)`,
        { headers }
      );
      const mats = await resMat.json();
      const mapaActivas = {};
      const mapaFinalizadas = {};
      (Array.isArray(mats) ? mats : []).forEach((m) => {
        const estado = String(m.estado || "").toLowerCase();
        if (estado === "activa") {
          mapaActivas[m.alumno_id] = (mapaActivas[m.alumno_id] || 0) + 1;
        }
        if (estado === "finalizada") {
          mapaFinalizadas[m.alumno_id] = (mapaFinalizadas[m.alumno_id] || 0) + 1;
        }
      });

      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/inscripciones?${filtroActivo}${baseSelect}&order=nombre.asc`,
        { headers }
      );
      const data = await res.json();
      const raw = Array.isArray(data) ? data : [];

      const map = new Map();
      for (const r of raw) {
        const pid = r.persona_id || r.id;
        const prev = map.get(pid);
        const rIsPrincipal = r.id === pid;
        const prevIsPrincipal = prev ? prev.id === pid : false;
        let elegir = r;
        if (prev) {
          if (prevIsPrincipal) {
            elegir = prev;
          } else if (rIsPrincipal) {
            elegir = r;
          } else {
            const rDate = new Date(r.creado_en || 0).getTime();
            const pDate = new Date(prev.creado_en || 0).getTime();
            elegir = rDate >= pDate ? r : prev;
          }
        }
        map.set(pid, elegir);
      }

      const lista = Array.from(map.values()).sort((a, b) =>
        `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
      );

      const listaConEstado = lista.map((a) => ({
        ...a,
        matriculas_activas: mapaActivas[a.id] || 0,
        matriculas_finalizadas: mapaFinalizadas[a.id] || 0,
        tieneActiva: (mapaActivas[a.id] || 0) > 0,
      }));

      const listaFiltrada = listaConEstado.filter((a) => {
        if (a.tieneActiva) return true;
        if (!incluirInactivos && a.activo === false) return false;
        if (a.matriculas_finalizadas > 0) {
          return incluirFinalizadas;
        }
        return true;
      });

      setAlumnos(listaFiltrada);
      return listaFiltrada;
    } finally {
      setCargandoAlumnos(false);
    }
  };

  useEffect(() => {
    cargarAlumnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, incluirInactivos, incluirFinalizadas]);

  // ----------------------------
  // Cargar ciclos
  // ----------------------------
  useEffect(() => {
    if (!config) return;
    (async () => {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
        { headers }
      );
      const data = await res.json();
      setCiclosDisponibles(Array.isArray(data) ? data : []);
    })();
  }, [config, headers]);

  // ----------------------------
  // Helpers: cursos y turnos
  // ----------------------------
  const cargarInscripcionesPersona = async (personaId) => {
    if (!config || !personaId) return [];

    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?persona_id=eq.${personaId}&select=id,persona_id,nombre,apellido,fecha_nacimiento,edad,escuela,responsable,telefono,email,tiene_promo,beneficiario_id,creado_en,actualizado_en,curso,sede,turno_1,tipo_inscripcion&order=creado_en.desc`,
      { headers }
    );
    const data = await res.json();
    const lista = Array.isArray(data) ? data : [];
    setInscripcionesPersona(lista);
    
    return lista;
  };



  const fetchCursosPorCiclo = async (cicloCodigo) => {
    if (!config || !cicloCodigo) {
      setCursosDisponibles([]);
      return [];
    }
      setCargandoCursos(true);
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?select=id,nombre,turnos_config&ciclo=eq.${encodeURIComponent(
          cicloCodigo
        )}&activo=eq.true&order=nombre.asc`,
        { headers }
      );
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setCursosDisponibles(lista);
      return lista;
    } finally {
      setCargandoCursos(false);
    }
  };

  const fetchTurnosConfigPorCursoId = async (cursoId) => {
    if (!config || !cursoId) {
      setTurnosConfig({});
      return;
    }
    setCargandoTurnos(true);
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?select=turnos_config&id=eq.${Number(
          cursoId
        )}&limit=1`,
        { headers }
      );
      const data = await res.json();
      const tc = data?.[0]?.turnos_config;
      setTurnosConfig(tc && typeof tc === "object" ? tc : {});
    } finally {
      setCargandoTurnos(false);
    }
  };


  // Al cambiar el ciclo, traer cursos de ese ciclo y precargar el primero (con sus turnos)
  useEffect(() => {
    const cargarCursosYTurnos = async () => {
      if (!matriculaForm?.ciclo_codigo) {
        setCursosDisponibles([]);
        setTurnosConfig({});
        return;
      }

      const lista = await fetchCursosPorCiclo(matriculaForm.ciclo_codigo);

      // Usar el curso actual si existe; si no hay, tomar el primero disponible
      const cursoIdActual = matriculaForm.curso_id ?? null;
      const cursoIdElegido =
        cursoIdActual || (Array.isArray(lista) && lista.length > 0 ? lista[0].id : null);

      if (cursoIdElegido) {
        // Solo resetear sede/día/hora cuando no teníamos curso previo (caso nueva matrícula)
        if (!cursoIdActual) {
          setMatriculaForm((prev) => ({
            ...(prev || {}),
            curso_id: cursoIdElegido,
            sede: "",
            dia: "",
            hora: "",
          }));
        }
        await fetchTurnosConfigPorCursoId(cursoIdElegido);
      } else {
        setTurnosConfig({});
      }
    };

    cargarCursosYTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matriculaForm?.ciclo_codigo]);

  // Cuando cambia el curso seleccionado, traer turnos_config de ese curso
  useEffect(() => {
    if (!matriculaForm?.curso_id) {
      setTurnosConfig({});
      return;
    }
    fetchTurnosConfigPorCursoId(matriculaForm.curso_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matriculaForm?.curso_id]);

  // ----------------------------
  // Matrículas del alumno
  // ----------------------------
  const cargarMatriculasAlumno = async (alumnoId) => {
    if (!config || !alumnoId) return { lista: [], seleccion: null };

    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?alumno_id=eq.${alumnoId}&select=*&order=creado_en.desc`,
      { headers }
    );
    const data = await res.json();
    const lista = Array.isArray(data) ? data : [];

    // default: última activa; si no, la más reciente
    const activa = lista.find((m) => m.estado === "activa") || lista[0] || null;

    setMatriculasAlumno(lista);
    setMatriculaSeleccionada(activa);

    return { lista, seleccion: activa };
  };

  const cargarMatriculasAlumnoPorIds = async (ids) => {
  if (!config) return { lista: [], seleccion: null };

  const listaIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (listaIds.length === 0) {
    setMatriculasAlumno([]);
    setMatriculaSeleccionada(null);
    return { lista: [], seleccion: null };
  }

  const or = listaIds.map((id) => `alumno_id.eq.${id}`).join(",");

  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/matriculas?select=*&or=(${or})&order=creado_en.desc`,
    { headers }
  );

  const data = await res.json();
  const lista = Array.isArray(data) ? data : [];
  const activa = lista.find((m) => m.estado === "activa") || lista[0] || null;

  setMatriculasAlumno(lista);
  setMatriculaSeleccionada(activa);

  return { lista, seleccion: activa };
};

  const cargarPagosAlumno = async (alumnoId) => {
    if (!config || !alumnoId) {
      setPagosAlumno([]);
      return [];
    }
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${alumnoId}&select=*`,
        { headers }
      );
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setPagosAlumno(lista);
      return lista;
    } catch {
      setPagosAlumno([]);
      return [];
    }
  };


  // ----------------------------
  // Seleccionar alumno
  // ----------------------------
  const personaIdFrom = (alumno) => alumno?.persona_id || alumno?.id;

  const seleccionarAlumno = async (alumnoId) => {
    const fila = alumnos.find((a) => a.id === alumnoId) || null;
    if (!fila) return;

    const personaId = fila.persona_id || fila.id;

    // 1) Traer todas las filas legacy de la persona
    const lista = await cargarInscripcionesPersona(personaId);
    const principal = lista.find((x) => x.id === personaId) || lista[0] || fila;

    // 2) Setear alumno principal para mostrar datos base
    setAlumnoSeleccionado(principal);

    // 3) Cargar matrículas de TODOS los legacy ids (para que aparezca TDV + CICLO_2025)
    const idsInscripciones = lista.map((x) => x.id);
    await cargarMatriculasAlumnoPorIds(idsInscripciones);
    await cargarPagosAlumno(personaId);

    // 4) Cargar grupo promo
    await cargarGrupoPromo(personaId);
  };



  // Selección automática por URL param
  useEffect(() => {
    if (!id || alumnos.length === 0 || alumnoSeleccionado) return;
    const found =
      alumnos.find((a) => String(a.id) === String(id)) ||
      alumnos.find((a) => String(a.persona_id) === String(id));
    if (found) seleccionarAlumno(found.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, alumnos]);

  // ----------------------------
  // Entrar edición (sobre matrícula seleccionada)
  // ----------------------------
  const entrarEdicion = async () => {
    if (!alumnoSeleccionado) return;

    const mat = matriculaSeleccionada;

    const inicial = {
      ciclo_codigo: mat?.ciclo_codigo || "",
      curso_id: mat?.curso_id ?? null,
      sede: mat?.sede || "",
      dia: mat?.dia || "",
      hora: mat?.hora || "",
      lista_espera: !!mat?.lista_espera,
    };

    setFormAlumno({ ...alumnoSeleccionado });
    setMatriculaForm(inicial);
    setModoEdicion(true);

    if (inicial.ciclo_codigo) await fetchCursosPorCiclo(inicial.ciclo_codigo);
    if (inicial.curso_id) await fetchTurnosConfigPorCursoId(inicial.curso_id);
  };

  const entrarEdicionAlumno = () => {
    if (!alumnoSeleccionado) return;
    setFormAlumno({
      nombre: alumnoSeleccionado.nombre || "",
      apellido: alumnoSeleccionado.apellido || "",
      edad: alumnoSeleccionado.edad ?? "",
      escuela: alumnoSeleccionado.escuela || "",
      responsable: alumnoSeleccionado.responsable || "",
      telefono: alumnoSeleccionado.telefono || "",
      email: alumnoSeleccionado.email || "",
      tiene_promo: !!alumnoSeleccionado.tiene_promo,
      beneficiario_id: alumnoSeleccionado.beneficiario_id || null,
      beneficiarios_ids: (grupoIntegrantes || [])
        .map((g) => g?.id || g)
        .filter((id) => String(id) !== String(personaIdFrom(alumnoSeleccionado))),
      promo_descuento: grupoDescuento,
    });
    setModoEdicionAlumno(true);
  };

  const cancelarEdicionAlumno = () => {
    setModoEdicionAlumno(false);
    // no limpies formAlumno, simplemente salís de edición
  };

  const guardarCambiosAlumno = async () => {
    if (!config || !alumnoSeleccionado || !formAlumno) return;

    setMensaje("Guardando alumno...");

    const descRaw =
      formAlumno?.promo_descuento != null ? Number(formAlumno.promo_descuento) : grupoDescuento;
    const descuentoVal = Number.isFinite(descRaw)
      ? Math.max(0, Math.min(100, descRaw))
      : 0;

    if (formAlumno?.tiene_promo && (descuentoVal < 0 || descuentoVal > 100)) {
      setMensaje("⚠️ Elegí un descuento entre 0 y 100.");
      setTimeout(() => setMensaje(""), 2500);
      return;
    }

    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const payloadAlumno = {
      nombre: formAlumno.nombre,
      apellido: formAlumno.apellido,
      edad: formAlumno.edad,
      escuela: formAlumno.escuela,
      responsable: formAlumno.responsable,
      telefono: formAlumno.telefono,
      email: formAlumno.email,
      tiene_promo: !!formAlumno.tiene_promo,
      beneficiario_id: formAlumno.tiene_promo ? formAlumno.beneficiario_id || null : null,
      actualizado_en: new Date().toISOString(),
    };


    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${personaIdFrom(alumnoSeleccionado)}`,
      {
        method: "PATCH",
        headers: headersJson,
        body: JSON.stringify(payloadAlumno),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(err);
      setMensaje("❌ No se pudo guardar el alumno");
      setTimeout(() => setMensaje(""), 2500);
      return;
    }

    // refrescar lista y seleccionado
    const lista = await cargarAlumnos();
    const pid = personaIdFrom(alumnoSeleccionado);
    const actualizado = (Array.isArray(lista) ? lista : []).find(
      (a) => String(personaIdFrom(a)) === String(pid)
    );
    if (actualizado) setAlumnoSeleccionado(actualizado);

    // --- Gestionar grupo de promo (soporta 2+) ---
    const { grupoId: grupoActualId, integrantes: integrantesActuales, descuento: descuentoActual } =
      await obtenerGrupoPromo(pid);
    const actualesSet = new Set((integrantesActuales || []).map((x) => String(x)));

    let seleccionados = [];
    if (formAlumno?.tiene_promo) {
      const setSel = new Set([pid, ...(formAlumno.beneficiarios_ids || [])].filter(Boolean).map(String));
      seleccionados = Array.from(setSel);
    } else {
      seleccionados = Array.from(actualesSet).filter((id) => id !== String(pid));
    }

    const headersJsonLocal = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const seleccionadosSet = new Set(seleccionados.map(String));
    const salen = Array.from(actualesSet).filter((id) => !seleccionadosSet.has(id));
    if (salen.length) {
      const filtro = salen.map((id) => `id.eq.${id}`).join(",");
      await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?or=(${filtro})`, {
        method: "PATCH",
        headers: headersJsonLocal,
        body: JSON.stringify({ tiene_promo: false, beneficiario_id: null }),
      });
      if (grupoActualId) {
        const filtroDel = salen.map((id) => `alumno_id.eq.${id}`).join(",");
        await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${grupoActualId}&or=(${filtroDel})`, {
          method: "DELETE",
          headers: headersJsonLocal,
        });
      }
    }

    if (seleccionados.length >= 2) {
      const gidUsar = grupoActualId || null;
      await crearGrupoPromo(seleccionados, gidUsar, descuentoVal);
      setGrupoDescuento(descuentoVal);
    } else {
      const idsLimpiar = Array.from(new Set([...Array.from(actualesSet), ...seleccionados]));
      if (idsLimpiar.length) {
        const filtro = idsLimpiar.map((id) => `id.eq.${id}`).join(",");
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?or=(${filtro})`, {
          method: "PATCH",
          headers: headersJsonLocal,
          body: JSON.stringify({ tiene_promo: false, beneficiario_id: null }),
        });
      }
      if (grupoActualId) {
        await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${grupoActualId}`, {
          method: "DELETE",
          headers: headersJsonLocal,
        });
      }
    }

    await cargarGrupoPromo(pid);

    setModoEdicionAlumno(false);
    setMensaje("✅ Alumno actualizado");
    setTimeout(() => setMensaje(""), 1200);
  };



  const editarMatricula = async (m) => {
    if (!m) return;

    setMatriculaSeleccionada(m);

    setMatriculaForm({
      ciclo_codigo: m.ciclo_codigo || "",
      curso_id: m.curso_id ?? null,
      sede: m.sede || "",
      dia: m.dia || "",
      hora: m.hora || "",
      lista_espera: !!m.lista_espera,
    });

    setModoEdicionMatriculaId(m.id);

    // cargar cursos del ciclo y turnos del curso para que los selects tengan data
    if (m.ciclo_codigo) await fetchCursosPorCiclo(m.ciclo_codigo);
    if (m.curso_id) await fetchTurnosConfigPorCursoId(m.curso_id);
  };


  const cancelarEdicionMatricula = () => {
    setModoEdicionMatriculaId(null);
  };

  // ----------------------------
  // Nueva inscripción / matrícula (sin pisar otras)
  // ----------------------------
  const nuevaMatricula = async () => {
    if (!alumnoSeleccionado) return;
    

    // elegir un ciclo default: primer ciclo activo
    const cicloDefault =
      ciclosDisponibles.find((c) => c.activo)?.codigo || ciclosDisponibles[0]?.codigo || "";

    setMatriculaSeleccionada(null);
    //setFormAlumno({ ...alumnoSeleccionado });
    setMatriculaForm({
      ciclo_codigo: cicloDefault,
      curso_id: null,
      sede: "",
      dia: "",
      hora: "",
      lista_espera: false,
    });
    setTurnosConfig({});
    //setModoEdicion(true);

    if (cicloDefault) {
      const cursos = await fetchCursosPorCiclo(cicloDefault);
      const first = Array.isArray(cursos) ? cursos[0] : null;
      if (first) {
        setMatriculaForm((prev) => ({
          ...prev,
          curso_id: first.id,
          sede: "",
          dia: "",
          hora: "",
          lista_espera: false,
        }));
        await fetchTurnosConfigPorCursoId(first.id);
      }
    }
    setModoEdicionMatriculaId("NUEVA");
  };

  


  const cancelarEdicion = () => {
    setModoEdicion(false);
    setFormAlumno(null);
    setMatriculaForm(null);
    setCursosDisponibles([]);
    setTurnosConfig({});
    setMensaje("");
  };

  // Normalizar sede/día/hora cuando cargan turnos_config
  useEffect(() => {
    if (!modoEdicion || !matriculaForm) return;
    const keys = Object.keys(turnosConfig || {});
    if (keys.length === 0) return;

    const sedeNorm = normalizeSedeToConfig(matriculaForm.sede, turnosConfig);
    const dias =
      sedeNorm && turnosConfig?.[sedeNorm] ? Object.keys(turnosConfig[sedeNorm]) : [];
    const diaNorm = dias.includes(matriculaForm.dia) ? matriculaForm.dia : "";

    const horasDisponibles =
      sedeNorm && diaNorm && Array.isArray(turnosConfig?.[sedeNorm]?.[diaNorm])
        ? turnosConfig[sedeNorm][diaNorm]
        : [];

    const horaNorm = horasDisponibles.includes(matriculaForm.hora) ? matriculaForm.hora : "";

    if (
      sedeNorm !== matriculaForm.sede ||
      diaNorm !== matriculaForm.dia ||
      horaNorm !== matriculaForm.hora
    ) {
      setMatriculaForm((prev) => ({
        ...prev,
        sede: sedeNorm || "",
        dia: diaNorm || "",
        hora: horaNorm || "",
      }));
    }
  }, [turnosConfig, modoEdicion, matriculaForm]);

  // ----------------------------
  // Guardar
  // ----------------------------
  const guardarCambios = async () => {
    if (!config || !alumnoSeleccionado || !formAlumno || !matriculaForm) return;

    const cicloCodigo = matriculaForm.ciclo_codigo || "";
    const cursoId = matriculaForm.curso_id ?? null;
    const sede = matriculaForm.sede || "";
    const dia = matriculaForm.dia || "";
    const hora = matriculaForm.hora || "";

    if (!cicloCodigo || !cursoId || !sede || !dia || !hora) {
      setMensaje("⚠️ Completá Ciclo, Curso, Sede, Día y Horario antes de guardar.");
      return;
    }

    setMensaje("Guardando cambios...");

    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // 1) Resolver nombre real del curso (fuente de verdad por curso_id)
    let cursoNombre = "";
    try {
      const resCurso = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?select=nombre&id=eq.${Number(cursoId)}&limit=1`,
        { headers }
      );
      const dataCurso = await resCurso.json();
      cursoNombre = dataCurso?.[0]?.nombre || "";
    } catch {
      cursoNombre = "";
    }

    // 2) Actualizar datos base del alumno (tabla inscripciones)
    //    Nota: curso/sede/turno_1 quedan como "resumen" (legacy) de la última inscripción editada.
    const payloadAlumno = {
      nombre: formAlumno.nombre,
      apellido: formAlumno.apellido,
      edad: formAlumno.edad,
      escuela: formAlumno.escuela,
      responsable: formAlumno.responsable,
      telefono: formAlumno.telefono,
      email: formAlumno.email,
      tiene_promo: formAlumno.tiene_promo,
      beneficiario_id: formAlumno.beneficiario_id,
      actualizado_en: new Date().toISOString(),
    };


    const resAlumno = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${personaIdFrom(alumnoSeleccionado)}`,
      {
        method: "PATCH",
        headers: headersJson,
        body: JSON.stringify(payloadAlumno),
      }
    );

    if (!resAlumno.ok) {
      const err = await resAlumno.text();
      console.error(err);
      setMensaje("❌ No se pudo guardar el alumno");
      return;
    }

    // 3) Matrícula: update o create
    //    Regla: permitir múltiples ciclos activos, pero evitar 2 activas del mismo ciclo.
    if (matriculaSeleccionada?.id) {
      const resMat = await fetch(
        `${config.supabaseUrl}/rest/v1/matriculas?id=eq.${matriculaSeleccionada.id}`,
        {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({
            ciclo_codigo: cicloCodigo,
            curso_id: Number(cursoId),
            curso_nombre: cursoNombre, // legacy opcional
            sede,
            dia,
            hora,
            lista_espera: !!matriculaForm.lista_espera,
          }),
        }
      );

      if (!resMat.ok) {
        const err = await resMat.text();
        console.error(err);
        setMensaje("❌ No se pudo guardar la matrícula");
        return;
      }
    } else {
      // cerrar matrícula activa previa del mismo ciclo (si existiera)
      try {
        await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?alumno_id=eq.${personaIdFrom(
        alumnoSeleccionado
      )}&ciclo_codigo=eq.${encodeURIComponent(cicloCodigo)}&estado=eq.activa`,
          {
            method: "PATCH",
            headers: {
              ...headersJson,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ estado: "finalizada" }),
          }
        );
      } catch {
        // ignore
      }

      const resMat = await fetch(`${config.supabaseUrl}/rest/v1/matriculas`, {
        method: "POST",
        headers: headersJson,
        body: JSON.stringify({
          alumno_id: personaIdFrom(alumnoSeleccionado),
          curso_id: Number(cursoId),
          curso_nombre: cursoNombre,
          ciclo_codigo: cicloCodigo,
          sede,
          dia,
          hora,
          estado: "activa",
          lista_espera: !!matriculaForm.lista_espera,
          fecha_inicio: new Date().toISOString().slice(0, 10),
        }),
      });

      if (!resMat.ok) {
        const err = await resMat.text();
        console.error(err);
        setMensaje("❌ No se pudo crear la matrícula");
        return;
      }
    }

    // 4) Refrescar todo
    const listaAlumnos = await cargarAlumnos();

    const personaIdSel = personaIdFrom(alumnoSeleccionado);
    const { lista, seleccion } = await cargarMatriculasAlumno(personaIdSel);

    // si veníamos creando nueva, setear selección a la última activa del ciclo guardado
    const sel =
      lista.find((m) => m.estado === "activa" && m.ciclo_codigo === cicloCodigo) ||
      seleccion ||
      null;
    setMatriculaSeleccionada(sel);

    // refrescar alumno seleccionado desde lista
    const actualizado = (Array.isArray(listaAlumnos) ? listaAlumnos : []).find(
      (a) => String(personaIdFrom(a)) === String(personaIdSel)
    );
    if (actualizado) setAlumnoSeleccionado(actualizado);

    setMensaje("✅ Cambios guardados");
    setTimeout(() => setMensaje(""), 1400);
    cancelarEdicion();
  };


  const beneficiario = useMemo(() => {
    if (!alumnoSeleccionado?.beneficiario_id) return null;
    return alumnos.find((a) => a.id === alumnoSeleccionado.beneficiario_id) || null;
  }, [alumnoSeleccionado, alumnos]);

  // ----------------------------
  // Labels
  // ----------------------------
  const cicloLabel = useMemo(() => {
    const codigo = matriculaSeleccionada?.ciclo_codigo || "";
    if (!codigo) return "";
    const c = ciclosDisponibles.find((x) => x.codigo === codigo);
    return c ? `${c.nombre_publico} (${c.codigo})` : codigo;
  }, [matriculaSeleccionada, ciclosDisponibles]);

  const cursoLabel = matriculaSeleccionada?.curso_nombre || "";
  const sedeLabel = matriculaSeleccionada?.sede ||"";
  const diaLabel = matriculaSeleccionada?.dia || "";
  const horaLabel = matriculaSeleccionada?.hora || "";

  // Opciones dependientes de turnos_config
  const sedes = Object.keys(turnosConfig || {});
  const diasRaw =
    matriculaForm?.sede && turnosConfig?.[matriculaForm.sede]
      ? Object.keys(turnosConfig[matriculaForm.sede])
      : [];
  const dias = ordenarDias(diasRaw);
  const horasRaw =
    matriculaForm?.sede &&
    matriculaForm?.dia &&
    Array.isArray(turnosConfig?.[matriculaForm.sede]?.[matriculaForm.dia])
      ? turnosConfig[matriculaForm.sede][matriculaForm.dia]
      : [];
  const horas = ordenarHorarios(horasRaw);

  const parseError = async (res) => {
    try {
      return await res.json();
    } catch {
      return await res.text();
    }
  };

  // --- Promo grupo helpers ---
  const obtenerGrupoPromo = async (alumnoId) => {
    if (!config || !alumnoId) return { grupoId: null, integrantes: [], descuento: null };
    const headersJson = { ...headers, "Content-Type": "application/json" };
    const resG = await fetch(
      `${config.supabaseUrl}/rest/v1/promos_grupo?select=grupo_id,descuento_pct&alumno_id=eq.${alumnoId}&limit=1`,
      { headers: headersJson }
    );
    const dataG = await resG.json();
    const gid = dataG?.[0]?.grupo_id || null;
    const descuento = dataG?.[0]?.descuento_pct ?? null;
    if (!gid) return { grupoId: null, integrantes: [], descuento };

    const resM = await fetch(
      `${config.supabaseUrl}/rest/v1/promos_grupo?select=alumno_id,descuento_pct&grupo_id=eq.${gid}`,
      { headers: headersJson }
    );
    const mem = await resM.json();
    const ids = (Array.isArray(mem) ? mem : []).map((m) => m.alumno_id).filter(Boolean);
    const desc = mem?.[0]?.descuento_pct ?? descuento ?? null;
    return { grupoId: gid, integrantes: ids, descuento: desc };
  };

  const cargarGrupoPromo = async (alumnoId) => {
    const { grupoId, integrantes, descuento } = await obtenerGrupoPromo(alumnoId);
    let miembros = integrantes;
    if (integrantes.length) {
      const filtro = integrantes.map((id) => `id.eq.${id}`).join(",");
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido&or=(${filtro})`,
          { headers }
        );
        const data = await res.json();
        miembros = Array.isArray(data) ? data : integrantes;
      } catch {
        miembros = integrantes;
      }
    }
    setGrupoPromoId(grupoId);
    setGrupoIntegrantes(miembros);
    setGrupoDescuento(
      descuento != null && Number.isFinite(Number(descuento)) ? Number(descuento) : 10
    );
    return { grupoId, integrantes: miembros, descuento };
  };
  const eliminarGrupoPromoDeAlumno = async (alumnoId) => {
    if (!config || !alumnoId) return;
    try {
      const headersJson = {
        ...headers,
        "Content-Type": "application/json",
      };
      // obtener grupo
      const resG = await fetch(
        `${config.supabaseUrl}/rest/v1/promos_grupo?select=grupo_id&alumno_id=eq.${alumnoId}&limit=1`,
        { headers: headersJson }
      );
      const dataG = await resG.json();
      const gid = dataG?.[0]?.grupo_id;
      if (!gid) return;

      // obtener miembros
      const resM = await fetch(
        `${config.supabaseUrl}/rest/v1/promos_grupo?select=alumno_id&grupo_id=eq.${gid}`,
        { headers: headersJson }
      );
      const mem = await resM.json();
      const ids = (Array.isArray(mem) ? mem : []).map((m) => m.alumno_id).filter(Boolean);

      // borrar grupo
      await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${gid}`, {
        method: "DELETE",
        headers: headersJson,
      });

      // limpiar flags de promo en inscripciones de todos los miembros
      if (ids.length) {
        const filtro = ids.map((id) => `id.eq.${id}`).join(",");
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?or=(${filtro})`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({ tiene_promo: false, beneficiario_id: null }),
        });
      }
    } catch (err) {
      console.error("No se pudo limpiar grupo promo", err);
    }
  };


  const crearGrupoPromo = async (miembros = [], grupoExistenteId = null, descuentoPct = 10) => {
    if (!config) return;
    const miembrosValidos = (miembros || []).filter(Boolean);
    if (miembrosValidos.length < 2) return; // no creamos grupo si hay <2
    const gid =
      grupoExistenteId ||
      (crypto?.randomUUID && crypto.randomUUID()) ||
      `promo-${Date.now()}`;
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    try {
      // borrar filas previas del grupo y reinsertar selecci?n completa
      await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${gid}`, {
        method: "DELETE",
        headers: headersJson,
      });

      await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo`, {
        method: "POST",
        headers: headersJson,
        body: JSON.stringify(
          miembrosValidos.map((id) => ({
            grupo_id: gid,
            alumno_id: id,
            descuento_pct: descuentoPct,
          }))
        ),
      });

      // actualizar inscripciones para todos los miembros
      const filtro = miembrosValidos.map((id) => `id.eq.${id}`).join(",");
      if (miembrosValidos.length === 2) {
        const [a, b] = miembrosValidos;
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${a}`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({ tiene_promo: true, beneficiario_id: b }),
        });
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${b}`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({ tiene_promo: true, beneficiario_id: a }),
        });
      } else {
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?or=(${filtro})`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({ tiene_promo: true, beneficiario_id: null }),
        });
      }
    } catch (err) {
      console.error("No se pudo crear grupo promo", err);
    }
  };

  const removerMiembroDeGrupoPromo = async (alumnoId) => {
    if (!config || !alumnoId) return;
    const { grupoId, integrantes, descuento } = await obtenerGrupoPromo(alumnoId);
    if (!grupoId || !integrantes.length) return;

    const headersJson = { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" };

    // sacar al alumno del grupo
    await fetch(
      `${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${grupoId}&alumno_id=eq.${alumnoId}`,
      { method: "DELETE", headers: headersJson }
    );

    // limpiar flags de promo del alumno removido
    await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?id=eq.${alumnoId}`, {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify({ tiene_promo: false, beneficiario_id: null }),
    });

    const restantes = integrantes.filter((id) => String(id) !== String(alumnoId));

    if (restantes.length < 2) {
      // eliminar grupo y limpiar a los demás
      await fetch(`${config.supabaseUrl}/rest/v1/promos_grupo?grupo_id=eq.${grupoId}`, {
        method: "DELETE",
        headers: headersJson,
      });
      if (restantes.length) {
        const filtro = restantes.map((id) => `id.eq.${id}`).join(",");
        await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?or=(${filtro})`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify({ tiene_promo: false, beneficiario_id: null }),
        });
      }
    } else {
      // recrear grupo con los restantes y conservar descuento
      await crearGrupoPromo(restantes, grupoId, descuento ?? 10);
    }
  };

  const pillForEstado = (estado) => {
    const e = (estado || "").toLowerCase();
    if (e === "activa") return { cls: "bg-green-50 border-green-300 text-green-700", label: "Activa" };
    if (e === "baja") return { cls: "bg-red-50 border-red-300 text-red-700", label: "Inactiva" };
    if (e === "pausada") return { cls: "bg-red-50 border-red-300 text-red-700", label: "Inactiva" };
    if (e === "finalizada") return { cls: "bg-gray-100 border-gray-300 text-gray-700", label: "Finalizada" };
    return { cls: "bg-gray-100 border-gray-300 text-gray-700", label: estado || "-" };
  };

  const setEstadoMatricula = async (mat, nuevoEstado) => {
    if (!config || !mat?.id || !nuevoEstado) return;

    const headersJsonLocal = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?id=eq.${mat.id}`,
      {
        method: "PATCH",
        headers: headersJsonLocal,
        body: JSON.stringify({ estado: nuevoEstado }),
      }
    );

    if (!res.ok) {
      const err = await parseError(res);
      console.error("PATCH matriculas error:", err);
      setMensaje("No se pudo cambiar el estado");
      setTimeout(() => setMensaje(""), 2500);
      return;
    }

    const personaId = personaIdFrom(alumnoSeleccionado);
    const inscripciones = (await cargarInscripcionesPersona(personaId)) || inscripcionesPersona || [];
    const idsInscripciones = (Array.isArray(inscripciones) ? inscripciones : []).map((x) => x.id);
    await cargarMatriculasAlumnoPorIds(idsInscripciones);
    await cargarPagosAlumno(personaId);

    setMensaje("Estado actualizado");
    setTimeout(() => setMensaje(""), 1200);
  };

  const guardarCambiosMatricula = async (matriculaId) => {
  if (!config || !alumnoSeleccionado || !matriculaForm) return;

  const ciclo_codigo = matriculaForm.ciclo_codigo || "";
  const curso_id = matriculaForm.curso_id ?? null;
  const sede = matriculaForm.sede || "";
  const dia = matriculaForm.dia || "";
  const hora = matriculaForm.hora || "";

  if (!ciclo_codigo || !curso_id || !sede || !dia || !hora) {
    setMensaje("Complet? ciclo, curso, sede, d?a y horario.");
    return;
  }

  setMensaje("Guardando matr?cula...");

  const headersJson = {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  let curso_nombre = "";
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/cursos?select=nombre&id=eq.${Number(curso_id)}&limit=1`,
      { headers }
    );
    const data = await res.json();
    curso_nombre = data?.[0]?.nombre || "";
  } catch {
    curso_nombre = "";
  }

  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/matriculas?id=eq.${matriculaId}`,
    {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify({
        ciclo_codigo,
        curso_id: Number(curso_id),
        curso_nombre,
        sede,
        dia,
        hora,
        lista_espera: !!matriculaForm.lista_espera,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(err);
    setMensaje("No se pudo guardar la matr?cula");
    return;
  }

  const personaId = personaIdFrom(alumnoSeleccionado);
  const inscripciones = (await cargarInscripcionesPersona(personaId)) || inscripcionesPersona || [];
  const idsInscripciones = (Array.isArray(inscripciones) ? inscripciones : []).map((x) => x.id);
  await cargarMatriculasAlumnoPorIds(idsInscripciones);
    await cargarPagosAlumno(personaId);

  const sel = (matriculasAlumno || []).find((m) => String(m.id) === String(matriculaId)) || null;
  if (sel) setMatriculaSeleccionada(sel);
  setModoEdicionMatriculaId(null);
  setMensaje("Matr?cula actualizada");
  setTimeout(() => setMensaje(""), 1200);
};

const guardarNuevaMatricula = async () => {
  if (!config || !alumnoSeleccionado || !matriculaForm) return;

  const ciclo_codigo = matriculaForm.ciclo_codigo || "";
  const curso_id = matriculaForm.curso_id ?? null;
  const sede = matriculaForm.sede || "";
  const dia = matriculaForm.dia || "";
  const hora = matriculaForm.hora || "";

  if (!ciclo_codigo || !curso_id || !sede || !dia || !hora) {
    setMensaje("Complet? ciclo, curso, sede, d?a y horario.");
    return;
  }

  setMensaje("Creando matr?cula...");

  const headersJson = {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  let curso_nombre = "";
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/cursos?select=nombre&id=eq.${Number(curso_id)}&limit=1`,
      { headers }
    );
    const data = await res.json();
    curso_nombre = data?.[0]?.nombre || "";
  } catch {
    curso_nombre = "";
  }

  const res = await fetch(`${config.supabaseUrl}/rest/v1/matriculas`, {
    method: "POST",
    headers: headersJson,
    body: JSON.stringify({
      alumno_id: personaIdFrom(alumnoSeleccionado),
      curso_id: Number(curso_id),
      curso_nombre,
      ciclo_codigo,
      sede,
      dia,
      hora,
      estado: "activa",
      lista_espera: !!matriculaForm.lista_espera,
      fecha_inicio: new Date().toISOString().slice(0, 10),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(err);
    setMensaje("No se pudo crear la matr?cula");
    return;
  }

  setModoEdicionMatriculaId(null);
  const personaId = personaIdFrom(alumnoSeleccionado);
  await cargarMatriculasAlumno(personaId);
  setMensaje("Matr?cula creada");
  setTimeout(() => setMensaje(""), 1200);
};

const alumnosFiltrados = alumnos.filter((a) => {
  const activas = a.matriculas_activas || 0;
  const finalizadas = a.matriculas_finalizadas || 0;
  if (!incluirInactivos && a.activo === false) return false;
  if (activas > 0) return true;
  if (finalizadas > 0) return incluirFinalizadas;
  return incluirInactivos;
});

const renderEditorMatricula = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
    <div>
      <label className="text-sm font-medium">Ciclo</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.ciclo_codigo || ""}
        onChange={(e) =>
          setMatriculaForm((p) => ({
            ...p,
            ciclo_codigo: e.target.value,
            curso_id: null,
            sede: "",
            dia: "",
            hora: "",
          }))
        }
      >
        <option value="">-- Seleccionar ciclo --</option>
        {ciclosDisponibles.map((c) => (
          <option key={c.codigo} value={c.codigo}>
            {c.nombre_publico} ({c.codigo})
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-sm font-medium">Curso</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.curso_id ?? ""}
        onChange={(e) =>
          setMatriculaForm((p) => ({
            ...p,
            curso_id: e.target.value ? Number(e.target.value) : null,
            sede: "",
            dia: "",
            hora: "",
          }))
        }
      >
        <option value="">-- Seleccionar curso --</option>
        {cursosDisponibles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-sm font-medium">Sede</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.sede || ""}
        onChange={(e) =>
          setMatriculaForm((p) => ({
            ...p,
            sede: e.target.value,
            dia: "",
            hora: "",
          }))
        }
      >
        <option value="">-- Seleccionar sede --</option>
        {sedes.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-sm font-medium">Día</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.dia || ""}
        onChange={(e) =>
          setMatriculaForm((p) => ({
            ...p,
            dia: e.target.value,
            hora: "",
          }))
        }
      >
        <option value="">-- Seleccionar día --</option>
        {dias.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-sm font-medium">Horario</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.hora || ""}
        onChange={(e) => setMatriculaForm((p) => ({ ...p, hora: e.target.value }))}
      >
        <option value="">-- Seleccionar horario --</option>
        {horas.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>

    <div>
      <label className="text-sm font-medium">Cupo</label>
      <select
        className="w-full border rounded p-2"
        value={matriculaForm?.lista_espera ? "espera" : "cupo"}
        onChange={(e) =>
          setMatriculaForm((p) => ({
            ...p,
            lista_espera: e.target.value === "espera",
          }))
        }
      >
        <option value="cupo">Con cupo</option>
        <option value="espera">En lista de espera</option>
      </select>
    </div>
  </div>
);


      
  // Render
  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4 pb-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-3xl font-bold text-center flex-1">Ficha de Alumnos</h2>
        <button
          onClick={() => navigate("/alumnos-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <Card title="Seleccionar alumno">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Incluir inactivos</span>
              <button
                type="button"
                onClick={() => setIncluirInactivos((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  incluirInactivos ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-pressed={incluirInactivos}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    incluirInactivos ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Incluir finalizadas</span>
              <button
                type="button"
                onClick={() => setIncluirFinalizadas((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  incluirFinalizadas ? "bg-yellow-400 hover:bg-yellow-300" : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-pressed={incluirFinalizadas}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    incluirFinalizadas ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {cargandoAlumnos ? (
          <p>Cargando alumnos...</p>
        ) : (
          
          <select
            className="w-full border rounded-lg p-2"
            value={alumnoSeleccionado ? personaIdFrom(alumnoSeleccionado) : ""}
            onChange={(e) => seleccionarAlumno(e.target.value)}
          >
            <option value="">-- Seleccionar --</option>
            
            {alumnosFiltrados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} {a.apellido}
                {(() => {
                  const activas = a.matriculas_activas || 0;
                  const finalizadas = a.matriculas_finalizadas || 0;
                  const rojo = incluirInactivos && activas === 0 && finalizadas === 0;
                  const amarillo = incluirFinalizadas && activas === 0 && finalizadas > 0;
                  if (amarillo) return " 🟡";
                  if (rojo) return " 🔴";
                  return "";
                })()}
              </option>
            ))}
          </select>
        )}
      </Card>

      {alumnoSeleccionado && (
        <>
          <Card title="Datos del alumno">
              
              

            

            {mensaje && <p className="text-center text-green-700 font-medium mt-3">{mensaje}</p>}

            {!modoEdicionAlumno ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3 mt-4">
                <div>
                  <span className="font-medium">Nombre y apellido:</span> {alumnoSeleccionado.nombre}{" "}
                  {alumnoSeleccionado.apellido}
                </div>
                <div>
                  <span className="font-medium">Edad:</span> {alumnoSeleccionado.edad ?? "-"}
                </div>
                <div>
                  <span className="font-medium">Fecha de nacimiento:</span>{" "}
                  {formatFecha(alumnoSeleccionado.fecha_nacimiento)}
                </div>
                <div>
                  <span className="font-medium">Escuela:</span> {alumnoSeleccionado.escuela || "-"}
                </div>
                <div>
                  <span className="font-medium">Responsable:</span> {alumnoSeleccionado.responsable || "-"}
                </div>
                <div>
                  <span className="font-medium">Teléfono:</span> {alumnoSeleccionado.telefono || "-"}
                </div>
                <div>
                  <span className="font-medium">Mail:</span> {alumnoSeleccionado.email || "-"}
                </div>
                <div>
                  <span className="font-medium">Promo:</span>{" "}
                  {(() => {
                    if (!alumnoSeleccionado?.tiene_promo) return "No";
                    const pidSel = String(personaIdFrom(alumnoSeleccionado));
                    const otros = (grupoIntegrantes || [])
                      .map((g) => (typeof g === "object" ? g : { id: g, nombre: "", apellido: "" }))
                      .filter((g) => String(g.id) !== pidSel);
                    if (otros.length === 0) return "Sí";
                    const nombres = otros
                      .map((g) => `${g.nombre || ""} ${g.apellido || ""}`.trim())
                      .filter(Boolean)
                      .join(", ");
                    return nombres ? `Sí (con ${nombres})` : "Sí";
                  })()}
                </div>
                  
              



              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3 mt-4">
                {[
                  { label: "Nombre", key: "nombre", type: "text" },
                  { label: "Apellido", key: "apellido", type: "text" },
                  { label: "Edad", key: "edad", type: "number" },
                  { label: "Escuela", key: "escuela", type: "text" },
                  { label: "Responsable", key: "responsable", type: "text" },
                  { label: "Teléfono", key: "telefono", type: "text" },
                  { label: "Mail", key: "email", type: "email" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={formAlumno?.[f.key] ?? ""}
                      onChange={(e) =>
                        setFormAlumno((prev) => ({
                          ...prev,
                          [f.key]:
                            f.type === "number"
                              ? e.target.value === ""
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium mb-1">Promo</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={formAlumno?.tiene_promo ? "si" : "no"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormAlumno((p) => ({
                        ...p,
                        tiene_promo: v === "si",
                        beneficiario_id: v === "si" ? p.beneficiario_id : null,
                      }));
                    }}
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>

                {formAlumno?.tiene_promo && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Descuento (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={formAlumno?.promo_descuento ?? 10}
                      onChange={(e) =>
                        setFormAlumno((p) => ({
                          ...p,
                          promo_descuento: e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                )}

                {formAlumno?.tiene_promo && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Beneficiarios (selecciona uno o más)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                      {alumnos
                        .filter((a) => a.id !== alumnoSeleccionado?.id)
                        .map((a) => {
                          const checked =
                            formAlumno?.beneficiarios_ids?.some(
                              (id) => String(id) === String(a.id)
                            ) || false;
                          return (
                            <label key={a.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="w-4 h-4"
                                checked={checked}
                                onChange={(e) => {
                                  const val = String(a.id);
                                  setFormAlumno((prev) => {
                                    const current = new Set(prev?.beneficiarios_ids || []);
                                    if (e.target.checked) {
                                      current.add(val);
                                    } else {
                                      current.delete(val);
                                    }
                                    return { ...prev, beneficiarios_ids: Array.from(current) };
                                  });
                                }}
                              />
                              <span>{a.nombre} {a.apellido}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

              </div>
            )}
            <div className="flex gap-3 mt-4 justify-end flex-wrap">
              {!modoEdicionAlumno ? (
                <>
                  <div className="flex items-center justify-end">
                    {!modoEdicionAlumno ? (
                      <span
                        className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 text-sm"
                        onClick={entrarEdicionAlumno}
                      >
                        Editar
                      </span>
                    ) : (
                      <div className="flex items-center gap-3 text-sm">
                        <span
                          className="cursor-pointer text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-gray-100"
                          onClick={guardarCambiosAlumno}
                        >
                          Guardar
                        </span>
                        <span
                          className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                          onClick={cancelarEdicionAlumno}
                        >
                          Cancelar
                        </span>
                      </div>
                    )}
                  </div>


                  
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <span
                      className="cursor-pointer text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-gray-100"
                      onClick={guardarCambiosAlumno}
                    >
                      Guardar
                    </span>
                    <span
                      className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                      onClick={cancelarEdicionAlumno}
                    >
                      Cancelar
                    </span>
                  </div>
                </>
              )}
            </div>

          </Card>
          
          

          <Card title="Historial de inscripciones">
            {(!matriculasAlumno || matriculasAlumno.length === 0) ? (
              <p className="text-sm text-gray-600">Este alumno no tiene inscripciones registradas.</p>
            ) : (

              <div className="space-y-3">
                {matriculasAlumno.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 bg-white w-full"
                  >
                    {(() => {
                      const pill = pillForEstado(m.estado);
                      const pagos = (pagosAlumno || []).filter(
                        (p) => String(p.alumno_id) === String(m.alumno_id)
                      );
                      const pagoInscripcion = pagos.find((p) => p.pago_inscripcion);
                      const mesesPagos = [...pagos]
                        .filter((p) => p.pago_mes)
                        .sort((a, b) => ordenarMeses(a.mes, b.mes));

                      return (
                        <>
                          <div>
                            <div className="font-medium">
                              {ciclosDisponibles.find((c) => c.codigo === m.ciclo_codigo)?.nombre_publico || m.ciclo_codigo}
                              {" * "}
                              {m.curso_nombre || "-"}
                            </div>
                            <div className="text-xs text-gray-400">
                              Inscripto el {" "}
                              <span className="font-medium">
                                {m.creado_en ? new Date(m.creado_en).toLocaleDateString("es-AR", { timeZone: TZ }) : "-"}
                              </span>
                            </div>
                            <div className="mt-2 p-2 rounded-md bg-white text-sm space-y-1">
                              <div>
                                <span className="font-medium text-gray-700">Sede:</span>{" "}
                                <span className="text-gray-800">{m.sede || "-"}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Día:</span>{" "}
                                <span className="text-gray-800">{m.dia || "-"}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Horario:</span>{" "}
                                <span className="text-gray-800">{m.hora || "-"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm mt-2">
                              <span className="text-gray-700">Estado:</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${pill.cls}`}>
                                {pill.label}
                              </span>
                            </div>
                            <div className="text-sm mt-1">
                              Cupo:{" "}
                              <span className="font-medium">
                                {m.lista_espera ? "En lista de espera" : "Con cupo"}
                              </span>
                            </div>

                            <div className="text-sm mt-1">
                              Inscripcion:{" "}
                              <span className="font-medium">
                                {pagoInscripcion ? "Paga" : pagos.length ? "No paga" : "No informado"}
                              </span>
                            </div>
                            <div className="text-sm mt-1">
                              Meses:
                              <div className="mt-1 space-y-1">
                                {mesesPagos.length ? (
                                  mesesPagos.map((p) => (
                                    <div key={`${p.mes}-${p.id}`} className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-700">{p.mes}</span>
                                      <span className={p.pago_mes ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                                        {p.pago_mes ? "Pago" : "No pago"}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-700">
                                      {(() => {
                                        const mes = new Date().toLocaleDateString("es-AR", { month: "long" });
                                        return mes.charAt(0).toUpperCase() + mes.slice(1);
                                      })()}
                                    </span>
                                    <span className="text-red-600 font-medium">No pago</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {modoEdicionMatriculaId !== m.id ? (
                              <div className="flex items-center gap-3 text-sm mt-2 justify-end w-full text-right">
                                <span
                                  onClick={() => editarMatricula(m)}
                                  className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                                >
                                  Editar
                                </span>
                                {String(m.estado).toLowerCase() === "activa" && (
                                  <span
                                    onClick={() => setEstadoMatricula(m, "baja")}
                                    className="cursor-pointer text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-gray-100"
                                  >
                                    Inactivar
                                  </span>
                                )}
                                {["baja", "finalizada"].includes(String(m.estado).toLowerCase()) && (
                                  <span
                                    onClick={() => setEstadoMatricula(m, "activa")}
                                    className="cursor-pointer text-green-700 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50"
                                  >
                                    Reactivar
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2">
                                {renderEditorMatricula()}
                                <div className="flex items-center gap-3 text-sm mt-2 justify-end w-full text-right">
                                  <span
                                    className="cursor-pointer text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-gray-100"
                                    onClick={() => guardarCambiosMatricula(m.id)}
                                  >
                                    Guardar
                                  </span>
                                  <span
                                    className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                                    onClick={cancelarEdicionMatricula}
                                  >
                                    Cancelar
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))}

              </div>
            )}
          </Card>

          <span
            onClick={nuevaMatricula}
            className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 text-sm"
          >
            + Nueva inscripción
          </span>
          {modoEdicionMatriculaId === "NUEVA" && (
            <Card title="Nueva inscripción">
              {renderEditorMatricula()}
              <div className="flex items-center gap-3 text-sm mt-3">
                <span
                  onClick={guardarNuevaMatricula}
                  className="cursor-pointer text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Guardar
                </span>
                <span
                  onClick={cancelarEdicionMatricula}
                  className="cursor-pointer text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Cancelar
                </span>
              </div>
            </Card>
          )}



          
        </>
      )}
    </div>
  );
}




