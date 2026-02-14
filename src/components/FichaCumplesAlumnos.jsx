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

const WEEK_DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const parseFecha = (valor) => {
  const raw = String(valor || "").trim();
  if (!raw) return null;
  const base = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
  const [y, m, d] = base.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
};

const formatFecha = (valor) => {
  const parsed = parseFecha(valor);
  if (!parsed) return "-";
  const dd = String(parsed.d).padStart(2, "0");
  const mm = String(parsed.m).padStart(2, "0");
  return `${dd}-${mm}-${parsed.y}`;
};

export default function FichaCumplesAlumnos() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/config.json")
      .then((r) => r.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar config.json"));
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
          `${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido,telefono,fecha_nacimiento&order=nombre.asc`,
          { headers }
        );
        if (!res.ok) throw new Error("No pude cargar alumnos");
        const data = await res.json();
        const lista = (Array.isArray(data) ? data : [])
          .filter((a) => a?.fecha_nacimiento)
          .map((a) => {
            const f = parseFecha(a.fecha_nacimiento);
            return {
              id: a.id,
              nombre: (a.nombre || "").trim(),
              apellido: (a.apellido || "").trim(),
              telefono: a.telefono || "",
              fecha_nacimiento: a.fecha_nacimiento,
              dia: f?.d || null,
              mes: f?.m || null,
            };
          })
          .filter((a) => a.dia && a.mes);
        setAlumnos(lista);
      } catch {
        setError("No pude cargar los cumpleaños.");
      }
    })();
  }, [config]);

  const diasMes = useMemo(() => {
    const year = new Date().getFullYear();
    const total = new Date(year, mesSeleccionado, 0).getDate();
    const firstDowJs = new Date(year, mesSeleccionado - 1, 1).getDay(); // 0 dom
    const firstDow = firstDowJs === 0 ? 7 : firstDowJs; // 1 lun ... 7 dom
    return { total, firstDow };
  }, [mesSeleccionado]);

  const cumplePorDia = useMemo(() => {
    const map = new Map();
    alumnos
      .filter((a) => a.mes === mesSeleccionado)
      .forEach((a) => {
        const key = String(a.dia);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
      });
    return map;
  }, [alumnos, mesSeleccionado]);

  const alumnosDia = useMemo(() => {
    if (!diaSeleccionado) return [];
    return (cumplePorDia.get(String(diaSeleccionado)) || []).sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    );
  }, [cumplePorDia, diaSeleccionado]);

  const buildWhatsappFelicitacion = (alumno) => {
    const tel = String(alumno?.telefono || "").replace(/\D/g, "");
    if (!tel) return "";
    const nombre = `${alumno?.nombre || ""} ${alumno?.apellido || ""}`.trim();
    const texto = [
      `🎉 ¡Hola ${nombre}!`,
      "🤖 Desde todo el equipo de Plugin queremos desearte un muy feliz cumpleaños.",
      "🥳 Que pases un día hermoso, lleno de alegría y diversión.",
      "🎂 ¡Te mandamos un abrazo grande!",
    ].join("\n");
    return `https://wa.me/54${tel}?text=${encodeURIComponent(texto)}`;
  };

  const celdas = [];
  for (let i = 1; i < diasMes.firstDow; i += 1) celdas.push(null);
  for (let d = 1; d <= diasMes.total; d += 1) celdas.push(d);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4 pb-8">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Cumples alumnos</h2>
        <button
          onClick={() => navigate("/alumnos-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Mes:</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={mesSeleccionado}
            onChange={(e) => {
              setMesSeleccionado(Number(e.target.value));
              setDiaSeleccionado(null);
            }}
          >
            {MESES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-600 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {celdas.map((dia, idx) =>
            dia ? (
              <button
                key={`d-${dia}`}
                type="button"
                onClick={() => setDiaSeleccionado(dia)}
                className={`h-16 rounded-lg border text-sm transition ${
                  diaSeleccionado === dia
                    ? "border-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="font-semibold">{dia}</div>
                <div className="text-xs text-gray-600">{(cumplePorDia.get(String(dia)) || []).length} cumple(s)</div>
              </button>
            ) : (
              <div key={`e-${idx}`} />
            )
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-base font-semibold mb-2">
            {diaSeleccionado ? `Cumples del ${String(diaSeleccionado).padStart(2, "0")}-${String(mesSeleccionado).padStart(2, "0")}` : "Selecciona un dia"}
          </h3>
          {diaSeleccionado && alumnosDia.length === 0 && (
            <p className="text-sm text-gray-500">No hay cumpleaños ese dia.</p>
          )}
          {alumnosDia.length > 0 && (
            <div className="space-y-2">
              {alumnosDia.map((a) => (
                <div key={a.id} className="border rounded-lg px-3 py-2 bg-gray-50 text-sm">
                  <div className="font-medium flex items-center justify-between gap-2">
                    <span>
                      {a.nombre} {a.apellido}
                    </span>
                    {a.telefono ? (
                      <a
                        href={buildWhatsappFelicitacion(a)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                  <div className="text-gray-600">Nacimiento: {formatFecha(a.fecha_nacimiento)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
