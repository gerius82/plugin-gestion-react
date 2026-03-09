import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function toISODate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function endOfMonthISO(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseMonth(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, monthIndex: m - 1 };
}

function buildCalendar(ym) {
  const info = parseMonth(ym);
  if (!info) return [];
  const { year, monthIndex } = info;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Lun=0..Dom=6

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ empty: true, key: `e-${i}` });
  }
  for (let day = 1; day <= last; day += 1) {
    cells.push({
      empty: false,
      key: `d-${day}`,
      day,
      fecha: toISODate(year, monthIndex, day),
    });
  }
  return cells;
}

function formatearFecha(fechaISO) {
  const [y, m, d] = String(fechaISO || "").split("-");
  if (!y || !m || !d) return fechaISO || "";
  return `${d}-${m}-${y}`;
}

export default function GestorFeriados() {
  const [config, setConfig] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [feriadosMes, setFeriadosMes] = useState([]);
  const [feriadosTodos, setFeriadosTodos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const mesesDisponibles = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = -2; i <= 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return out;
  }, []);

  const headers = useMemo(() => {
    if (!config) return {};
    return {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };
  }, [config]);

  const diasCalendario = useMemo(() => buildCalendar(mesSeleccionado), [mesSeleccionado]);

  const feriadosPorFecha = useMemo(() => {
    const map = new Map();
    feriadosMes.forEach((f) => {
      const fecha = String(f.fecha || "").split("T")[0];
      if (fecha) map.set(fecha, f);
    });
    return map;
  }, [feriadosMes]);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No se pudo cargar config.json"));
  }, []);

  const cargarFeriadosMes = async () => {
    if (!config) return;
    const info = parseMonth(mesSeleccionado);
    if (!info) return;
    const { year, monthIndex } = info;
    const desde = toISODate(year, monthIndex, 1);
    const hasta = endOfMonthISO(year, monthIndex);
    setError("");
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/feriados?select=id,fecha,descripcion&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) {
        setError("No se pudieron cargar los feriados.");
        setFeriadosMes([]);
        return;
      }
      setFeriadosMes(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudieron cargar los feriados.");
      setFeriadosMes([]);
    }
  };

  const cargarFeriadosTodos = async () => {
    if (!config) return;
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/feriados?select=id,fecha,descripcion&order=fecha.asc`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) {
        setError("No se pudieron cargar los feriados.");
        setFeriadosTodos([]);
        return;
      }
      setFeriadosTodos(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudieron cargar los feriados.");
      setFeriadosTodos([]);
    }
  };

  useEffect(() => {
    if (config) cargarFeriadosMes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, mesSeleccionado]);

  useEffect(() => {
    if (config) cargarFeriadosTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const seleccionarFecha = (fecha) => {
    setFechaSeleccionada(fecha);
    const existente = feriadosPorFecha.get(fecha);
    setDescripcion(existente?.descripcion || "");
  };

  const guardarFeriado = async () => {
    if (!config || !fechaSeleccionada) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const body = {
        fecha: fechaSeleccionada,
        descripcion: descripcion.trim() || null,
      };

      const res = await fetch(`${config.supabaseUrl}/rest/v1/feriados`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`No se pudo guardar (${res.status}): ${txt}`);
        return;
      }
      setMensaje("Feriado guardado.");
      await cargarFeriadosMes();
      await cargarFeriadosTodos();
    } catch {
      setError("No se pudo guardar el feriado.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarFeriado = async (id) => {
    if (!config || !id) return;
    setError("");
    setMensaje("");
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/feriados?id=eq.${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        setError("No se pudo eliminar el feriado.");
        return;
      }
      setMensaje("Feriado eliminado.");
      if (feriadosPorFecha.get(fechaSeleccionada)?.id === id) {
        setDescripcion("");
      }
      await cargarFeriadosMes();
      await cargarFeriadosTodos();
    } catch {
      setError("No se pudo eliminar el feriado.");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">Gestor de Feriados</h1>
        <Link
          to="/menu-gestion"
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-md max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-end mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Mes</label>
            <select
              value={mesSeleccionado}
              onChange={(e) => {
                setMesSeleccionado(e.target.value);
                setFechaSeleccionada("");
                setDescripcion("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {mesesDisponibles.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">
            Click en un dia para cargar o editar feriado.
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-sm font-semibold text-gray-600">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {diasCalendario.map((cell) =>
            cell.empty ? (
              <div key={cell.key} className="h-14 rounded-lg bg-transparent" />
            ) : (
              <button
                key={cell.key}
                type="button"
                onClick={() => seleccionarFecha(cell.fecha)}
                className={[
                  "h-14 rounded-lg border text-sm font-semibold transition",
                  fechaSeleccionada === cell.fecha
                    ? "border-teal-500 bg-teal-100 text-teal-900 hover:bg-teal-200"
                    : feriadosPorFecha.has(cell.fecha)
                    ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                    : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
                ].join(" ")}
                title={feriadosPorFecha.has(cell.fecha) ? "Dia marcado como feriado" : "Dia sin feriado"}
              >
                {cell.day}
              </button>
            )
          )}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            {fechaSeleccionada ? `Fecha seleccionada: ${formatearFecha(fechaSeleccionada)}` : "Selecciona un dia"}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Descripcion</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Feriado nacional / Carnaval / etc."
                disabled={!fechaSeleccionada}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardarFeriado}
              disabled={!fechaSeleccionada || guardando}
              className="rounded-lg bg-teal-600 px-4 py-2 text-white font-semibold hover:bg-teal-700 disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar feriado"}
            </button>
          </div>

          {mensaje && <p className="mt-3 text-sm font-medium text-green-700">{mensaje}</p>}
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </div>

        <div className="mt-5">
          <h2 className="text-lg font-bold mb-2">Todos los feriados cargados</h2>
          {feriadosTodos.length === 0 ? (
            <p className="text-sm text-gray-600">No hay feriados cargados.</p>
          ) : (
            <div className="space-y-2">
              {feriadosTodos.map((f) => (
                <div key={f.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center justify-between gap-2">
                  <div className="text-sm min-w-0 flex-1">
                    <span className="font-semibold">{formatearFecha(String(f.fecha).split("T")[0])}</span>
                    {" - "}
                    <span>{f.descripcion || "Sin descripcion"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarFeriado(f.id)}
                    className="inline-flex w-auto flex-none items-center justify-center rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
                    style={{ width: "auto" }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
