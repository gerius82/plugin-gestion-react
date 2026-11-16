import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaUserSlash, FaWhatsapp } from "react-icons/fa";
import capLogo from "../assets/cap-logo.png";

const TURNOS_CAP = ["Lunes", "Miércoles", "Jueves", "Viernes"];
const HORA_CAP = "18:30";

const formularioInicial = {
  nombre: "",
  apellido: "",
  edad: "",
  adulto_responsable: "",
  telefono: "",
  dia: "Lunes",
};

const normalizarTelefono = (value) => String(value || "").replace(/\D/g, "").slice(-10);

export default function CapInscripciones() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [inscriptos, setInscriptos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const headers = (extra = {}) => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
    ...extra,
  });

  useEffect(() => {
    fetch("/config.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración.");
        return response.json();
      })
      .then(setConfig)
      .catch((currentError) => setError(currentError.message));
  }, []);

  const cargarInscriptos = async () => {
    if (!config) return;
    try {
      setCargando(true);
      setError("");
      const response = await fetch(
        `${config.supabaseUrl}/rest/v1/cap_inscripciones?select=id,nombre,apellido,edad,adulto_responsable,telefono,dia,hora,activo,lista_espera,creado_en&order=activo.desc,dia.asc,nombre.asc,apellido.asc`,
        { headers: headers() }
      );
      if (!response.ok) throw new Error("No se pudieron cargar las inscripciones de CAP.");
      const data = await response.json();
      const lista = Array.isArray(data) ? data : [];
      lista.sort((a, b) => {
        if ((a.activo !== false) !== (b.activo !== false)) return a.activo === false ? 1 : -1;
        const dia = TURNOS_CAP.indexOf(a.dia) - TURNOS_CAP.indexOf(b.dia);
        if (dia !== 0) return dia;
        return `${a.nombre || ""} ${a.apellido || ""}`.localeCompare(
          `${b.nombre || ""} ${b.apellido || ""}`,
          "es",
          { sensitivity: "base" }
        );
      });
      setInscriptos(lista);
    } catch (currentError) {
      setError(currentError.message || "No se pudieron cargar las inscripciones de CAP.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInscriptos();
  }, [config]);

  const activos = useMemo(() => inscriptos.filter((item) => item.activo !== false).length, [inscriptos]);

  const guardar = async (event) => {
    event.preventDefault();
    if (!config || guardando) return;

    const payload = {
      nombre: formulario.nombre.trim(),
      apellido: formulario.apellido.trim(),
      edad: formulario.edad === "" ? null : Number(formulario.edad),
      adulto_responsable: formulario.adulto_responsable.trim(),
      telefono: formulario.telefono.trim(),
      dia: formulario.dia,
      hora: HORA_CAP,
      activo: true,
    };
    if (
      !payload.nombre ||
      !payload.apellido ||
      !Number.isInteger(payload.edad) ||
      payload.edad < 0 ||
      payload.edad > 120 ||
      !payload.adulto_responsable ||
      normalizarTelefono(payload.telefono).length < 8
    ) {
      setError("Completá nombre, apellido, edad, adulto responsable y un teléfono válido.");
      return;
    }

    const duplicado = inscriptos.some((item) =>
      item.activo !== false &&
      normalizarTelefono(item.telefono) === normalizarTelefono(payload.telefono) &&
      String(item.nombre || "").trim().toLowerCase() === payload.nombre.toLowerCase() &&
      String(item.apellido || "").trim().toLowerCase() === payload.apellido.toLowerCase() &&
      item.dia === payload.dia
    );
    if (duplicado) {
      setError("Esta persona ya está inscripta en ese turno.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const response = await fetch(`${config.supabaseUrl}/rest/v1/cap_inscripciones`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.message || "No se pudo guardar la inscripción.");
      }
      setFormulario(formularioInicial);
      setMensaje("Inscripción guardada correctamente.");
      await cargarInscriptos();
    } catch (currentError) {
      setError(currentError.message || "No se pudo guardar la inscripción.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (inscripto) => {
    if (!config) return;
    const nuevoEstado = inscripto.activo === false;
    const accion = nuevoEstado ? "reactivar" : "inactivar";
    if (!window.confirm(`¿Querés ${accion} a ${inscripto.nombre} ${inscripto.apellido}?`)) return;
    try {
      setError("");
      const response = await fetch(
        `${config.supabaseUrl}/rest/v1/cap_inscripciones?id=eq.${encodeURIComponent(inscripto.id)}`,
        {
          method: "PATCH",
          headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({ activo: nuevoEstado, actualizado_en: new Date().toISOString() }),
        }
      );
      if (!response.ok) throw new Error(`No se pudo ${accion} la inscripción.`);
      setInscriptos((actuales) => actuales.map((item) =>
        item.id === inscripto.id ? { ...item, activo: nuevoEstado } : item
      ));
    } catch (currentError) {
      setError(currentError.message || `No se pudo ${accion} la inscripción.`);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-4 px-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/menu-gestion")}
          className="!flex !h-10 !w-10 items-center justify-center rounded-full border border-gray-200 !bg-white !p-0 text-gray-700 hover:!bg-gray-100"
          aria-label="Volver al menú de gestión"
        >
          <FaArrowLeft />
        </button>
        <div className="flex flex-1 items-center justify-center gap-3">
          <img src={capLogo} alt="Club Atlético Provincial" className="h-14 w-14 rounded-full object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CAP</h1>
            <p className="text-sm text-gray-500">Club Atlético Provincial</p>
          </div>
        </div>
        <div className="h-10 w-10" aria-hidden="true" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <form onSubmit={guardar} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Nueva inscripción</h2>
          <p className="mt-1 text-sm text-gray-500">Estos datos se podrán utilizar luego desde Avisos.</p>

          <label className="mt-5 block text-sm font-semibold text-gray-700" htmlFor="cap-nombre">Nombre</label>
          <input
            id="cap-nombre"
            value={formulario.nombre}
            onChange={(event) => setFormulario((current) => ({ ...current, nombre: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            autoComplete="given-name"
            required
          />

          <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="cap-apellido">Apellido</label>
          <input
            id="cap-apellido"
            value={formulario.apellido}
            onChange={(event) => setFormulario((current) => ({ ...current, apellido: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            autoComplete="family-name"
            required
          />

          <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="cap-edad">Edad</label>
          <input
            id="cap-edad"
            type="number"
            min="0"
            max="120"
            inputMode="numeric"
            value={formulario.edad}
            onChange={(event) => setFormulario((current) => ({ ...current, edad: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            required
          />

          <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="cap-responsable">Adulto responsable</label>
          <input
            id="cap-responsable"
            value={formulario.adulto_responsable}
            onChange={(event) => setFormulario((current) => ({ ...current, adulto_responsable: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            autoComplete="name"
            required
          />

          <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="cap-telefono">Teléfono</label>
          <input
            id="cap-telefono"
            type="tel"
            inputMode="tel"
            value={formulario.telefono}
            onChange={(event) => setFormulario((current) => ({ ...current, telefono: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            placeholder="341 123-4567"
            autoComplete="tel"
            required
          />

          <label className="mt-4 block text-sm font-semibold text-gray-700" htmlFor="cap-turno">Turno</label>
          <select
            id="cap-turno"
            value={formulario.dia}
            onChange={(event) => setFormulario((current) => ({ ...current, dia: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
          >
            {TURNOS_CAP.map((dia) => <option key={dia} value={dia}>{dia} · {HORA_CAP} hs</option>)}
          </select>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {mensaje && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{mensaje}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="mt-5 !flex !w-full items-center justify-center gap-2 rounded-lg !bg-red-600 px-4 py-3 font-semibold text-white hover:!bg-red-700 disabled:opacity-60"
          >
            <FaCheck /> {guardando ? "Guardando…" : "Guardar inscripción"}
          </button>
        </form>

        <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Inscriptos</h2>
              <p className="text-sm text-gray-500">Activos: {activos} · Total: {inscriptos.length}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/avisos?grupo=cap")}
              className="!inline-flex !w-auto items-center gap-2 rounded-lg !bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:!bg-green-700"
            >
              <FaWhatsapp /> Avisos CAP
            </button>
          </div>

          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando inscriptos…</p>
          ) : inscriptos.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Todavía no hay inscriptos en CAP.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Alumno</th>
                    <th className="px-3 py-2">Edad</th>
                    <th className="px-3 py-2">Adulto responsable</th>
                    <th className="px-3 py-2">Teléfono</th>
                    <th className="px-3 py-2">Turno</th>
                    <th className="px-3 py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {inscriptos.map((inscripto) => (
                    <tr key={inscripto.id} className={`border-t ${inscripto.activo === false ? "opacity-55" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{inscripto.nombre} {inscripto.apellido}</td>
                      <td className="whitespace-nowrap px-3 py-3">{inscripto.edad ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{inscripto.adulto_responsable || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3">{inscripto.telefono}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {inscripto.dia} · {inscripto.hora} hs
                        {inscripto.lista_espera && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Lista de espera
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => cambiarEstado(inscripto)}
                          className={`!inline-flex !w-auto items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                            inscripto.activo === false
                              ? "border-green-200 !bg-green-50 text-green-700 hover:!bg-green-100"
                              : "border-red-200 !bg-red-50 text-red-700 hover:!bg-red-100"
                          }`}
                        >
                          {inscripto.activo === false ? <FaCheck /> : <FaUserSlash />}
                          {inscripto.activo === false ? "Reactivar" : "Inactivar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
