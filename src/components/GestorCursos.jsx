import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";

// Versión visual de sedes + días + horarios
const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function TurnosResumen({ turnos }) {
  if (
    !turnos ||
    typeof turnos !== "object" ||
    Object.keys(turnos).length === 0
  ) {
    return (
      <span className="text-xs text-gray-400">
        Sin turnos configurados
      </span>
    );
  }

  const ordenarDias = (diasEntries) => {
    return diasEntries.sort(([diaA], [diaB]) => {
      const idxA = ORDEN_DIAS.indexOf(diaA);
      const idxB = ORDEN_DIAS.indexOf(diaB);
      // si algún día no está en la lista, lo mandamos al final
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  };

  const ordenarHorarios = (horarios) => {
    // asume formato HH:MM
    return [...horarios].sort((a, b) => (a || "").localeCompare(b || ""));
  };

  return (
    <div className="space-y-1">
      {Object.entries(turnos).map(([sede, dias]) => {
        if (!dias || typeof dias !== "object") return null;

        const diasOrdenados = ordenarDias(Object.entries(dias));

        return (
          <div key={sede}>
            {/* Nombre de la sede */}
            <p className="text-[11px] font-semibold text-gray-700 mb-0.5">
              {sede}
            </p>

            {/* Chips día + horarios */}
            <div className="flex flex-wrap gap-1">
              {diasOrdenados.map(([dia, horarios]) => {
                const lista =
                  Array.isArray(horarios) && horarios.length
                    ? ordenarHorarios(horarios).join(", ")
                    : "—";

                return (
                  <span
                    key={sede + dia}
                    className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700"
                  >
                    {dia}: {lista}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GestorCursos() {
    const [config, setConfig] = useState(null);
    const [cursos, setCursos] = useState([]);
    const [ciclos, setCiclos] = useState([]);          // 🔹 ciclos desde Supabase
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [creando, setCreando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [filtroCiclo, setFiltroCiclo] = useState("TODOS");
    const [soloActivos, setSoloActivos] = useState(false);
    const [subiendoImagen, setSubiendoImagen] = useState(false);
    const [errorImagen, setErrorImagen] = useState("");
    const [sedesSeleccionadas, setSedesSeleccionadas] = useState({});
    const [turnosConfig, setTurnosConfig] = useState({});
    const [nuevoHorario, setNuevoHorario] = useState({});
    const [editSedesSeleccionadas, setEditSedesSeleccionadas] = useState({});
    const [editTurnosConfig, setEditTurnosConfig] = useState({});
    const [editNuevoHorario, setEditNuevoHorario] = useState({});
    const [subiendoImagenEdit, setSubiendoImagenEdit] = useState(false);
    const [errorImagenEdit, setErrorImagenEdit] = useState("");


    const [nuevoCurso, setNuevoCurso] = useState({
        nombre: "",
        ciclo: "",                  // 🔹 ya no hardcodeamos CICLO_2026
        descripcion: "",
        edad_min: "",
        edad_max: "",
        imagen_url: "",
        precio_curso: "",
        precio_inscripcion: "",
    });

    const [cursoEditando, setCursoEditando] = useState(null); // para el modal

    const SEDES = [
        { id: "Fisherton", label: "Sede Fisherton" },
        { id: "Mendoza", label: "Sede Mendoza" },
    ];

    const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    // Cargar config
    useEffect(() => {
        fetch("/config.json")
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch(() => setMensaje("No pude cargar config.json"));
    }, []);

    const headers = () => ({
        apikey: config?.supabaseKey ?? "",
        Authorization: `Bearer ${config?.supabaseKey ?? ""}`,
        "Content-Type": "application/json",
    });

    // 🔹 Helper para mostrar nombre del ciclo usando la lista de ciclos
    const getCiclo = (codigo) => ciclos.find((c) => c.codigo === codigo);
    const getNombreCiclo = (codigo) => {
        const ciclo = getCiclo(codigo);
        return ciclo?.nombre_publico || codigo || "Sin ciclo";
    };
    const cicloEstaActivo = (codigo) => {
        const ciclo = getCiclo(codigo);
        return ciclo?.activo ?? true;
    };

    const ciclosOrdenados = [...ciclos].sort((a, b) => {
        const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
        const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
        if (ordenA !== ordenB) return ordenA - ordenB;
        return (a.nombre_publico || "").localeCompare(b.nombre_publico || "");
    });

  const cargarCursos = async () => {
    if (!config) return;
    setLoading(true);
    setMensaje("");
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?select=*&order=nombre.asc`,
        { headers: headers() }
      );
      const data = await res.json();
      setCursos(data);
    } catch (e) {
      console.error(e);
      setMensaje("Error al cargar cursos");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Cargar ciclos desde Supabase (sólo activos, por prolijidad)
  const cargarCiclos = async () => {
  if (!config) return;
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/ciclos?select=*`,
      { headers: headers() }
    );
    const data = await res.json();

    if (!res.ok) {
      console.error("Error al cargar ciclos:", data);
      setCiclos([]);
      return;
    }

    // ✅ ahora guardamos TODOS los ciclos, activos e inactivos
    setCiclos(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    setCiclos([]);
  }
};


  // Cuando tengo config, cargo cursos y ciclos
  useEffect(() => {
    if (config) {
      cargarCursos();
      cargarCiclos();
    }
  }, [config]);

    // Cuando llegan los ciclos, si el curso nuevo no tiene ciclo elegido, usar el primero ordenado
    useEffect(() => {
    if (ciclos.length === 0) return;
    const sorted = [...ciclos].sort((a, b) => {
      const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
      const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return (a.nombre_publico || "").localeCompare(b.nombre_publico || "");
    });

    setNuevoCurso((prev) => ({
      ...prev,
      ciclo: prev.ciclo || sorted[0].codigo,
    }));
  }, [ciclos]);

  const handleNuevoChange = (e) => {
    const { name, value } = e.target;
    setNuevoCurso((prev) => ({ ...prev, [name]: value }));
  };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !config) return;

        setSubiendoImagen(true);
        setErrorImagen("");

        try {
        const fileName = `${Date.now()}_${file.name}`.replace(/\s+/g, "_");

        const res = await fetch(
            `${config.supabaseUrl}/storage/v1/object/cursos/${fileName}`,
            {
            method: "POST",
            headers: {
                apikey: config.supabaseKey,
                Authorization: `Bearer ${config.supabaseKey}`,
                "x-upsert": "true",
                "Content-Type": file.type,
            },
            body: file,
            }
        );

        if (!res.ok) {
            const txt = await res.text();
            console.error("Error subiendo imagen:", txt);
            setErrorImagen("No pude subir la imagen.");
            return;
        }

        // URL pública
        const publicUrl = `${config.supabaseUrl}/storage/v1/object/public/cursos/${fileName}`;

        setNuevoCurso((prev) => ({
            ...prev,
            imagen_url: publicUrl,
        }));
        } catch (err) {
        console.error(err);
        setErrorImagen("Error de red al subir la imagen.");
        } finally {
        setSubiendoImagen(false);
        }
    };

    const handleFileChangeEdit = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !config || !cursoEditando) return;

        setSubiendoImagenEdit(true);
        setErrorImagenEdit("");

        try {
            const fileName = `${Date.now()}_${file.name}`.replace(/\s+/g, "_");

            const res = await fetch(
            `${config.supabaseUrl}/storage/v1/object/cursos/${fileName}`,
            {
                method: "POST",
                headers: {
                apikey: config.supabaseKey,
                Authorization: `Bearer ${config.supabaseKey}`,
                "x-upsert": "true",
                "Content-Type": file.type,
                },
                body: file,
            }
            );

            if (!res.ok) {
            const txt = await res.text();
            console.error("Error subiendo imagen (edit):", txt);
            setErrorImagenEdit("No pude subir la nueva imagen.");
            return;
            }

            const publicUrl = `${config.supabaseUrl}/storage/v1/object/public/cursos/${fileName}`;

            // Actualizamos sólo la imagen del curso que se está editando
            setCursoEditando((prev) =>
            prev ? { ...prev, imagen_url: publicUrl } : prev
            );
        } catch (err) {
            console.error(err);
            setErrorImagenEdit("Error de red al subir la nueva imagen.");
        } finally {
            setSubiendoImagenEdit(false);
        }
    };




  const tieneHorarios = (turnos) => {
    if (!turnos || typeof turnos !== "object") return false;
    return Object.values(turnos).some((dias) => {
      if (!dias || typeof dias !== "object") return false;
      return Object.values(dias).some(
        (horarios) => Array.isArray(horarios) && horarios.some((h) => h?.trim())
      );
    });
  };

  const crearCurso = async (e) => {
    e.preventDefault();
    if (!config) return;

    const precioCursoValido =
      nuevoCurso.precio_curso && parseFloat(nuevoCurso.precio_curso) > 0;
    const precioInscripcionValido =
      nuevoCurso.precio_inscripcion &&
      parseFloat(nuevoCurso.precio_inscripcion) > 0;

    if (!precioCursoValido || !precioInscripcionValido) {
      setMensaje("Completá precios de cuota e inscripción con valores mayores a 0.");
      return;
    }

    if (!tieneHorarios(turnosConfig)) {
      setMensaje("Agregá al menos un horario en alguna sede antes de crear el curso.");
      return;
    }

    if (!cicloEstaActivo(nuevoCurso.ciclo)) {
      setMensaje("El ciclo seleccionado está inactivo. Elegí un ciclo activo para crear cursos.");
      return;
    }

    setCreando(true);
    setMensaje("Guardando curso...");
    try {
      const body = {
        nombre: nuevoCurso.nombre,
        ciclo: nuevoCurso.ciclo || null,
        descripcion: nuevoCurso.descripcion || null,
        edad_min: nuevoCurso.edad_min ? parseInt(nuevoCurso.edad_min) : null,
        edad_max: nuevoCurso.edad_max ? parseInt(nuevoCurso.edad_max) : null,
        imagen_url: nuevoCurso.imagen_url || null,
        precio_curso: parseFloat(nuevoCurso.precio_curso),
        precio_inscripcion: parseFloat(nuevoCurso.precio_inscripcion),
        turnos_config: turnosConfig,
        activo: true,
      };

      await fetch(`${config.supabaseUrl}/rest/v1/cursos`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });

      setMensaje("Curso creado ✅");
      setNuevoCurso({
        nombre: "",
        ciclo: ciclosOrdenados[0]?.codigo || "",   // reset al primero disponible
        descripcion: "",
        edad_min: "",
        edad_max: "",
        imagen_url: "",
        precio_curso: "",
        precio_inscripcion: "",
      });
      setSedesSeleccionadas({});
      setTurnosConfig({});
      setNuevoHorario({});
      cargarCursos();
    } catch (e) {
      console.error(e);
      setMensaje("No se pudo crear el curso");
    } finally {
      setCreando(false);
    }
  };

  const actualizarCurso = async (id, cambios) => {
    if (!config) return;
    setMensaje("Actualizando...");
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/cursos?id=eq.${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(cambios),
      });
      setMensaje("Curso actualizado ✅");
      await cargarCursos();
    } catch (e) {
      console.error(e);
      setMensaje("No se pudo actualizar");
    }
  };

  const toggleActivo = (curso) => {
    actualizarCurso(curso.id, { activo: !curso.activo });
  };

  const handleEliminarCurso = async (curso) => {
    if (!window.confirm(`¿Seguro que querés eliminar el curso "${curso.nombre}"?`)) {
      return;
    }

    if (!config) {
      setMensaje("No pude cargar config.json");
      return;
    }

    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/cursos?id=eq.${curso.id}`,
        {
          method: "DELETE",
          headers: headers(),
        }
      );

      if (!res.ok) {
        const error = await res.text();
        console.error("Error al eliminar curso:", error);
        setMensaje("❌ No se pudo eliminar: " + error);
        return;
      }

      setMensaje("Curso eliminado correctamente");
      cargarCursos();
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error eliminando el curso");
    }
  };

  const duplicarCurso = async (curso) => {
    if (!config) {
      setMensaje("No pude cargar config.json");
      return;
    }

    if (!cicloEstaActivo(curso.ciclo)) {
      setMensaje("No se puede duplicar un curso en un ciclo inactivo. Elegí un ciclo activo.");
      return;
    }

    if (!tieneHorarios(curso.turnos_config)) {
      setMensaje("Agregá turnos antes de duplicar este curso.");
      return;
    }

    setMensaje("Duplicando curso...");
    try {
      const body = {
        nombre: `${curso.nombre} (copia)`,
        ciclo: curso.ciclo,
        descripcion: curso.descripcion || null,
        edad_min: curso.edad_min ?? null,
        edad_max: curso.edad_max ?? null,
        imagen_url: curso.imagen_url || null,
        precio_curso: curso.precio_curso ?? null,
        precio_inscripcion: curso.precio_inscripcion ?? null,
        turnos_config: curso.turnos_config || null,
        activo: true,
      };

      const res = await fetch(`${config.supabaseUrl}/rest/v1/cursos`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Error al duplicar curso:", error);
        setMensaje("❌ No se pudo duplicar el curso: " + error);
        return;
      }

      setMensaje("Curso duplicado correctamente ✅");
      await cargarCursos();
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error duplicando el curso");
    }
  };


  const abrirModalEdicion = (curso) => {
    const turnos = curso.turnos_config || {};

    setCursoEditando({
      ...curso,
      edad_min: curso.edad_min ?? "",
      edad_max: curso.edad_max ?? "",
      descripcion: curso.descripcion ?? "",
      imagen_url: curso.imagen_url ?? "",
      precio_curso: curso.precio_curso ?? "",
      precio_inscripcion: curso.precio_inscripcion ?? "",
    });

    // Pre-cargar sedes y turnos para edición
    const sedesIniciales = Object.keys(turnos).reduce((acc, sede) => {
      acc[sede] = true;
      return acc;
    }, {});

    setEditSedesSeleccionadas(sedesIniciales);
    setEditTurnosConfig(turnos);
    setEditNuevoHorario({});
  };

  const cerrarModalEdicion = () => {
    setCursoEditando(null);
    setEditSedesSeleccionadas({});
    setEditTurnosConfig({});
    setEditNuevoHorario({});
  };

  const handleEditarChange = (e) => {
    const { name, value } = e.target;
    setCursoEditando((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!cursoEditando) return;

    const precioCursoValido =
      cursoEditando.precio_curso && parseFloat(cursoEditando.precio_curso) > 0;
    const precioInscripcionValido =
      cursoEditando.precio_inscripcion &&
      parseFloat(cursoEditando.precio_inscripcion) > 0;

    if (!precioCursoValido || !precioInscripcionValido) {
      setMensaje("Completá precios de cuota e inscripción con valores mayores a 0.");
      return;
    }

    if (!tieneHorarios(editTurnosConfig)) {
      setMensaje("Agregá al menos un horario en alguna sede antes de guardar.");
      return;
    }

    if (!cicloEstaActivo(cursoEditando.ciclo)) {
      setMensaje("No podés mover/guardar el curso en un ciclo inactivo.");
      return;
    }

    const cambios = {
      nombre: cursoEditando.nombre,
      ciclo: cursoEditando.ciclo || null,
      descripcion: cursoEditando.descripcion || null,
      edad_min: cursoEditando.edad_min ? parseInt(cursoEditando.edad_min) : null,
      edad_max: cursoEditando.edad_max ? parseInt(cursoEditando.edad_max) : null,
      imagen_url: cursoEditando.imagen_url || null,
      precio_curso: parseFloat(cursoEditando.precio_curso),
      precio_inscripcion: parseFloat(cursoEditando.precio_inscripcion),
      turnos_config: editTurnosConfig,
    };

    setGuardando(true);
    try {
      await actualizarCurso(cursoEditando.id, cambios);
      cerrarModalEdicion();
    } finally {
      setGuardando(false);
    }
  };

  const cursosFiltrados = cursos.filter((c) => {
    if (filtroCiclo !== "TODOS" && c.ciclo !== filtroCiclo) return false;
    if (soloActivos && !c.activo) return false;
    return true;
  });

  const toggleSede = (sedeId) => {
    setSedesSeleccionadas((prev) => {
      const next = { ...prev, [sedeId]: !prev[sedeId] };
      return next;
    });

    // inicializar estructura de turnos para esa sede si no existe
    setTurnosConfig((prev) => {
      if (!prev[sedeId]) {
        return { ...prev, [sedeId]: {} };
      }
      return prev;
    });
  };

  const toggleDia = (sedeId, dia) => {
    setTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia];

      // si no existía el día, lo creamos con array vacío
      if (!horariosDia) {
        return {
          ...prev,
          [sedeId]: {
            ...sede,
            [dia]: [],
          },
        };
      }

      // si ya existía, lo sacamos (desmarcar día)
      const { [dia]: _, ...restoDias } = sede;
      return {
        ...prev,
        [sedeId]: restoDias,
      };
    });
  };

  // --- Handlers de edición de turnos (modal) ---
  const toggleSedeEdit = (sedeId) => {
    setEditSedesSeleccionadas((prev) => {
      const next = { ...prev, [sedeId]: !prev[sedeId] };

      setEditTurnosConfig((prevTurnos) => {
        // si se desmarca la sede, se borran sus días
        if (!next[sedeId]) {
          const { [sedeId]: _, ...resto } = prevTurnos;
          return resto;
        }
        // si se marca y no existía, se crea vacía
        if (!prevTurnos[sedeId]) {
          return { ...prevTurnos, [sedeId]: {} };
        }
        return prevTurnos;
      });

      return next;
    });
  };

  const toggleDiaEdit = (sedeId, dia) => {
    setEditTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia];

      if (!horariosDia) {
        // crear día vacío
        return {
          ...prev,
          [sedeId]: {
            ...sede,
            [dia]: [],
          },
        };
      }

      // quitar día
      const { [dia]: _, ...restoDias } = sede;
      return {
        ...prev,
        [sedeId]: restoDias,
      };
    });
  };

  const handleEditNuevoHorarioChange = (sedeId, dia, valor) => {
    setEditNuevoHorario((prev) => ({
      ...prev,
      [sedeId]: {
        ...(prev[sedeId] || {}),
        [dia]: valor,
      },
    }));
  };

  const agregarHorarioEdit = (sedeId, dia) => {
    const valor = editNuevoHorario[sedeId]?.[dia];
    if (!valor || !valor.trim()) return;

    setEditTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia] || [];
      return {
        ...prev,
        [sedeId]: {
          ...sede,
          [dia]: [...horariosDia, valor.trim()],
        },
      };
    });

    setEditNuevoHorario((prev) => ({
      ...prev,
      [sedeId]: { ...(prev[sedeId] || {}), [dia]: "" },
    }));
  };

  const eliminarHorarioEdit = (sedeId, dia, idx) => {
    setEditTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia] || [];
      return {
        ...prev,
        [sedeId]: {
          ...sede,
          [dia]: horariosDia.filter((_, i) => i !== idx),
        },
      };
    });
  };

  const handleNuevoHorarioChange = (sedeId, dia, valor) => {
    setNuevoHorario((prev) => ({
      ...prev,
      [sedeId]: {
        ...(prev[sedeId] || {}),
        [dia]: valor,
      },
    }));
  };

  const agregarHorario = (sedeId, dia) => {
    const valor = nuevoHorario[sedeId]?.[dia];
    if (!valor || !valor.trim()) return;

    setTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia] || [];
      return {
        ...prev,
        [sedeId]: {
          ...sede,
          [dia]: [...horariosDia, valor.trim()],
        },
      };
    });

    // limpiar input
    setNuevoHorario((prev) => ({
      ...prev,
      [sedeId]: { ...(prev[sedeId] || {}), [dia]: "" },
    }));
  };

  const eliminarHorario = (sedeId, dia, idx) => {
    setTurnosConfig((prev) => {
      const sede = prev[sedeId] || {};
      const horariosDia = sede[dia] || [];
      return {
        ...prev,
        [sedeId]: {
          ...sede,
          [dia]: horariosDia.filter((_, i) => i !== idx),
        },
      };
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
        <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-center flex-1">
            Gestión de Cursos
        </h1>
        <Link
            to="/menu-gestion"
            className="ml-4 inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-200"
        >
            Volver
        </Link>
        </div>

        {mensaje && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {mensaje}
          </div>
        )}


      {/* Formulario para nuevo curso */}
      <form
        id="formCrearCurso"
        onSubmit={crearCurso}
        className="bg-white shadow rounded-xl p-4 mb-8 space-y-4"
      >
        <h2 className="font-semibold text-lg mb-2">Crear nuevo curso</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre del curso
            </label>
            <input
              type="text"
              name="nombre"
              value={nuevoCurso.nombre}
              onChange={handleNuevoChange}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ciclo</label>
            <select
              name="ciclo"
              value={nuevoCurso.ciclo}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            >
              {ciclosOrdenados.length === 0 ? (
                <option value="">No hay ciclos disponibles</option>
              ) : (
                ciclosOrdenados.map((c) => (
                  <option key={c.id} value={c.codigo}>
                    {c.nombre_publico} {c.activo ? "" : "(inactivo)"}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Edad mínima (opcional)
            </label>
            <input
              type="number"
              name="edad_min"
              value={nuevoCurso.edad_min}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Edad máxima (opcional)
            </label>
            <input
              type="number"
              name="edad_max"
              value={nuevoCurso.edad_max}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Precio del curso */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Precio del curso (mensual)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="precio_curso"
              value={nuevoCurso.precio_curso}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Ej: 25000"
            />
          </div>

          {/* Precio de inscripción */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Precio de inscripción
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="precio_inscripcion"
              value={nuevoCurso.precio_inscripcion}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Ej: 15000"
            />
          </div>

          {/* Imagen del curso */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Imagen del curso
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 mb-2"
            />

            {subiendoImagen && (
              <p className="text-xs text-gray-500">Subiendo imagen...</p>
            )}
            {errorImagen && (
              <p className="text-xs text-red-500">{errorImagen}</p>
            )}

            {nuevoCurso.imagen_url && (
              <div className="mt-2">
                <span className="block text-xs text-gray-500 mb-1">
                  Vista previa:
                </span>
                <img
                  src={nuevoCurso.imagen_url}
                  alt="Previsualización curso"
                  className="h-20 rounded-lg border object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Descripción (opcional)
            </label>
            <textarea
              name="descripcion"
              value={nuevoCurso.descripcion}
              onChange={handleNuevoChange}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Sedes, días y horarios */}
          <div className="md:col-span-2 border-t pt-4 mt-2 space-y-3">
            <h3 className="font-semibold text-sm">Sedes, días y horarios</h3>

            {/* Sedes */}
            <div className="flex items-center gap-6 mb-2 whitespace-nowrap">
              {SEDES.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={!!sedesSeleccionadas[s.id]}
                    onChange={() => toggleSede(s.id)}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>

            {/* Para cada sede seleccionada, días y horarios */}
            {SEDES.filter((s) => sedesSeleccionadas[s.id]).map((s) => (
              <div key={s.id} className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">{s.label}</p>

                {/* Días */}
                <div className="flex flex-wrap gap-3">
                  {DIAS.map((dia) => {
                    const diaActivo =
                      !!turnosConfig[s.id] && !!turnosConfig[s.id][dia];
                    return (
                      <label
                        key={dia}
                        className="inline-flex items-center gap-1 text-xs md:text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={diaActivo}
                          onChange={() => toggleDia(s.id, dia)}
                        />
                        <span>{dia}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Horarios por día activo */}
                {turnosConfig[s.id] &&
                  Object.entries(turnosConfig[s.id]).map(([dia, horarios]) => (
                    <div key={dia} className="mt-2 pl-2 border-l space-y-1">
                      <p className="text-xs font-semibold mb-1">{dia}</p>

                      {/* Lista de horarios */}
                      <div className="flex flex-wrap gap-2 mb-1">
                        {horarios.length > 0 ? (
                          horarios.map((h, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5"
                            >
                              {h}
                              <button
                                type="button"
                                onClick={() => eliminarHorario(s.id, dia, idx)}
                                className="text-red-500 hover:text-red-700 hover:bg-gray-100"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">
                            Sin horarios aún
                          </span>
                        )}
                      </div>

                      {/* Agregar horario */}
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={nuevoHorario[s.id]?.[dia] || ""}
                          onChange={(e) =>
                            handleNuevoHorarioChange(s.id, dia, e.target.value)
                          }
                          className="border rounded px-2 py-1 text-xs w-28"
                        />
                        <button
                          type="button"
                          onClick={() => agregarHorario(s.id, dia)}
                          className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center gap-3 mt-4">
          {/* Crear curso */}
          <button
            type="submit"
            form="formCrearCurso"
              className="
                inline-flex items-center justify-center
                bg-green-500 text-white font-semibold 
                px-4 py-2 rounded-md shadow-sm
                hover:bg-green-600 hover:shadow-md
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                active:scale-[0.97]
                text-sm
                w-auto
              "
            disabled={creando}
            >
            {creando ? "Guardando..." : "Crear curso"}
          </button>

        </div>
      </form>

      {/* Lista de cursos */}
      <div className="bg-whiteshadow rounded-xl p-4 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <h2 className="font-semibold text-lg">Cursos existentes</h2>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-600">Ciclo:</span>
              <select
                value={filtroCiclo}
                onChange={(e) => setFiltroCiclo(e.target.value)}
                className="border rounded px-2 py-1 text-xs md:text-sm"
              >
                <option value="TODOS">Todos</option>
                {ciclosOrdenados.map((c) => (
                  <option key={c.id} value={c.codigo}>
                    {c.nombre_publico}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              <span className="text-gray-600">Sólo activos</span>
            </label>

            {loading && (
              <span className="text-xs text-gray-500">Cargando...</span>
            )}
          </div>
        </div>

        {cursosFiltrados.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">
            No hay cursos que coincidan con los filtros.
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {cursosFiltrados.map((c) => (
              <div
                key={c.id}
                className="bg-white border rounded-xl p-3 shadow-sm flex gap-3 items-start"
              >
                {/* Imagen */}
                {c.imagen_url ? (
                  <img
                    src={c.imagen_url}
                    alt={c.nombre}
                    className="w-24 h-24 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg border flex items-center justify-center text-xs text-gray-400">
                    Sin imagen
                  </div>
                )}

                {/* Contenido a la derecha */}
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-semibold text-sm">{c.nombre}</h3>

                      {/* Ciclo + edades */}
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100">
                          {getNombreCiclo(c.ciclo)}
                        </span>
                        {!cicloEstaActivo(c.ciclo) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Ciclo inactivo
                          </span>
                        )}

                        {c.edad_min || c.edad_max ? (
                          <span>
                            {c.edad_min || "?"}–{c.edad_max || "?"} años
                          </span>
                        ) : (
                          <span>Sin límite de edad</span>
                        )}
                      </div>
                    </div>

                    {/* Precios */}
                    <div className="text-right text-xs text-gray-700">
                      {c.precio_curso != null && (
                        <p>
                          <span className="font-semibold">Cuota mensual:</span>{" "}
                          ${Number(c.precio_curso).toLocaleString("es-AR")}
                        </p>
                      )}
                      {c.precio_inscripcion != null && (
                        <p>
                          <span className="font-semibold">Inscripción:</span>{" "}
                          ${Number(c.precio_inscripcion).toLocaleString("es-AR")}
                        </p>
                      )}
                      {!c.precio_curso && (
                        <p className="text-red-600">Cuota sin definir</p>
                      )}
                      {!c.precio_inscripcion && (
                        <p className="text-red-600">Inscripción sin definir</p>
                      )}
                    </div>
                  </div>

                  {/* Descripción */}
                  {c.descripcion && (
                    <p className="text-xs text-gray-600 mt-1">{c.descripcion}</p>
                  )}

                  {/* RESUMEN DE TURNOS (visual) */}
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">
                      Turnos:
                    </p>
                    <TurnosResumen turnos={c.turnos_config} />
                    {!tieneHorarios(c.turnos_config) && (
                      <p className="text-xs text-red-600 mt-1">
                        Este curso no tiene horarios cargados.
                      </p>
                    )}
                  </div>

                  {/* Estado + Acciones */}
                  <div className="flex items-center justify-between mt-2">
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.activo}
                        onChange={() => toggleActivo(c)}
                      />
                      <span>{c.activo ? "Habilitado" : "Deshabilitado"}</span>
                    </label>

                      <div className="flex items-center gap-2 text-xs">
                            <button
                            onClick={() => abrirModalEdicion(c)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-white"
                            >
                            Editar
                            </button>

                            <button
                            onClick={() => duplicarCurso(c)}
                            className="text-gray-600 hover:text-gray-800 hover:bg-white"
                            >
                            Duplicar
                            </button>

                            <button
                            onClick={() => handleEliminarCurso(c)}
                            className="text-red-600 hover:text-red-800 hover:bg-white"
                            >
                            Eliminar
                            </button>
                        </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal edición curso */}
      {cursoEditando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-3">
              Editar curso: {cursoEditando.nombre}
            </h3>

            <form onSubmit={guardarEdicion} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre del curso
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={cursoEditando.nombre}
                  onChange={handleEditarChange}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ciclo</label>
                <select
                  name="ciclo"
                  value={cursoEditando.ciclo}
                  onChange={handleEditarChange}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                >
                  {ciclosOrdenados.length === 0 ? (
                    <option value="">No hay ciclos disponibles</option>
                  ) : (
                    ciclosOrdenados.map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.nombre_publico} {c.activo ? "" : "(inactivo)"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Edad mínima
                  </label>
                  <input
                    type="number"
                    name="edad_min"
                    value={cursoEditando.edad_min}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Edad máxima
                  </label>
                  <input
                    type="number"
                    name="edad_max"
                    value={cursoEditando.edad_max}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Precios */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium mb-1">
                    Precio del curso (mensual)
                    </label>
                    <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="precio_curso"
                    value={cursoEditando.precio_curso ?? ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: 25000"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                    Precio de inscripción
                    </label>
                    <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="precio_inscripcion"
                    value={cursoEditando.precio_inscripcion ?? ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: 15000"
                    />
                </div>
            </div>


              <div>
                <label className="block text-sm font-medium mb-1">
                    Imagen del curso
                </label>

                {/* Subir nueva imagen */}
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChangeEdit}
                    className="block w-full text-sm text-gray-700 mb-2"
                />

                {subiendoImagenEdit && (
                    <p className="text-xs text-gray-500">Subiendo nueva imagen...</p>
                )}
                {errorImagenEdit && (
                    <p className="text-xs text-red-500">{errorImagenEdit}</p>
                )}

                {/* Info de la imagen actual */}
                {cursoEditando.imagen_url && (
                    <div className="mt-2">
                    <span className="block text-xs text-gray-500 mb-1">
                        Imagen actual:{" "}
                        <span className="font-semibold">
                        {cursoEditando.imagen_url.split("/").pop()}
                        </span>
                    </span>
                    <img
                        src={cursoEditando.imagen_url}
                        alt="Imagen actual del curso"
                        className="h-20 rounded-lg border object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    </div>
                )}
                </div>


              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={cursoEditando.descripcion}
                  onChange={handleEditarChange}
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Sedes, días y horarios en edición */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <h4 className="text-sm font-semibold">Sedes, días y horarios</h4>

                {/* Sedes */}
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  {SEDES.map((s) => (
                    <label
                      key={s.id}
                      className="inline-flex items-center gap-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!editSedesSeleccionadas[s.id]}
                        onChange={() => toggleSedeEdit(s.id)}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>

                {/* Para cada sede */}
                {SEDES.filter((s) => editSedesSeleccionadas[s.id]).map((s) => (
                  <div key={s.id} className="border rounded-lg p-2 space-y-1">
                    <p className="text-xs font-semibold">{s.label}</p>

                    {/* Días */}
                    <div className="flex flex-wrap gap-3">
                      {DIAS.map((dia) => {
                        const diaActivo =
                          !!editTurnosConfig[s.id] &&
                          !!editTurnosConfig[s.id][dia];
                        return (
                          <label
                            key={dia}
                            className="inline-flex items-center gap-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={diaActivo}
                              onChange={() => toggleDiaEdit(s.id, dia)}
                            />
                            <span>{dia}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Horarios */}
                    {editTurnosConfig[s.id] &&
                      Object.entries(editTurnosConfig[s.id]).map(
                        ([dia, horarios]) => (
                          <div key={dia} className="pl-2 border-l space-y-1 mt-1">
                            <p className="text-[11px] font-semibold">{dia}</p>

                            <div className="flex flex-wrap gap-2">
                              {horarios.map((h, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center bg-gray-100 px-2 py-0.5 rounded-full text-[11px]"
                                >
                                  {h}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      eliminarHorarioEdit(s.id, dia, idx)
                                    }
                                    className="text-red-500 ml-1 hover:bg-gray-100"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={editNuevoHorario[s.id]?.[dia] || ""}
                                onChange={(e) =>
                                  handleEditNuevoHorarioChange(
                                    s.id,
                                    dia,
                                    e.target.value
                                  )
                                }
                                className="border rounded px-2 py-1 text-[11px] w-24"
                              />
                              <button
                                type="button"
                                onClick={() => agregarHorarioEdit(s.id, dia)}
                                className="text-[11px] bg-blue-500 text-white px-2 py-1 rounded"
                              >
                                Agregar
                              </button>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={cerrarModalEdicion}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
