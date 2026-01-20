import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Estructura base de un ciclo nuevo
const cicloInicial = {
  codigo: "",
  nombre_publico: "",
  descripcion: "",
  fecha_inicio: "",
  fecha_inicio_ciclo: "",
  fecha_fin: "",
  orden: "",
  activo: true,
};

// Helper para mostrar fecha como dd-mm-aaaa SIN usar new Date
function formatearFecha(fecha) {
  if (!fecha) return "";

  // Nos quedamos sólo con la parte de fecha por si viene con "T..."
  const soloFecha = fecha.split("T")[0];
  const [anio, mes, dia] = soloFecha.split("-");

  // Si por algún motivo no viene en formato esperado, devolvemos tal cual
  if (!anio || !mes || !dia) return fecha;

  return `${dia}-${mes}-${anio}`;
}

export default function GestorCiclos() {
  const [config, setConfig] = useState(null);
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const [nuevoCiclo, setNuevoCiclo] = useState(cicloInicial);
  const [cicloEditando, setCicloEditando] = useState(null);

  const ciclosOrdenados = useMemo(() => {
    return [...ciclos].sort((a, b) => {
      const ordenA = a.orden ?? 9999;
      const ordenB = b.orden ?? 9999;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return (a.nombre_publico || "").localeCompare(b.nombre_publico || "");
    });
  }, [ciclos]);

  // Cargar config.json
  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setMensaje("No pude cargar config.json"));
  }, []);

  const headers = useCallback(
    () => ({
      apikey: config?.supabaseKey ?? "",
      Authorization: `Bearer ${config?.supabaseKey ?? ""}`,
      "Content-Type": "application/json",
    }),
    [config?.supabaseKey]
  );

  // Cargar ciclos desde Supabase
  const cargarCiclos = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setMensaje("");
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?select=*`,
        { headers: headers() }
      );
      const data = await res.json();

      if (!res.ok) {
        console.error("Error al cargar ciclos:", data);
        setMensaje("No se pudo cargar ciclos");
        setCiclos([]);
        return;
      }

      setCiclos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMensaje("Error al cargar ciclos");
      setCiclos([]);
    } finally {
      setLoading(false);
    }
  }, [config, headers]);


  useEffect(() => {
    if (config) cargarCiclos();
  }, [config, cargarCiclos]);

  // Handlers formulario nuevo ciclo
    const handleNuevoChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
        // ✅ copiamos todo lo anterior y solo pisamos ese campo
        setNuevoCiclo((prev) => ({ 
        ...prev,
        [name]: checked,
        }));
    } else {
        setNuevoCiclo((prev) => ({
        ...prev,
        [name]: name === "codigo" ? value.toUpperCase() : value,
        }));
    }
    };


  // Crear ciclo
  const crearCiclo = async (e) => {
    e.preventDefault();
    if (!config) {
      setMensaje("No pude cargar config.json");
      return;
    }

    if (!nuevoCiclo.codigo.trim() || !nuevoCiclo.nombre_publico.trim()) {
      setMensaje("Completá código y nombre público");
      return;
    }

    const inicio = nuevoCiclo.fecha_inicio || nuevoCiclo.fecha_inicio_ciclo;
    const fin = nuevoCiclo.fecha_fin;
    if (inicio && fin && new Date(inicio) > new Date(fin)) {
      setMensaje("La fecha de inicio no puede ser mayor a la fecha fin");
      return;
    }

    const body = {
      codigo: nuevoCiclo.codigo.trim(),
      nombre_publico: nuevoCiclo.nombre_publico.trim(),
      descripcion: nuevoCiclo.descripcion || null,
      fecha_inicio: nuevoCiclo.fecha_inicio || null,
      fecha_inicio_ciclo: nuevoCiclo.fecha_inicio_ciclo || null,
      fecha_fin: nuevoCiclo.fecha_fin || null,
      orden: nuevoCiclo.orden ? parseInt(nuevoCiclo.orden, 10) : null,
      activo: nuevoCiclo.activo,
    };

    try {
      setGuardando(true);
      setMensaje("Creando ciclo...");
      const res = await fetch(`${config.supabaseUrl}/rest/v1/ciclos`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error al crear ciclo:", txt);
        setMensaje("No se pudo crear el ciclo: " + txt);
        return;
      }

      setMensaje("Ciclo creado ✅");
      setNuevoCiclo(cicloInicial);
      await cargarCiclos();
    } catch (e) {
      console.error(e);
      setMensaje("Error al crear ciclo");
    } finally {
      setGuardando(false);
    }
  };

  // Abrir modal de edición
    const abrirModalEdicion = (c) => {
        setCicloEditando({
            ...c, // ✅ copiamos todo el ciclo original
            descripcion: c.descripcion ?? "",
            fecha_inicio: c.fecha_inicio ?? "",
            fecha_fin: c.fecha_fin ?? "",
            orden: c.orden != null ? String(c.orden) : "",
        });
    };


  const cerrarModalEdicion = () => {
    setCicloEditando(null);
  };

  const handleEditarChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (!cicloEditando) return;

    if (type === "checkbox") {
      setCicloEditando((prev) => ({ ...prev, [name]: checked }));
    } else {
      setCicloEditando((prev) => ({
        ...prev,
        [name]: name === "codigo" ? value.toUpperCase() : value,
      }));
    }
  };

  // Actualizar ciclo
  const actualizarCiclo = async (id, cambios) => {
    if (!config) return;
    setMensaje("Actualizando ciclo...");
    try {
      setGuardandoEdit(true);
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?id=eq.${id}`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify(cambios),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error al actualizar ciclo:", txt);
        setMensaje("No se pudo actualizar: " + txt);
        return;
      }

      setMensaje("Ciclo actualizado ✅");
      await cargarCiclos();
    } catch (e) {
      console.error(e);
      setMensaje("Error al actualizar ciclo");
    } finally {
      setGuardandoEdit(false);
    }
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!cicloEditando) return;

    if (!cicloEditando.codigo.trim() || !cicloEditando.nombre_publico.trim()) {
      setMensaje("Completá código y nombre público");
      return;
    }

    const inicio = cicloEditando.fecha_inicio || cicloEditando.fecha_inicio_ciclo;
    const fin = cicloEditando.fecha_fin;
    if (inicio && fin && new Date(inicio) > new Date(fin)) {
      setMensaje("La fecha de inicio no puede ser mayor a la fecha fin");
      return;
    }

    const cambios = {
      codigo: cicloEditando.codigo.trim(),
      nombre_publico: cicloEditando.nombre_publico.trim(),
      descripcion: cicloEditando.descripcion || null,
      fecha_inicio: cicloEditando.fecha_inicio || null,
      fecha_inicio_ciclo: cicloEditando.fecha_inicio_ciclo || null,
      fecha_fin: cicloEditando.fecha_fin || null,
      orden: cicloEditando.orden ? parseInt(cicloEditando.orden, 10) : null,
      activo: !!cicloEditando.activo,
    };

    await actualizarCiclo(cicloEditando.id, cambios);
    cerrarModalEdicion();
  };

  // Toggle activo
  const toggleActivo = async (ciclo) => {
    await actualizarCiclo(ciclo.id, { activo: !ciclo.activo });
  };

  // Eliminar ciclo
  const handleEliminarCiclo = async (ciclo) => {
    if (!window.confirm(`¿Seguro que querés eliminar el ciclo "${ciclo.nombre_publico}"?`)) {
      return;
    }
    if (!config) {
      setMensaje("No pude cargar config.json");
      return;
    }

    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/ciclos?id=eq.${ciclo.id}`,
        {
          method: "DELETE",
          headers: headers(),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error al eliminar ciclo:", txt);
        setMensaje("No se pudo eliminar: " + txt);
        return;
      }

      setMensaje("Ciclo eliminado ✅");
      await cargarCiclos();
    } catch (e) {
      console.error(e);
      setMensaje("Error al eliminar ciclo");
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-center flex-1">
          Gestor de Ciclos
        </h1>
        <Link
          to="/menu-gestion"
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-200"
        >
          Volver
        </Link>
      </div>

      {/* Formulario de nuevo ciclo */}
      <div className="bg-white rounded-xl shadow-md border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Crear nuevo ciclo</h2>
        <form onSubmit={crearCiclo} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Código (interno)
              </label>
              <input
                type="text"
                name="codigo"
                value={nuevoCiclo.codigo}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm uppercase"
                placeholder="Ej: CICLO_2026, TDV"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Nombre público
              </label>
              <input
                type="text"
                name="nombre_publico"
                value={nuevoCiclo.nombre_publico}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Ej: Ciclo lectivo 2026"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Descripción (opcional)
            </label>
            <textarea
              name="descripcion"
              value={nuevoCiclo.descripcion}
              onChange={handleNuevoChange}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Fechas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label className="block text-sm font-medium mb-1">
                Apertura de inscripción
                </label>
                <input
                type="date"
                name="fecha_inicio"
                value={nuevoCiclo.fecha_inicio}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">
                Inicio del ciclo
                </label>
                <input
                type="date"
                name="fecha_inicio_ciclo"
                value={nuevoCiclo.fecha_inicio_ciclo}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>
            </div>

            {/* Fecha fin + orden */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
                <label className="block text-sm font-medium mb-1">
                Fecha fin
                </label>
                <input
                type="date"
                name="fecha_fin"
                value={nuevoCiclo.fecha_fin}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">
                Orden (para listar)
                </label>
                <input
                type="number"
                name="orden"
                value={nuevoCiclo.orden}
                onChange={handleNuevoChange}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Ej: 1, 2, 3…"
                />
            </div>
        </div>


        <div className="flex items-center justify-end gap-4 mt-4">
            <label className="inline-flex items-center gap-2 text-sm mr-auto">
                <input
                type="checkbox"
                name="activo"
                checked={nuevoCiclo.activo}
                onChange={handleNuevoChange}
                />
                <span>Activo</span>
            </label>

            <button
                type="submit"
                disabled={guardando}
                className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {guardando ? "Creando..." : "Crear ciclo"}
            </button>
        </div>

        {mensaje && (
          <div className="text-sm px-3 py-2 rounded-lg border bg-yellow-50 text-yellow-800 mt-3">
            {mensaje}
          </div>
        )}

        </form>
      </div>

      {/* Lista de ciclos */}
      <div className="bg-white rounded-xl shadow-md border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Ciclos existentes</h2>
          {loading && (
            <span className="text-xs text-gray-500">Cargando...</span>
          )}
        </div>

        {ciclosOrdenados.length === 0 ? (
          <p className="text-sm text-gray-500">
            Todavía no hay ciclos cargados.
          </p>
        ) : (
          <div className="space-y-2">
            {ciclosOrdenados.map((c) => (
              <div
                key={c.id}
                className="border rounded-lg px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">
                      {c.nombre_publico}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100">
                      {c.codigo}
                    </span>
                    {c.activo ? (
                      <span className="text-[11px] text-green-600">
                        Activo
                      </span>
                    ) : (
                      <span className="text-[11px] text-red-500">
                        Inactivo
                      </span>
                    )}
                  </div>

                  {c.descripcion && (
                    <p className="text-xs text-gray-600 mt-1">
                      {c.descripcion}
                    </p>
                  )}

                    <p className="text-xs text-gray-600 mt-1">
                        {c.fecha_inicio || c.fecha_inicio_ciclo || c.fecha_fin ? (
                            <>
                            {c.fecha_inicio && (
                                <span className="block">
                                Apertura de inscripción: {formatearFecha(c.fecha_inicio)}
                                </span>
                            )}

                            {c.fecha_inicio_ciclo && (
                                <span className="block">
                                Inicio del ciclo: {formatearFecha(c.fecha_inicio_ciclo)}
                                </span>
                            )}

                            {c.fecha_fin && (
                                <span className="block">
                                Fin del ciclo: {formatearFecha(c.fecha_fin)}
                                </span>
                            )}
                            </>
                        ) : (
                            <span className="block">Sin fechas definidas</span>
                        )}

                        {c.orden != null && (
                            <span className="block">Orden: {c.orden}</span>
                        )}
                    </p>



                </div>

              <div className="flex flex-col items-end gap-2 text-xs">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.activo}
                    onChange={() => toggleActivo(c)}
                  />
                  <span>{c.activo ? "Habilitado" : "Deshabilitado"}</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModalEdicion(c)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarCiclo(c)}
                    className="text-red-600 hover:text-red-800 hover:bg-white" 
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal edición */}
      {cicloEditando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-3">
              Editar ciclo: {cicloEditando.nombre_publico}
            </h3>

            <form onSubmit={guardarEdicion} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    value={cicloEditando.codigo}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nombre público
                  </label>
                  <input
                    type="text"
                    name="nombre_publico"
                    value={cicloEditando.nombre_publico}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={cicloEditando.descripcion}
                  onChange={handleEditarChange}
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium mb-1">
                    Apertura de inscripción
                    </label>
                    <input
                    type="date"
                    name="fecha_inicio"
                    value={cicloEditando.fecha_inicio || ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                    Inicio del ciclo
                    </label>
                    <input
                    type="date"
                    name="fecha_inicio_ciclo"
                    value={cicloEditando.fecha_inicio_ciclo || ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                    <label className="block text-sm font-medium mb-1">
                    Fecha fin
                    </label>
                    <input
                    type="date"
                    name="fecha_fin"
                    value={cicloEditando.fecha_fin || ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Orden</label>
                    <input
                    type="number"
                    name="orden"
                    value={cicloEditando.orden ?? ""}
                    onChange={handleEditarChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                </div>


              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="activo"
                  checked={!!cicloEditando.activo}
                  onChange={handleEditarChange}
                />
                <span>Ciclo activo</span>
              </label>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={cerrarModalEdicion}
                  className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdit}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardandoEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
