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
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
        <label className="font-medium">Filtrar por sede:</label>
        <select
          className="border rounded px-3 py-2 bg-gray-50 hover:bg-white"
          value={sede}
          onChange={(e) => setSede(e.target.value)}
        >
          <option value="Calle Mendoza">Calle Mendoza</option>
          <option value="Fisherton">Fisherton</option>
        </select>

        <label className="font-medium ml-4">Tipo de inscripción:</label>
        <select
          className="border rounded px-3 py-2 bg-gray-50 hover:bg-white"
          value={tipoInscripcion}
          onChange={(e) => setTipoInscripcion(e.target.value)}
        >
          <option value="CICLO_2025">Ciclo 2025</option>
          <option value="TDV">Taller de Verano</option>
          <option value="CICLO_2026">Ciclo 2026</option>
        </select>
      </div>


      {cargando ? (
        <div className="text-center py-10 text-gray-500">Cargando…</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-6 text-center font-semibold text-gray-700 mb-2 min-w-[1200px]">
            {dias.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          {filas.map((filaKey) => (
            <div key={filaKey} className="grid grid-cols-6 gap-4 mb-4 min-w-[1200px]">
              {dias.map((dia) => {
                const celda = mapa[dia][filaKey];
                const lista = celda?.inscriptos || [];
                const turno = celda?.turnoLabel;
                const max = getMaxCupo(turno);
                const completo = lista.length >= max;

                return (
                  <div
                    key={`${dia}-${filaKey}`}
                    className={`rounded-lg border p-3 h-[420px] align-top text-sm shadow-sm ${
                      completo ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                    }`}
                  >
                    <h5 className="text-center text-xs text-gray-700 mb-2">
                      {turno ? `${soloHorario(turno)} (${lista.length}/${max})` : ""}
                    </h5>

                    <table className="w-full border-collapse">
                      <tbody>
                        {lista.map((a, i) => (
                          <tr key={`${a.nombre}-${a.apellido}-${i}`}>
                            <td className="py-0.5 pr-1 w-4 text-[10px] align-top text-gray-400">{i + 1}</td>
                            <td className="py-0.5">
                              <div className="leading-tight flex flex-col sm:flex-row sm:justify-between sm:items-center whitespace-normal">
                                <div className="text-gray-800 mr-2 break-words">{a.nombre} {a.apellido}</div>
                                <div className="text-[11px] text-gray-500 text-right">{a.edad ?? ""}</div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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
