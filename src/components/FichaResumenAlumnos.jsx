import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const calcularEdadDesdeFecha = (fechaIso) => {
  const raw = String(fechaIso || "").trim();
  if (!raw) return null;
  const base = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
  const fecha = new Date(`${base}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad >= 0 ? edad : null;
};

export default function FichaResumenAlumnos() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [todosAlumnosMap, setTodosAlumnosMap] = useState({});
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroHora, setFiltroHora] = useState("");
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [ordenColumna, setOrdenColumna] = useState("creado_en");
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [filtroCiclo, setFiltroCiclo] = useState("");
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [error, setError] = useState("");
  

  useEffect(() => {
    fetch("/config.json")
      .then(res => res.json())
      .then(cfg => setConfig(cfg));
  }, []);

  useEffect(() => {
    if (!config) return;
    cargarDatos();
  }, [config, filtroEstado, filtroSede, filtroDia, filtroHora, filtroCiclo, ordenColumna, ordenAscendente]);

  async function cargarDatos() {
    const headers = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };

    setError("");
    const allRes = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido`, { headers });
    const allData = await allRes.json();
    const map = Object.fromEntries(allData.map(a => [a.id, `${a.nombre} ${a.apellido}`]));
    setTodosAlumnosMap(map);

    const cicloRes = await fetch(
      `${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`,
      { headers }
    );
    const cicloData = await cicloRes.json();
    setCiclosDisponibles(Array.isArray(cicloData) ? cicloData : []);
    const ciclosVeranoSet = new Set(
      (Array.isArray(cicloData) ? cicloData : [])
        .filter((c) =>
          String(c?.codigo || "").toLowerCase().includes("verano") ||
          String(c?.nombre_publico || "").toLowerCase().includes("verano")
        )
        .map((c) => String(c.codigo))
    );

    const anioActual = new Date().getFullYear();
    const desde = `${anioActual}-01-01T00:00:00.000Z`;
    const hasta = `${anioActual + 1}-01-01T00:00:00.000Z`;
    const pagosRes = await fetch(
      `${config.supabaseUrl}/rest/v1/pagos?select=alumno_id,pago_inscripcion&creado_en=gte.${encodeURIComponent(desde)}&creado_en=lt.${encodeURIComponent(hasta)}`,
      { headers }
    );
    const pagosData = pagosRes.ok ? await pagosRes.json() : [];
    const inscripcionesPagasSet = new Set(
      (Array.isArray(pagosData) ? pagosData : [])
        .filter((p) => p?.pago_inscripcion)
        .map((p) => String(p.alumno_id))
    );
    const veranoActivoRes = await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?select=alumno_id,ciclo_codigo,estado&estado=eq.activa`,
      { headers }
    );
    const veranoActivoData = veranoActivoRes.ok ? await veranoActivoRes.json() : [];
    const veranoActivoSet = new Set(
      (Array.isArray(veranoActivoData) ? veranoActivoData : [])
        .filter((m) =>
          ciclosVeranoSet.has(String(m?.ciclo_codigo || "")) ||
          String(m?.ciclo_codigo || "").toLowerCase().includes("verano")
        )
        .map((m) => String(m.alumno_id))
    );

    const filtros = [];
    if (filtroEstado === "activos") filtros.push("estado=eq.activa");
    if (filtroEstado === "inactivos") filtros.push("estado=in.(baja,finalizada)");
    if (filtroSede) filtros.push(`sede=eq.${encodeURIComponent(filtroSede)}`);
    if (filtroCiclo) filtros.push(`ciclo_codigo=eq.${encodeURIComponent(filtroCiclo)}`);
    const filtro = filtros.length ? `&${filtros.join("&")}` : "";
    const alumnosRes = await fetch(
      `${config.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,ciclo_codigo,sede,dia,hora,curso_nombre,estado,lista_espera,creado_en,inscripciones(id,nombre,apellido,fecha_nacimiento,edad,escuela,responsable,telefono,email,creado_en,tiene_promo,beneficiario_id,curso)${filtro}`,
      { headers }
    );
    if (!alumnosRes.ok) {
      const err = await alumnosRes.json().catch(() => ({}));
      setError(err?.message || "No pude cargar los alumnos.");
      setAlumnos([]);
      return;
    }
    let data = await alumnosRes.json();

    data = (Array.isArray(data) ? data : []).map(a => ({
      id: a.id,
      alumno_id: a.alumno_id,
      ciclo_codigo: a.ciclo_codigo,
      sede: a.sede,
      dia: a.dia,
      hora: a.hora,
      turno_1: `${a.dia} ${a.hora}`,
      nombre: a.inscripciones?.nombre || "",
      apellido: a.inscripciones?.apellido || "",
      fecha_nacimiento: a.inscripciones?.fecha_nacimiento || "",
      edad:
        calcularEdadDesdeFecha(a.inscripciones?.fecha_nacimiento) ??
        a.inscripciones?.edad ??
        null,
      escuela: a.inscripciones?.escuela || "",
      responsable: a.inscripciones?.responsable || "",
      telefono: a.inscripciones?.telefono || "",
      email: a.inscripciones?.email || "",
      creado_en: a.creado_en || a.inscripciones?.creado_en || "",
      tiene_promo: a.inscripciones?.tiene_promo,
      lista_espera: a.lista_espera,
      curso: a.curso_nombre || a.inscripciones?.curso || "",
      inscripcion_paga: inscripcionesPagasSet.has(String(a.alumno_id)),
      tiene_verano_activo: veranoActivoSet.has(String(a.alumno_id)),
      beneficiario_nombre:
        a.inscripciones?.beneficiario_id && map[a.inscripciones?.beneficiario_id]
          ? map[a.inscripciones?.beneficiario_id]
          : "-",
    }));

    const horas = [
      ...new Set(
        data
          .filter((a) => (!filtroDia || a.dia === filtroDia))
          .map((a) => a.hora)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    setHorasDisponibles(horas);

    const dataFiltradaPorDia = filtroDia
      ? data.filter((a) => a.dia === filtroDia)
      : data;
    const dataFiltrada = filtroHora
      ? dataFiltradaPorDia.filter((a) => a.hora === filtroHora)
      : dataFiltradaPorDia;

    dataFiltrada.sort((a, b) => {
      const valA = a[ordenColumna];
      const valB = b[ordenColumna];
      if (typeof valA === "string" && typeof valB === "string") {
        return valA.localeCompare(valB) * (ordenAscendente ? 1 : -1);
      }
      return (valA > valB ? 1 : -1) * (ordenAscendente ? 1 : -1);
    });

    setAlumnos(dataFiltrada);

    const diasOrden = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
    const normalizar = (valor) =>
      String(valor || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const dias = [...new Set(data.map((a) => a.dia).filter(Boolean))].sort(
      (a, b) =>
        diasOrden.findIndex((d) => normalizar(d) === normalizar(a)) -
        diasOrden.findIndex((d) => normalizar(d) === normalizar(b))
    );
    setDiasDisponibles(dias);

  }

  const handleOrden = (col) => {
    if (ordenColumna === col) {
      setOrdenAscendente(!ordenAscendente);
    } else {
      setOrdenColumna(col);
      setOrdenAscendente(true);
    }
  };

  const iconoOrden = () => "";
  const formatFecha = (valor) => {
    const raw = String(valor || "").trim();
    if (!raw) return "-";
    const base = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
    const [yyyy, mm, dd] = base.split("-");
    if (!yyyy || !mm || !dd) return raw;
    return `${dd}-${mm}-${yyyy}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-full mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Resumen de Alumnos</h2>
        <button
          onClick={() => navigate("/alumnos-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>
      <div className="bg-white rounded-xl shadow p-6 max-w-full mx-auto">

      {error && (
        <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
      )}

      

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Estado */}
        <div>
          <label className="block font-medium mb-1">Estado:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {/* Ciclo */}
        <div>
          <label className="block font-medium mb-1">Ciclo:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroCiclo}
            onChange={(e) => {
              setFiltroCiclo(e.target.value);
              setFiltroDia("");
              setFiltroHora("");
            }}
          >
            <option value="">Todos</option>
            {ciclosDisponibles.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre_publico || c.codigo}
              </option>
            ))}
          </select>
        </div>

        {/* Sede */}
        <div>
          <label className="block font-medium mb-1">Sede:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroSede}
            onChange={(e) => {
              setFiltroSede(e.target.value);
              setFiltroDia("");
              setFiltroHora("");
            }}
          >
            <option value="">Todas</option>
            <option value="Calle Mendoza">Calle Mendoza</option>
            <option value="Fisherton">Fisherton</option>
          </select>
        </div>

        {/* Dia */}
        <div>
          <label className="block font-medium mb-1">Dia:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroDia}
            onChange={(e) => {
              setFiltroDia(e.target.value);
              setFiltroHora("");
            }}
          >
            <option value="">Todos</option>
            {diasDisponibles.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Horario */}
        <div>
          <label className="block font-medium mb-1">Horario:</label>
          <select
            className="w-full border p-2 rounded"
            value={filtroHora}
            onChange={(e) => setFiltroHora(e.target.value)}
            disabled={!filtroDia && !filtroSede}
          >
            <option value="">Todos</option>
            {horasDisponibles.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>


      <div className="mb-4 flex gap-6 text-sm text-gray-700 font-medium">
        <span>Total: <strong>{alumnos.length}</strong></span>
        <span>Con promo: <strong>{alumnos.filter(a => a.tiene_promo).length}</strong></span>
      </div>


      <div className="overflow-auto max-h-[70vh] border rounded">
        <table className="min-w-full text-sm border-t border-b text-left">
        <thead className="bg-gray-100 sticky top-0 z-20">
            <tr>
                {[
                ["creado_en", "Fecha"],
                ["inscripcion_paga", "Inscripción"],
                ["nombre", "Nombre"],
                ["fecha_nacimiento", "Fecha nacimiento"],
                ["edad", "Edad"],
                ["sede", "Sede"],
                ["turno_1", "Turno"],
                ["curso", "Curso"],
                ["tiene_promo", "Promo"],
                ["beneficiario_nombre", "Beneficiario"],
                ["lista_espera", "Espera"],
                ["ficha", "Ficha"],
                ["escuela", "Escuela"],
                ["responsable", "Responsable"],
                ["telefono", "Teléfono"],
                ["email", "Email"],
                ].map(([key, label]) => (
                <th
                    key={key}
                    onClick={() => key !== "ficha" && handleOrden(key)}
                    style={{ cursor: key !== "ficha" ? "pointer" : "default" }}
                    className={`px-3 py-2 ${
                    ["inscripcion_paga", "tiene_promo", "lista_espera", "ficha"].includes(key)
                        ? "text-center"
                        : "text-left"
                    }`}
                >
                    {label}
                </th>
                ))}
            </tr>
        </thead>

        <tbody>
            {alumnos.map((a) => (
                <tr key={a.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(a.creado_en).toLocaleDateString("es-AR")}
                </td>
                <td className="px-3 py-2 text-center">{a.inscripcion_paga ? "✅" : ""}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${a.tiene_verano_activo ? "text-red-600 font-semibold" : ""}`}>
                    {a.nombre} {a.apellido}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatFecha(a.fecha_nacimiento)}</td>
                <td className="px-3 py-2">{a.edad}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.sede}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.turno_1}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.curso}</td>
                <td className="px-3 py-2 text-center">{a.tiene_promo ? "✅" : ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                    {a.beneficiario_nombre}
                </td>
                <td className="px-3 py-2 text-center">
                    <span
                    className={`inline-block w-3 h-3 rounded-full ${
                        a.lista_espera ? "bg-red-500" : "bg-green-500"
                    }`}
                    title={a.lista_espera ? "En lista de espera" : "Confirmado"}
                    ></span>
                </td>
                <td className="px-3 py-2 text-center">
                    <Link to={`/ficha-alumno/${a.alumno_id}`} title="Ver ficha individual">
                    {"\u{1F4C4}"}
                    </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{a.escuela}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.responsable}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.telefono}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.email}</td>
                </tr>
            ))}
        </tbody>

        </table>
      </div>

      </div>
    </div>
  );
}
