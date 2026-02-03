import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const normalizeTurnosConfig = (cfg) => {
  if (!cfg) return {};
  if (Array.isArray(cfg)) {
    const out = {};
    cfg.forEach((item) => {
      if (!item) return;
      const sede = item.sede;
      const dia = item.dia;
      let horarios = item.horarios || item.horas || item.turnos || item.horario;
      if (!sede || !dia || !horarios) return;
      if (!Array.isArray(horarios)) horarios = [horarios];
      out[sede] = out[sede] || {};
      out[sede][dia] = out[sede][dia] || [];
      horarios.forEach((h) => {
        if (h) out[sede][dia].push(h);
      });
    });
    return out;
  }
  if (typeof cfg === "object") return cfg;
  return {};
};

const parseTurnosConfig = (cfg) => {
  if (!cfg) return {};
  if (typeof cfg === "string") {
    try {
      return normalizeTurnosConfig(JSON.parse(cfg));
    } catch {
      return {};
    }
  }
  return normalizeTurnosConfig(cfg);
};

const formatCurrency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function MenuInscripcionCursos() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ciclo = params.get("ciclo") || "";

  const [config, setConfig] = useState(null);
  const [cicloNombre, setCicloNombre] = useState("");
  const [cursos, setCursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/config.json");
        const cfg = await res.json();
        setConfig(cfg);
      } catch {
        setError("No pude cargar config.json.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!config) return;
    if (!ciclo) {
      setError("No se encontro un ciclo para mostrar.");
      setCargando(false);
      return;
    }

    (async () => {
      setCargando(true);
      setError("");
      try {
        const headers = {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        };

        const [resCiclo, resCursos] = await Promise.all([
          fetch(
            `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico&codigo=eq.${encodeURIComponent(
              ciclo
            )}`,
            { headers }
          ),
          fetch(
            `${config.supabaseUrl}/rest/v1/cursos?select=id,nombre,descripcion,turnos_config,imagen_url,precio_curso,precio_inscripcion,edad_min,edad_max&ciclo=eq.${encodeURIComponent(
              ciclo
            )}&activo=eq.true&order=nombre.asc`,
            { headers }
          ),
        ]);

        const dataCiclo = await resCiclo.json();
        const infoCiclo = Array.isArray(dataCiclo) ? dataCiclo[0] : null;
        setCicloNombre(infoCiclo?.nombre_publico || ciclo);

        const dataCursos = await resCursos.json();
        setCursos(Array.isArray(dataCursos) ? dataCursos : []);
      } catch (e) {
        console.error(e);
        setError("No pude cargar los cursos.");
      } finally {
        setCargando(false);
      }
    })();
  }, [config, ciclo]);

  const cursosConTurnos = useMemo(() => {
    const normalizeNombre = (valor = "") =>
      String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const ordenPreferido = [
      "robotica basica",
      "robotica avanzada",
      "programacion",
      "arduino",
    ];
    const rankCurso = (nombre = "") => {
      const base = normalizeNombre(nombre);
      const idx = ordenPreferido.findIndex((key) => base.includes(key));
      return idx === -1 ? 99 : idx;
    };
    const ordenDias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const ordenarDias = (lista = []) =>
      [...lista].sort((a, b) => {
        const na = normalizeNombre(a);
        const nb = normalizeNombre(b);
        const ia = ordenDias.indexOf(na);
        const ib = ordenDias.indexOf(nb);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    const horaInicio = (valor = "") => {
      const m = String(valor || "").match(/(\d{1,2}:\d{2})/);
      return m ? m[1].padStart(5, "0") : String(valor || "");
    };
    const ordenarHoras = (lista = []) =>
      [...lista].sort((a, b) => horaInicio(a).localeCompare(horaInicio(b)));
    const normalizarHoras = (valor) => {
      if (Array.isArray(valor)) return valor;
      if (typeof valor === "string") return [valor];
      if (valor && typeof valor === "object") {
        return Object.values(valor).flat().filter(Boolean);
      }
      return [];
    };
    const ordenarTurnosPorSede = (turnos = {}) => {
      const out = {};
      Object.keys(turnos).forEach((sede) => {
        const dias = turnos[sede] || {};
        const diasOrdenados = {};
        ordenarDias(Object.keys(dias)).forEach((dia) => {
          const horas = normalizarHoras(dias[dia]);
          diasOrdenados[dia] = ordenarHoras(horas);
        });
        out[sede] = diasOrdenados;
      });
      return out;
    };

    const lista = cursos.map((c) => ({
      ...c,
      turnos: ordenarTurnosPorSede(parseTurnosConfig(c.turnos_config)),
    }));
    lista.sort((a, b) => {
      const ra = rankCurso(a.nombre);
      const rb = rankCurso(b.nombre);
      if (ra !== rb) return ra - rb;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
    return lista;
  }, [cursos]);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">
          Cursos disponibles
        </h1>
        <button
          onClick={() => navigate("/menu-inscripcion-padres")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-5xl mx-auto">
        <p className="text-center text-gray-600 mb-6">
          Ciclo: <span className="font-semibold text-gray-800">{cicloNombre}</span>
        </p>

        {cargando ? (
          <div className="text-center text-gray-500 py-8">Cargando cursos...</div>
        ) : error ? (
          <div className="text-center text-red-600 text-sm">{error}</div>
        ) : cursosConTurnos.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No hay cursos activos para este ciclo.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cursosConTurnos.map((curso) => (
              <div
                key={curso.id}
                className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-white"
              >
                <img
                  src={curso.imagen_url || "/Logo_Plugin_2025.png"}
                  alt={curso.nombre}
                  className="h-40 w-full object-cover"
                />
                <div className="p-4 space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">{curso.nombre}</h3>
                  {curso.descripcion && (
                    <p className="text-sm text-gray-600">{curso.descripcion}</p>
                  )}

                  {(curso.edad_min != null || curso.edad_max != null) && (
                    <div className="text-sm text-gray-700">
                      Edad:{" "}
                      <span className="font-semibold">
                        {curso.edad_min ?? "?"} a {curso.edad_max ?? "?"} años
                      </span>
                    </div>
                  )}

                  <div className="text-sm text-gray-700 space-y-1">
                    {curso.precio_inscripcion != null && (
                      <div>
                        Inscripcion:{" "}
                        <span className="font-semibold">
                          {formatCurrency.format(Number(curso.precio_inscripcion))}
                        </span>
                      </div>
                    )}
                    {curso.precio_curso != null && (
                      <div>
                        Cuota mensual:{" "}
                        <span className="font-semibold">
                          {formatCurrency.format(Number(curso.precio_curso))}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-1">Horarios:</p>
                    <p className="text-gray-500">Se muestran al avanzar con la inscripción.</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/formulario?origen=padres&from=menu-inscripcion-cursos&ciclo=${encodeURIComponent(
                            ciclo
                          )}&curso_id=${curso.id}`
                        )
                      }
                      className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
                    >
                      Inscribir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
