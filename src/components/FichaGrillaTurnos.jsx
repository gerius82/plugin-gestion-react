import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaThLarge } from "react-icons/fa"; // Icono para la grilla

export default function FichaGrillaTurnos() {
  const [config, setConfig] = useState(null);
  const [cuposMaximosPorTurno, setCuposMaximosPorTurno] = useState({});
  const [inscripciones, setInscripciones] = useState([]);
  const [sede, setSede] = useState("Calle Mendoza");
  const [cargando, setCargando] = useState(true);
  const [tipoInscripcion, setTipoInscripcion] = useState("CICLO_2025");

  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const filasCiclo = ["fila1", "fila2", "fila3"];
  const filasVerano = ["fila1", "fila2"];
  // 👇 filas visibles según tipo de inscripción
  const filas = tipoInscripcion === "TDV" ? filasVerano : filasCiclo;

  const asignacionCiclo = {
    "Lunes 14:30 a 16:00": "fila1",
    "Lunes 16:30 a 18:00": "fila2",
    "Lunes 18:30 a 20:00": "fila3",
    "Martes 09:30 a 11:00": "fila1",
    "Martes 16:30 a 18:00": "fila2",
    "Martes 18:30 a 20:00": "fila3",
    "Miércoles 16:30 a 18:00": "fila2",
    "Miércoles 18:30 a 20:00": "fila3",
    "Jueves 14:30 a 16:00": "fila1",
    "Jueves 16:30 a 18:00": "fila2",
    "Jueves 18:30 a 20:00": "fila3",
    "Viernes 14:30 a 16:00": "fila1",
    "Viernes 16:30 a 18:00": "fila2",
    "Viernes 18:30 a 20:00": "fila3",
    "Sábado 09:00 a 10:30": "fila1",
    "Sábado 11:00 a 12:30": "fila2",
  };

  // Mapa para TALLER DE VERANO (TDV)
  const asignacionVerano = {
    "Lunes 17:00 a 18:30": "fila1",
    "Lunes 19:00 a 20:30": "fila2",
    "Martes 17:00 a 18:30": "fila1",
    "Martes 19:00 a 20:30": "fila2",
    "Miércoles 17:00 a 18:30": "fila1",
    "Miércoles 19:00 a 20:30": "fila2",
    "Jueves 17:00 a 18:30": "fila1",
    "Jueves 19:00 a 20:30": "fila2",
    "Viernes 17:00 a 18:30": "fila1",
    "Viernes 19:00 a 20:30": "fila2",
    "Sábado 09:00 a 10:30": "fila1",
    "Sábado 11:00 a 12:30": "fila2",
  };

  const normalizarTurno = (t) => (t || "").trim().replace(/hs$/i, "");
  const soloHorario = (t) => (t ? t.split(" ").slice(1).join(" ") : "");

  useEffect(() => {
    (async () => {
      const res = await fetch("/config.json");
      const json = await res.json();
      setConfig(json);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const archivoTurnos =
          tipoInscripcion === "TDV" ? "/turnos_verano.json" : "/turnos.json";

        const res = await fetch(archivoTurnos);
        const json = await res.json();
        setCuposMaximosPorTurno(json || {});
      } catch {
        setCuposMaximosPorTurno({});
      }
    })();
  }, [tipoInscripcion]);

  useEffect(() => {
    if (!config) return;
    (async () => {
      setCargando(true);
      const headers = {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      };

      let filtroTipo = "";
      if (tipoInscripcion) {
        filtroTipo = `&tipo_inscripcion=eq.${encodeURIComponent(tipoInscripcion)}`;
      }

      const url = `${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=nombre,apellido,edad,sede,turno_1,creado_en${filtroTipo}&order=creado_en`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setInscripciones(Array.isArray(data) ? data : []);
      setCargando(false);
    })();
  }, [config, tipoInscripcion]);

  const mapa = useMemo(() => {
    const base = {};
    dias.forEach((d) => {
      base[d] = {};
      filas.forEach((f) => (base[d][f] = { turnoLabel: null, inscriptos: [] }));
    });

    // 👇 elegir mapa adecuado
    const asignacionDeTurnos =
      tipoInscripcion === "TDV" ? asignacionVerano : asignacionCiclo;

    for (const insc of inscripciones) {
      if (!insc.turno_1) continue;
      if (sede && insc.sede !== sede) continue;

      const turno = normalizarTurno(insc.turno_1);
      const fila = asignacionDeTurnos[turno];
      const dia = turno.split(" ")[0];
      if (!fila || !base[dia]) continue;

      base[dia][fila].turnoLabel = turno;
      base[dia][fila].inscriptos.push(insc);
    }

    const cuposPorSede = cuposMaximosPorTurno[sede] || {};
    Object.keys(cuposPorSede).forEach((turnoCrudo) => {
      const tNorm = normalizarTurno(turnoCrudo);
      const dia = tNorm.split(" ")[0];
      const fila = asignacionDeTurnos[tNorm];
      if (base[dia] && base[dia][fila] && !base[dia][fila].turnoLabel) {
        base[dia][fila].turnoLabel = tNorm;
      }
    });

    return base;
  }, [inscripciones, sede, cuposMaximosPorTurno, tipoInscripcion]);

  const getMaxCupo = (turnoLabel) => {
    const clave = turnoLabel ? `${turnoLabel}hs` : "";
    const porSede = cuposMaximosPorTurno[sede] || {};
    return porSede[clave] ?? 13;
  };

  return (
    
    <div className="">
      

      <div className="flex items-center justify-center gap-3 mb-3">
        <FaThLarge className="text-purple-500 text-3xl" />
        <h2 className="text-2xl font-bold text-center">Grilla por Turno</h2>
      </div>
      {/* Filtros en tarjeta, 2 columnas */}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sede */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Filtrar por sede:
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white text-sm"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
            >
              <option value="Calle Mendoza">Calle Mendoza</option>
              <option value="Fisherton">Fisherton</option>
            </select>
          </div>

          {/* Tipo de inscripción */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Tipo de inscripción:
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 hover:bg-white text-sm"
              value={tipoInscripcion}
              onChange={(e) => setTipoInscripcion(e.target.value)}
            >
              <option value="CICLO_2025">Ciclo 2025</option>
              <option value="TDV">Taller de Verano</option>
              <option value="CICLO_2026">Ciclo 2026</option>
              <option value="">Todos</option>
            </select>
          </div>
        </div>
      </div>


      {cargando ? (
        <div className="text-center py-10 text-gray-500">Cargando…</div>
      ) : (
        <>
          {/* --- DESKTOP Y TABLET: GRILLA 6 COLUMNAS --- */}
          <div className="hidden md:block overflow-x-auto">
            <div className="grid grid-cols-6 text-center font-semibold text-gray-700 mb-2">
              {dias.map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            {filas.map((filaKey) => (
              <div key={filaKey} className="grid grid-cols-6 gap-4 mb-4">
                {dias.map((dia) => {
                  const celda = mapa[dia][filaKey];
                  const lista = celda?.inscriptos || [];
                  const turno = celda?.turnoLabel;
                  const max = getMaxCupo(turno);
                  const completo = lista.length >= max;

                  return (
                    <div
                      key={`${dia}-${filaKey}`}
                      className={`rounded-lg border p-3 h-[420px] align-top text-xs shadow-sm ${
                        completo ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                      }`}
                    >
                      <h5 className="text-center text-[11px] text-gray-700 mb-1">
                        {turno ? `${soloHorario(turno)} (${lista.length}/${max})` : ""}
                      </h5>

                      <div className="overflow-y-auto max-h-[360px] pr-1">
                        {lista.map((a, i) => (
                          <div key={`${a.nombre}-${a.apellido}-${i}`} className="text-[11px] mb-1">
                            <span className="text-gray-800">{i + 1}. {a.nombre} {a.apellido}</span>
                            <span className="text-gray-500"> · {a.edad ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* --- MOBILE: CARD POR DÍA --- */}
          <div className="block md:hidden space-y-4">
            {dias.map((dia) => (
              <div key={dia} className="bg-white rounded-xl shadow border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{dia}</h3>

                {filas.map((filaKey) => {
                  const celda = mapa[dia][filaKey];
                  if (!celda || !celda.turnoLabel) return null;

                  const lista = celda.inscriptos;
                  const turno = celda.turnoLabel;
                  const max = getMaxCupo(turno);
                  const completo = lista.length >= max;

                  return (
                    <div
                      key={filaKey}
                      className={`mb-3 p-2 rounded-lg border ${
                        completo ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                      }`}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold">{soloHorario(turno)}</span>
                        <span className="text-[11px]">
                          {lista.length}/{max}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {lista.map((al, i) => (
                          <span key={`${al.nombre}-${i}`} className="text-[11px] text-gray-800">
                            {i + 1}. {al.nombre} {al.apellido}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}


      

      <div className="mt-6 w-fit mx-auto">
        <Link
          to="/menu-gestion"
          className="bg-white rounded-lg border-l-4 border-gray-400 px-4 py-2 shadow hover:shadow-md hover:scale-105 transition flex items-center gap-2"
        >
          <span className="text-gray-500 text-lg">←</span>
          <span className="font-medium text-gray-700">Volver al menú</span>
        </Link>
      </div>
    </div>
  );
}
