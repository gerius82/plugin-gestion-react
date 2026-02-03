import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function DarDeBaja() {
  // Ruta de regreso: por defecto /menu-padres; si viene con ?from=alumnos-menu => /alumnos-menu
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const rutaVolver = from === "alumnos-menu" ? "/alumnos-menu" : "/menu-padres";

  const [config, setConfig] = useState(null);
  const [telefono, setTelefono] = useState("");
  const [alumnos, setAlumnos] = useState([]); // [{matricula_id,alumno_id,nombre,apellido,telefono,curso,sede,dia,hora,ciclo_codigo,selected}]
  const [motivo, setMotivo] = useState("");

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    fetch("/config.json")
      .then((r) => r.json())
      .then((cfg) => setConfig(cfg))
      .catch(() => setError("No pude cargar la configuración (config.json)."));
  }, []);

  const headers = () => ({
    apikey: config?.supabaseKey ?? "",
    Authorization: `Bearer ${config?.supabaseKey ?? ""}`,
  });

  const selected = useMemo(() => alumnos.filter((a) => a.selected), [alumnos]);

  const buscar = async () => {
    setError("");
    setOkMsg("");
    setAlumnos([]);

    const tel = telefono.trim().replace(/\D/g, "");
    if (!tel) {
      setError("Ingresá un número de teléfono válido.");
      return;
    }
    if (!config) return;

    setLoading(true);
    try {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,ciclo_codigo,curso_nombre,sede,dia,hora,inscripciones!inner(nombre,apellido,telefono)` +
          `&estado=eq.activa` +
          `&inscripciones.telefono=ilike.*${tel}*`, { headers: headers() });
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setError("No se encontraron alumnos activos con ese teléfono.");
        setLoading(false);
        return;
      }

      setAlumnos(
        data.map((a) => ({
          matricula_id: a.id,
          alumno_id: a.alumno_id,
          nombre: a.inscripciones?.nombre || "",
          apellido: a.inscripciones?.apellido || "",
          telefono: a.inscripciones?.telefono || "",
          curso: a.curso_nombre || "",
          sede: a.sede,
          dia: a.dia,
          hora: a.hora,
          ciclo_codigo: a.ciclo_codigo,
          selected: true,
        }))
      );
    } catch (e) {
      console.error(e);
      setError("Error al buscar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAlumno = (matriculaId) => {
    setAlumnos((prev) =>
      prev.map((a) =>
        a.matricula_id === matriculaId ? { ...a, selected: !a.selected } : a
      )
    );
  };

  const darDeBaja = async () => {
    setError("");
    setOkMsg("");

    if (selected.length === 0) {
      setError("Seleccioná al menos un alumno para dar de baja.");
      return;
    }
    if (!motivo.trim()) {
      setError("Por favor explicá brevemente el motivo de baja.");
      return;
    }
    if (!config) return;

    setProcessing(true);
    try {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      for (const a of selected) {
        await fetch(`${config.supabaseUrl}/rest/v1/matriculas?id=eq.${a.matricula_id}`, {
          method: "PATCH",
          headers: { ...headers(), "Content-Type": "application/json", prefer: "return=representation" },
          body: JSON.stringify({ estado: "baja", fecha_fin: fechaHoy }),
        });
      }

      // WhatsApp
      const nombres = selected.map((a) => `${a.nombre} ${a.apellido}`);
      const detalles = selected.map((a) => `${a.nombre} ${a.apellido} - ${a.curso || "Curso"} (${a.dia} ${a.hora})`);
      const texto = encodeURIComponent(
        `Solicitud de baja:
Alumno(s): ${nombres.join(", ")}
Motivo: ${motivo.trim()}

Cursos:
${detalles.join("\n")}`
      );
      const link = `https://wa.me/543412153057?text=${texto}`;
      window.open(link, "_blank");

      setOkMsg("Baja realizada y solicitud enviada por WhatsApp.");
      setTelefono("");
      setMotivo("");
      setAlumnos([]);
    } catch (e) {
      console.error(e);
      setError("No pude completar la baja. Revisá la conexión e intentá nuevamente.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Dar de baja alumno</h2>
        <button
          onClick={() => navigate(rutaVolver)}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow max-w-xl mx-auto">

      <blockquote className="bg-gray-50 border-l-4 border-gray-300 p-3 text-sm text-gray-700 rounded">
        Lamentamos que decidas pausar tu participación. ¡Esperamos volver a verte pronto! 💚
        <br />Por favor, contanos brevemente el motivo de tu baja.
      </blockquote>

      <label className="block font-medium mt-4 mb-1">Buscar por teléfono</label>
      <input
        type="tel"
        className="w-full border p-2 rounded mb-3"
        placeholder="Ej: 3416123456"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <button
        onClick={buscar}
        disabled={loading || !config}
        className="px-4 py-2 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "Buscando..." : "Buscar"}
      </button>

      {(error || okMsg) && (
        <div className={`mt-4 text-sm font-medium ${error ? "text-red-600" : "text-emerald-700"}`}>
          {error || okMsg}
        </div>
      )}

      {alumnos.length > 0 && (
        <div id="resultado" className="mt-6">
          <h4 className="text-lg font-semibold mb-2">Resultados encontrados</h4>
          <ul id="listaAlumnos" className="space-y-2">
              {alumnos.map((a) => (
                <li key={a.matricula_id} className="flex items-center gap-3 border-b pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={a.selected}
                    onChange={() => toggleAlumno(a.matricula_id)}
                  />
                  <span className="text-gray-800">
                    {a.nombre} {a.apellido} — {a.curso || "Curso"} ({a.dia} {a.hora})
                  </span>
                </li>
              ))}
          </ul>

          <label className="block font-medium mt-4 mb-1">Motivo de baja</label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Escribí aquí el motivo..."
            className="w-full border p-2 rounded"
          />

          <button
            onClick={darDeBaja}
            disabled={processing}
            className="mt-3 px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {processing ? "Procesando..." : "Dar de baja seleccionados"}
          </button>
        </div>
      )}

      </div>
    </div>
  );
}
