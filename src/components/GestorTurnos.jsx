import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ordenarDias = (a, b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b);

const supaHeaders = (cfg, extra = {}) => ({
  apikey: cfg.supabaseKey,
  Authorization: `Bearer ${cfg.supabaseKey}`,
  ...extra,
});

export default function GestorTurnos() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [mensaje, setMensaje] = useState("");

  const [ciclos, setCiclos] = useState([]);
  const [cicloSel, setCicloSel] = useState("");

  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroSede, setFiltroSede] = useState("Todas");
  const [soloActivos, setSoloActivos] = useState(true);

  const [editCupo, setEditCupo] = useState({}); // {turnoId: valor}
  const [editActivo, setEditActivo] = useState({}); // {turnoId: boolean}
  const [bulkCupo, setBulkCupo] = useState(13);

  // 1) cargar config
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/config.json");
        const cfg = await res.json();
        setConfig(cfg);
      } catch (e) {
        console.error(e);
        setMensaje("❌ No se pudo cargar /config.json");
      }
    })();
  }, []);

  // 2) cargar ciclos
  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
          { headers: supaHeaders(config) }
        );
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setCiclos(lista);

        // default: primer ciclo activo, si no el primero
        const activo = lista.find((c) => c.activo) || lista[0] || null;
        setCicloSel(activo?.codigo || "");
      } catch (e) {
        console.error(e);
        setMensaje("❌ Error cargando ciclos.");
      }
    })();
  }, [config]);

  // 3) cargar turnos por ciclo
  const cargarTurnos = async () => {
    if (!config || !cicloSel) return;
    setLoading(true);
    setMensaje("");

    try {
      const params = new URLSearchParams();
      params.set("select", "id,ciclo_codigo,sede,dia,hora,cupo_maximo,activo,creado_en");
      params.append("ciclo_codigo", `eq.${cicloSel}`);
      if (soloActivos) params.append("activo", "eq.true");
      params.set("order", "sede.asc,dia.asc,hora.asc");

      const res = await fetch(`${config.supabaseUrl}/rest/v1/turnos?${params.toString()}`, {
        headers: supaHeaders(config),
      });
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];

      // orden estable: sede, día (orden humano), hora (string)
      lista.sort((x, y) => {
        const s = String(x.sede).localeCompare(String(y.sede));
        if (s !== 0) return s;
        const d = ordenarDias(String(x.dia), String(y.dia));
        if (d !== 0) return d;
        return String(x.hora).localeCompare(String(y.hora));
      });

      setTurnos(lista);
      setEditCupo({});
      setEditActivo({});
    } catch (e) {
      console.error(e);
      setMensaje("❌ Error cargando turnos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTurnos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, cicloSel, soloActivos]);

  const sedesDisponibles = useMemo(() => {
    const set = new Set(turnos.map((t) => t.sede).filter(Boolean));
    return ["Todas", ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))];
  }, [turnos]);
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => (filtroSede === "Todas" ? true : t.sede === filtroSede));
  }, [turnos, filtroSede]);

  const cambiosPendientes = useMemo(() => {
    const ids = new Set();
    turnos.forEach((t) => {
      if (Object.prototype.hasOwnProperty.call(editCupo, t.id)) ids.add(t.id);
      if (Object.prototype.hasOwnProperty.call(editActivo, t.id)) ids.add(t.id);
    });
    return Array.from(ids);
  }, [turnos, editCupo, editActivo]);

  const onChangeCupo = (id, val) => {
    setEditCupo((prev) => ({ ...prev, [id]: val }));
  };
  const toggleActivo = (turno) => {
    const actual = Object.prototype.hasOwnProperty.call(editActivo, turno.id)
      ? editActivo[turno.id]
      : turno.activo;
    setEditActivo((prev) => ({ ...prev, [turno.id]: !actual }));
  };


  
