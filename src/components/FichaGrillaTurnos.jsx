import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaThLarge } from "react-icons/fa";

const ORDEN_DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const normalizarDia = (d) =>
  String(d || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const ordenarDias = (a, b) => {
  const ia = ORDEN_DIAS.indexOf(normalizarDia(a));
  const ib = ORDEN_DIAS.indexOf(normalizarDia(b));
  if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};
const soloHorario = (t) => String(t || "");
const inicioDeRango = (t) => {
  const m = String(t || "").match(/(\d{1,2}:\d{2})/);
  return m ? m[1].padStart(5, "0") : "";
};
const ordenarHorarios = (arr) =>
  [...arr].sort((a, b) => inicioDeRango(a.hora).localeCompare(inicioDeRango(b.hora)));

const agruparTurnosPorDiaHora = (lista) => {
  const map = new Map();
  lista.forEach((t) => {
    const key = `${t.dia}||${t.hora}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...t, cupo_maximo: Number.isFinite(t.cupo_maximo) ? Number(t.cupo_maximo) : null });
    } else {
      const cupoPrev = prev.cupo_maximo;
      const cupoNuevo = Number.isFinite(t.cupo_maximo) ? Number(t.cupo_maximo) : null;
      let cupoSum = null;
      if (Number.isFinite(cupoPrev) && Number.isFinite(cupoNuevo)) {
        cupoSum = cupoPrev + cupoNuevo;
      } else if (Number.isFinite(cupoPrev)) {
        cupoSum = cupoPrev;
      } else if (Number.isFinite(cupoNuevo)) {
        cupoSum = cupoNuevo;
      }
      map.set(key, { ...prev, cupo_maximo: cupoSum });
    }
  });
  return Array.from(map.values());
};

export default function FichaGrillaTurnos() {
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tipoInscripcion, setTipoInscripcion] = useState("CICLO_2025");
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [sede, setSede] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [inscripcionesMap, setInscripcionesMap] = useState({});

  useEffect(() => {
    (async () => {
      const res = await fetch("/config.json");
      const json = await res.json();
      setConfig(json);
    })();
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        const headers = {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        };
        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
          { headers }
        );
        const data = await res.json();
        const lista = Array.isArray(data) ? data : [];
        setCiclosDisponibles(lista);
        if (!lista.length) return;
        const actual = lista.some((c) => c.codigo === tipoInscripcion);
        if (!actual) {
          const activo = lista.find((c) => c.activo) || lista[0];
          setTipoInscripcion(activo?.codigo || "");
        }
      } catch {
        setCiclosDisponibles([]);
      }
    })();
  }, [config, tipoInscripcion]);

  useEffect(() => {
    if (!config) return;
    (async () => {
      try {
        setCargando(true);

        const headers = {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        };

        const urlTurnos =
          `${config.supabaseUrl}/rest/v1/turnos` +
          `?select=sede,dia,hora,cupo_maximo,activo` +
          `&ciclo_codigo=eq.${encodeURIComponent(tipoInscripcion)}` +
          `&activo=eq.true`;

        const urlMatriculas =
          `${config.supabaseUrl}/rest/v1/matriculas` +
          `?select=alumno_id,sede,dia,hora,ciclo_codigo,estado` +
          `&ciclo_codigo=eq.${encodeURIComponent(tipoInscripcion)}` +
          `&estado=eq.activa`;

        const [resTurnos, resMatriculas] = await Promise.all([
          fetch(urlTurnos, { headers }),
          fetch(urlMatriculas, { headers }),
        ]);

        const turnosData = await resTurnos.json();
        const matsData = await resMatriculas.json();

        setTurnos(Array.isArray(turnosData) ? turnosData : []);
        setMatriculas(Array.isArray(matsData) ? matsData : []);

        const ids = Array.from(new Set((matsData || []).map((m) => m.alumno_id))).filter(Boolean);
        if (ids.length) {
          const filtros = ids.map((id) => `id.eq.${id}`).join(",");
          const urlInsc =
            `${config.supabaseUrl}/rest/v1/inscripciones` +
            `?select=id,nombre,apellido` +
            `&or=(${filtros})`;
          const resInsc = await fetch(urlInsc, { headers });
          const inscData = await resInsc.json();
          const map = {};
          (inscData || []).forEach((i) => {
            map[i.id] = { nombre: i.nombre, apellido: i.apellido };
          });
          setInscripcionesMap(map);
        } else {
          setInscripcionesMap({});
        }
      } finally {
        setCargando(false);
      }
    })();
  }, [config, tipoInscripcion]);

  const turnosFiltrados = useMemo(() => {
    if (sede) return turnos.filter((t) => t.sede === sede);
    return agruparTurnosPorDiaHora(turnos);
  }, [turnos, sede]);

  const dias = useMemo(() => {
    const unicos = Array.from(new Set(turnosFiltrados.map((t) => t.dia)));
    return unicos.sort(ordenarDias);
  }, [turnosFiltrados]);

  const slotsPorDia = useMemo(() => {
    const base = {};
    dias.forEach((d) => (base[d] = []));
    turnosFiltrados.forEach((t) => {
      base[t.dia] = base[t.dia] || [];
      base[t.dia].push(t);
    });
    Object.keys(base).forEach((d) => {
      base[d] = ordenarHorarios(base[d]);
    });
    return base;
  }, [dias, turnosFiltrados]);

  const mapaAlumnos = useMemo(() => {
    const map = new Map();
    turnosFiltrados.forEach((t) => {
      map.set(`${t.dia}||${t.hora}`, { turno: t, alumnos: [] });
    });

    matriculas.forEach((m) => {
      if (tipoInscripcion && m.ciclo_codigo !== tipoInscripcion) return;
      if (sede && m.sede !== sede) return;
      const key = `${m.dia}||${m.hora}`;
      const entry = map.get(key);
      if (!entry) return;
      const info = inscripcionesMap[m.alumno_id] || {};
      entry.alumnos.push({
        id: m.alumno_id,
        nombre: info.nombre || "Sin nombre",
        apellido: info.apellido || "",
      });
    });

    return map;
  }, [turnosFiltrados, matriculas, inscripcionesMap, sede, tipoInscripcion]);

  return (
    <div className="w-full px-4 md:px-6">
      <div className="flex items-center justify-center gap-3 mb-3">
        <FaThLarge className="text-emerald-600 text-3xl" />
        <h2 className="text-2xl font-bold text-center">Grilla por Turno</h2>
      </div>

      <div className="max-w-screen-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Filtrar por sede:
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white text-sm"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="Calle Mendoza">Calle Mendoza</option>
              <option value="Fisherton">Fisherton</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Ciclo:
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white text-sm"
              value={tipoInscripcion}
              onChange={(e) => setTipoInscripcion(e.target.value)}
            >
              {ciclosDisponibles.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre_publico || c.codigo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-10 text-gray-500">Cargando...</div>
      ) : !turnosFiltrados.length ? (
        <div className="text-center py-10 text-gray-500">Sin turnos para mostrar.</div>
      ) : (
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {dias.map((dia) => (
              <div
                key={dia}
                className="rounded-2xl bg-white border border-gray-200 shadow-sm p-3 flex flex-col min-h-[220px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {dia}
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    {(slotsPorDia[dia] || []).length} turnos
                  </span>
                </div>

                <div className="space-y-2">
                  {(slotsPorDia[dia] || []).map((turno) => {
                    const entry = mapaAlumnos.get(`${turno.dia}||${turno.hora}`) || { alumnos: [] };
                    const lista = entry.alumnos;
                    const max = Number.isFinite(turno.cupo_maximo) ? turno.cupo_maximo : "-";
                    const completo = max !== "-" && lista.length >= max;
                    const cardCls = completo
                      ? "border-red-200 bg-red-50"
                      : "border-emerald-200 bg-emerald-50";
                    const metaCls = completo ? "text-red-700" : "text-emerald-700";

                    return (
                      <div key={`${turno.dia}-${turno.hora}`} className={`rounded-xl border p-2 ${cardCls}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">
                            {soloHorario(turno.hora)}
                          </span>
                          <span className={`text-[11px] font-medium ${metaCls}`}>
                            {lista.length}/{max}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {lista.length ? (
                            lista.map((al, i) => (
                              <div key={`${al.id}-${i}`} className="text-[11px] text-gray-800">
                                {i + 1}. {al.nombre} {al.apellido}
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] text-gray-500">Sin alumnos</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(slotsPorDia[dia] || []).length === 0 && (
                    <div className="text-[11px] text-gray-500 italic">Sin horarios</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/menu-gestion"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menu</span>
        </Link>
      </div>
    </div>
  );
}
