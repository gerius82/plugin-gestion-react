import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const normalizarDia = (valor = "") =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toIsoDate = (year, monthIndex, day) => {
  const d = new Date(year, monthIndex, day, 12, 0, 0);
  return d.toISOString().slice(0, 10);
};

const formatFecha = (iso) => {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export default function FichaControlTomaAsistencia() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [filtroCiclo, setFiltroCiclo] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  });
  const [turnos, setTurnos] = useState([]);
  const [asistenciasMap, setAsistenciasMap] = useState(new Map());
  const [feriadosSet, setFeriadosSet] = useState(new Set());

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg));
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
      if (!filtroCiclo && lista.length > 0) {
        const ciclo2026 = lista.find((c) => c.codigo === "CICLO_2026");
        const activo = lista.find((c) => c.activo);
        setFiltroCiclo((ciclo2026 || activo || lista[0]).codigo);
      }
    })();
  }, [config, filtroCiclo]);

  useEffect(() => {
    if (!config || !filtroCiclo || !mesSeleccionado) return;
    (async () => {
      const headers = {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      };
      const [year, month] = mesSeleccionado.split("-").map(Number);
      const from = toIsoDate(year, month - 1, 1);
      const to = toIsoDate(year, month, 0);

      const [resTurnos, resAsistencias, resFeriados] = await Promise.all([
        fetch(
          `${config.supabaseUrl}/rest/v1/turnos?select=id,sede,dia,hora,cupo_maximo&ciclo_codigo=eq.${encodeURIComponent(
            filtroCiclo
          )}&activo=eq.true&order=sede.asc,dia.asc,hora.asc`,
          { headers }
        ),
        fetch(
          `${config.supabaseUrl}/rest/v1/asistencias?select=fecha,turno,sede&fecha=gte.${from}&fecha=lte.${to}`,
          { headers }
        ),
        fetch(
          `${config.supabaseUrl}/rest/v1/feriados?select=fecha&fecha=gte.${from}&fecha=lte.${to}`,
          { headers }
        ),
      ]);

      const dataTurnos = await resTurnos.json();
      const dataAsistencias = await resAsistencias.json();
      const dataFeriados = await resFeriados.json();

      const mapAsistencias = new Map();
      (Array.isArray(dataAsistencias) ? dataAsistencias : []).forEach((a) => {
        const fecha = String(a?.fecha || "").split("T")[0];
        const key = `${fecha}||${a?.sede || ""}||${a?.turno || ""}`;
        mapAsistencias.set(key, true);
      });

      const setFeriados = new Set();
      (Array.isArray(dataFeriados) ? dataFeriados : []).forEach((f) => {
        const fecha = String(f?.fecha || "").split("T")[0];
        if (fecha) setFeriados.add(fecha);
      });

      setTurnos(Array.isArray(dataTurnos) ? dataTurnos : []);
      setAsistenciasMap(mapAsistencias);
      setFeriadosSet(setFeriados);
    })();
  }, [config, filtroCiclo, mesSeleccionado]);

  const registros = useMemo(() => {
    if (!mesSeleccionado || !turnos.length) return [];

    const [year, month] = mesSeleccionado.split("-").map(Number);
    const totalDias = new Date(year, month, 0).getDate();
    const items = [];

    for (let day = 1; day <= totalDias; day += 1) {
      const fechaObj = new Date(year, month - 1, day, 12, 0, 0);
      const fechaIso = toIsoDate(year, month - 1, day);
      const diaSemana = DIAS_SEMANA[fechaObj.getDay()];

      turnos.forEach((turno) => {
        const diaTurno = normalizarDia(turno.dia);
        if (diaTurno !== diaSemana) return;

        const turnoTexto = `${turno.dia} ${turno.hora}`;
        const key = `${fechaIso}||${turno.sede}||${turnoTexto}`;
        const esFeriado = feriadosSet.has(fechaIso);
        const tomada = esFeriado ? false : asistenciasMap.has(key);

        items.push({
          fechaIso,
          fechaObj,
          sede: turno.sede,
          dia: turno.dia,
          hora: turno.hora,
          turnoTexto,
          esFeriado,
          tomada,
        });
      });
    }

    items.sort((a, b) => {
      if (a.fechaIso !== b.fechaIso) return a.fechaIso.localeCompare(b.fechaIso);
      if (a.sede !== b.sede) return String(a.sede).localeCompare(String(b.sede));
      return String(a.hora).localeCompare(String(b.hora));
    });

    return items;
  }, [mesSeleccionado, turnos, asistenciasMap, feriadosSet]);

  const registrosPorFecha = useMemo(() => {
    const map = new Map();
    registros.forEach((r) => {
      if (!map.has(r.fechaIso)) map.set(r.fechaIso, []);
      map.get(r.fechaIso).push(r);
    });
    return Array.from(map.entries());
  }, [registros]);

  const resumen = useMemo(() => {
    const total = registros.filter((r) => !r.esFeriado).length;
    const tomadas = registros.filter((r) => !r.esFeriado && r.tomada).length;
    return { total, tomadas, faltantes: Math.max(0, total - tomadas) };
  }, [registros]);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Control de toma de asistencia</h2>
        <button
          onClick={() => navigate("/asistencia-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-5xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block font-medium mb-1">Ciclo:</label>
            <select
              className="w-full border p-2 rounded"
              value={filtroCiclo}
              onChange={(e) => setFiltroCiclo(e.target.value)}
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
            <label className="block font-medium mb-1">Mes:</label>
            <select
              className="w-full border p-2 rounded"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            >
              {Array.from({ length: 12 }).map((_, idx) => {
                const year = new Date().getFullYear();
                const value = `${year}-${String(idx + 1).padStart(2, "0")}`;
                return (
                  <option key={value} value={value}>
                    {MESES[idx]} {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 font-medium text-base my-4">
          <span className="text-emerald-600">Tomadas: {resumen.tomadas}</span>
          <span className="text-red-600">Sin registrar: {resumen.faltantes}</span>
        </div>

        <div className="space-y-4">
          {registrosPorFecha.length === 0 ? (
            <div className="text-sm text-gray-500">No hay turnos activos para ese ciclo y mes.</div>
          ) : (
            registrosPorFecha.map(([fechaIso, items]) => (
              <div key={fechaIso} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-semibold text-gray-800">
                  {formatFecha(fechaIso)}
                </div>
                <div className="divide-y">
                  {items.map((item) => (
                    <div
                      key={`${item.fechaIso}-${item.sede}-${item.turnoTexto}`}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="text-sm text-gray-800">
                        <span className="font-medium">{item.sede}</span>
                        {" - "}
                        {item.turnoTexto}
                      </div>
                      {item.esFeriado ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          Feriado
                        </span>
                      ) : item.tomada ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Tomada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          Sin registrar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
