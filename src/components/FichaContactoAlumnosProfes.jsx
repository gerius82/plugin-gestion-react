import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function FichaContactoAlumnosProfes() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [alumnoSelId, setAlumnoSelId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/config.json");
        const json = await res.json();
        setConfig(json);
      } catch {
        setError("No se pudo cargar la configuración.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!config?.supabaseUrl || !config?.supabaseKey) return;
    (async () => {
      try {
        setCargando(true);
        setError("");
        const headers = {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
        };

        const res = await fetch(
          `${config.supabaseUrl}/rest/v1/matriculas?select=alumno_id,inscripciones(id,nombre,apellido,responsable,telefono)&estado=eq.activa`,
          { headers }
        );
        const data = await res.json();

        const map = new Map();
        (Array.isArray(data) ? data : []).forEach((m) => {
          const i = m?.inscripciones;
          if (!i?.id) return;
          if (!map.has(i.id)) {
            map.set(i.id, {
              id: i.id,
              nombre: i.nombre || "",
              apellido: i.apellido || "",
              responsable: i.responsable || "",
              telefono: i.telefono || "",
            });
          }
        });

        const lista = Array.from(map.values()).sort(
          (a, b) =>
            String(a.nombre || "").localeCompare(String(b.nombre || "")) ||
            String(a.apellido || "").localeCompare(String(b.apellido || ""))
        );
        setAlumnos(lista);
      } catch {
        setError("No se pudo cargar la lista de alumnos.");
      } finally {
        setCargando(false);
      }
    })();
  }, [config]);

  const alumnoSeleccionado = useMemo(
    () => alumnos.find((a) => String(a.id) === String(alumnoSelId)) || null,
    [alumnos, alumnoSelId]
  );

  const telefonoLimpio = String(alumnoSeleccionado?.telefono || "").replace(/\D/g, "");
  const urlWhatsapp = telefonoLimpio
    ? `https://wa.me/54${telefonoLimpio}`
    : "";

  const abrirWhatsapp = () => {
    if (!urlWhatsapp) return;
    window.open(urlWhatsapp, "_blank");
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4">
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="text-2xl font-bold">Contacto de alumnos</h2>
        <button
          onClick={() => navigate("/menu-profes")}
          className="inline-flex shrink-0 w-auto whitespace-nowrap items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Seleccionar alumno</label>
          <select
            value={alumnoSelId}
            onChange={(e) => setAlumnoSelId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">-- Seleccionar alumno --</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} {a.apellido}
              </option>
            ))}
          </select>
        </div>

        {cargando && <p className="text-sm text-gray-500">Cargando alumnos...</p>}
        {!cargando && error && <p className="text-sm text-red-600">{error}</p>}

        {!cargando && !error && alumnoSeleccionado && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
            <div>
              <span className="text-sm text-gray-500">Nombre</span>
              <div className="font-semibold">{alumnoSeleccionado.nombre || "-"}</div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Apellido</span>
              <div className="font-semibold">{alumnoSeleccionado.apellido || "-"}</div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Responsable</span>
              <div className="font-semibold">{alumnoSeleccionado.responsable || "-"}</div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Contacto</span>
              <div className="mt-1">
                <button
                  type="button"
                  onClick={abrirWhatsapp}
                  disabled={!urlWhatsapp}
                  className="inline-flex w-fit max-w-max items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ border: "1px solid #86efac" }}
                >
                  Enviar mensaje
                </button>
                <div className="text-xs text-gray-500 mt-1">
                  Este botón abre WhatsApp para contactar al responsable del alumno seleccionado.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