const activoActual = (turno) =>
  Object.prototype.hasOwnProperty.call(editActivo, turno.id)
    ? editActivo[turno.id]
    : turno.activo;

  const guardarCambios = async () => {
    if (!config) return;
    const cambios = [];

    for (const t of turnos) {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(editCupo, t.id)) {
        const raw = editCupo[t.id];
        const cupo = parseInt(raw, 10);
        if (!Number.isFinite(cupo) || cupo < 1) {
          setMensaje("Cupo invalido. Debe ser un numero >= 1.");
          return;
        }
        if (cupo !== t.cupo_maximo) patch.cupo_maximo = cupo;
      }
      if (Object.prototype.hasOwnProperty.call(editActivo, t.id)) {
        const nuevo = !!editActivo[t.id];
        if (nuevo !== t.activo) patch.activo = nuevo;
      }
      if (Object.keys(patch).length > 0) cambios.push({ id: t.id, patch });
    }

    if (cambios.length === 0) {
      setMensaje("No hay cambios para guardar.");
      setTimeout(() => setMensaje(""), 1200);
      return;
    }

    try {
      setMensaje("Guardando cambios...");
      for (const c of cambios) {
        const res = await fetch(`${config.supabaseUrl}/rest/v1/turnos?id=eq.${c.id}`, {
          method: "PATCH",
          headers: supaHeaders(config, {
            "Content-Type": "application/json",
            prefer: "return=representation",
          }),
          body: JSON.stringify(c.patch),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error(txt);
          setMensaje("No se pudieron guardar los cambios.");
          return;
        }
      }

      setTurnos((prev) =>
        prev.map((t) => {
          const cambio = cambios.find((c) => c.id === t.id);
          return cambio ? { ...t, ...cambio.patch } : t;
        })
      );
      setEditCupo({});
      setEditActivo({});
      setMensaje("Cambios guardados");
      setTimeout(() => setMensaje(""), 1200);
    } catch (e) {
      console.error(e);
      setMensaje(e.message || "Error guardando cambios.");
    }
  };
  const aplicarCupoATodos = async () => {
    if (!config || !cicloSel) return;
    const cupo = parseInt(bulkCupo, 10);
    if (!Number.isFinite(cupo) || cupo < 1) {
      setMensaje("Cupo invalido para aplicar masivo.");
      return;
    }

    try {
      setMensaje("Aplicando cupo a todos los turnos del ciclo...");
      const res = await fetch(`${config.supabaseUrl}/rest/v1/turnos?ciclo_codigo=eq.${cicloSel}`, {
        method: "PATCH",
        headers: supaHeaders(config, {
          "Content-Type": "application/json",
          prefer: "return=representation",
        }),
        body: JSON.stringify({ cupo_maximo: cupo }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(txt);
        setMensaje("No se pudo aplicar el cupo masivo.");
        return;
      }

      await cargarTurnos();
      setMensaje("Cupo aplicado a todos los turnos del ciclo");
      setTimeout(() => setMensaje(""), 1400);
    } catch (e) {
      console.error(e);
      setMensaje("Error en actualizacion masiva.");
    }
  };


  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gestor de Turnos</h2>
          <p className="text-sm text-gray-600">
            Cupo físico por turno compartido (sede + día + horario) dentro de cada ciclo.
          </p>
        </div>
        <button
          onClick={() => navigate("/menu-gestion")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>

        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-sm font-medium">Ciclo:</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={cicloSel}
            onChange={(e) => setCicloSel(e.target.value)}
          >
            {ciclos.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre_publico} ({c.codigo}){c.activo ? "" : " [inactivo]"}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium ml-2">Sede:</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
          >
            {sedesDisponibles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3 ml-2">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Solo activos</span>

            <button
                type="button"
                onClick={() => setSoloActivos((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                soloActivos ? "bg-green-600" : "bg-gray-300"
                }`}
                aria-pressed={soloActivos}
                aria-label="Toggle solo activos"
            >
                <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    soloActivos ? "translate-x-5" : "translate-x-1"
                }`}
                />
            </button>
            </div>

          <button
            type="button"
            onClick={guardarCambios}
            disabled={loading || cambiosPendientes.length === 0}
            className={`ml-2 px-3 py-2 rounded text-sm ${
              loading || cambiosPendientes.length === 0
                ? "bg-gray-200 text-gray-500 hover:bg-gray-200"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="mt-4 p-3 rounded border bg-white text-sm">{mensaje}</div>
      )}

      <div className="mt-6 p-4 rounded-lg border bg-white flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Aplicar cupo a todos los turnos del ciclo</div>
          <div className="text-xs text-gray-600">
            Útil para setear el valor inicial (después ajustás casos puntuales).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={bulkCupo}
            onChange={(e) => setBulkCupo(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-28"
          />
          <button
            type="button"
            onClick={aplicarCupoATodos}
            className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
          >
            Aplicar
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Sede</th>
              <th className="p-3">Dia</th>
              <th className="p-3">Horario</th>
              <th className="p-3">Cupo</th>
              <th className="p-3">Activo</th>
              <th className="p-3">Cambios</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4" colSpan={6}>
                  Cargando turnos...
                </td>
              </tr>
            ) : turnosFiltrados.length === 0 ? (
              <tr>
                <td className="p-4" colSpan={6}>
                  No hay turnos para este filtro/ciclo.
                </td>
              </tr>
            ) : (
              turnosFiltrados.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3">{t.sede}</td>
                  <td className="p-3">{t.dia}</td>
                  <td className="p-3">{t.hora}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="1"
                      className="border rounded px-2 py-1 w-24"
                      value={editCupo[t.id] ?? t.cupo_maximo ?? ""}
                      onChange={(e) => onChangeCupo(t.id, e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <button
                        type="button"
                        onClick={() => toggleActivo(t)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        activoActual(t) ? "bg-green-600" : "bg-gray-300"
                        }`}
                        aria-pressed={activoActual(t)}
                        aria-label="Toggle turno activo"
                        title={activoActual(t) ? "Turno activo" : "Turno inactivo"}
                    >
                        <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            activoActual(t) ? "translate-x-5" : "translate-x-1"
                        }`}
                        />
                    </button>
                    </td>

                  <td className="p-3">
                                        {(Object.prototype.hasOwnProperty.call(editCupo, t.id) ||
                      Object.prototype.hasOwnProperty.call(editActivo, t.id)) && (
                      <span className="text-xs text-amber-700">Pendiente</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-600">
        Nota: el cupo se aplica por turno físico compartido. El formulario calcula lista de espera
        contando matrículas activas del mismo ciclo + sede + día + horario (sin filtrar por curso).
      </div>
    </div>
  );
}













