import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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

const toHeaders = (cfg) => ({
  apikey: cfg?.supabaseKey,
  Authorization: `Bearer ${cfg?.supabaseKey}`,
  "Content-Type": "application/json",
});

export default function FichaPagos() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from") || "menu-gestion"}`;

  const [config, setConfig] = useState(null);
  const [cursosMap, setCursosMap] = useState({});
  const [matriculas, setMatriculas] = useState([]);

  const [matriculaId, setMatriculaId] = useState("");
  const [pagaMes, setPagaMes] = useState(false);
  const [pagaInscripcion, setPagaInscripcion] = useState(false);
  const [mes, setMes] = useState("");
  const [medioPago, setMedioPago] = useState("efectivo");
  const [mensaje, setMensaje] = useState("");
  const [grupoId, setGrupoId] = useState(null);
  const [grupoIntegrantes, setGrupoIntegrantes] = useState([]);
  const [grupoDescuento, setGrupoDescuento] = useState(null);
  const [pagarGrupo, setPagarGrupo] = useState(false);
  const [cargando, setCargando] = useState(true);

  const matriculaSel = matriculas.find((m) => String(m.id) === String(matriculaId));
  const alumno = matriculaSel?.inscripciones;
  const curso = cursosMap[matriculaSel?.curso_id];

  const headers = useMemo(() => toHeaders(config), [config]);

  useEffect(() => {
    const cargar = async () => {
      try {
        const cfg = await (await fetch("/config.json")).json();
        setConfig(cfg);

        const [resCursos, resMat] = await Promise.all([
          fetch(`${cfg.supabaseUrl}/rest/v1/cursos?select=id,nombre,precio_curso,precio_inscripcion&activo=eq.true`, {
            headers: toHeaders(cfg),
          }),
          fetch(
            `${cfg.supabaseUrl}/rest/v1/matriculas?select=id,alumno_id,curso_id,estado,inscripciones(nombre,apellido,telefono,tiene_promo)&estado=eq.activa`,
            { headers: toHeaders(cfg) }
          ),
        ]);

        const cursos = await resCursos.json();
        const map = {};
        (Array.isArray(cursos) ? cursos : []).forEach((c) => {
          map[c.id] = c;
        });
        setCursosMap(map);

        const mats = await resMat.json();
        setMatriculas(Array.isArray(mats) ? mats : []);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  useEffect(() => {
    if (!matriculaId) return;
    const ahora = new Date();
    setMes(MESES[ahora.getMonth()]);
    setPagaMes(true);
    setPagaInscripcion(false);
    setMedioPago("transferencia");
    setPagarGrupo(false);
  }, [matriculaId]);

  useEffect(() => {
    const cargarGrupo = async () => {
      setGrupoId(null);
      setGrupoIntegrantes([]);
      setGrupoDescuento(null);
      if (!config || !matriculaSel?.alumno_id) return;

      const headersLocal = toHeaders(config);
      try {
        // 1) obtener grupo_id del alumno
        const resGrupo = await fetch(
          `${config.supabaseUrl}/rest/v1/promos_grupo?select=grupo_id&alumno_id=eq.${matriculaSel.alumno_id}&limit=1`,
          { headers: headersLocal }
        );
        const gData = await resGrupo.json();
        const gId = gData?.[0]?.grupo_id || null;
        setGrupoId(gId);
        if (!gId) {
          setGrupoIntegrantes([]);
          return;
        }

        // 2) obtener todos los integrantes del grupo
        const resMiembros = await fetch(
          `${config.supabaseUrl}/rest/v1/promos_grupo?select=alumno_id,descuento_pct&grupo_id=eq.${gId}`,
          { headers: headersLocal }
        );
        const miembros = await resMiembros.json();
        const ids = (Array.isArray(miembros) ? miembros : [])
          .map((m) => m.alumno_id)
          .filter(Boolean);
        const desc = Array.isArray(miembros) && miembros.length
          ? Number(miembros[0]?.descuento_pct)
          : null;
        setGrupoDescuento(Number.isFinite(desc) ? desc : null);
        if (!ids.length) {
          setGrupoIntegrantes([]);
          return;
        }

        const filtro = ids.map((id) => `id.eq.${id}`).join(",");
        const resIns = await fetch(
          `${config.supabaseUrl}/rest/v1/inscripciones?select=id,nombre,apellido&or=(${filtro})`,
          { headers: headersLocal }
        );
        const insData = await resIns.json();
        setGrupoIntegrantes(Array.isArray(insData) ? insData : []);
      } catch (err) {
        console.error("Error cargando grupo promo", err);
        setGrupoIntegrantes([]);
      }
    };

    cargarGrupo();
  }, [config, matriculaSel?.alumno_id]);

  const calcularTotal = () => {
    if (!curso) return 0;
    const pct = Number.isFinite(grupoDescuento) ? Math.max(0, Math.min(100, grupoDescuento)) : null;
    const factorPromo =
      grupoIntegrantes.length >= 2
        ? pct != null
          ? 1 - pct / 100
          : 0.9
        : 1;
    const cantidad = grupoIntegrantes.length >= 2 && pagarGrupo ? grupoIntegrantes.length : 1;
    let monto = 0;
    if (pagaMes) monto += Number(curso.precio_curso || 0) * factorPromo;
    if (pagaInscripcion) monto += Number(curso.precio_inscripcion || 0) * factorPromo;
    return monto * cantidad;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!config || !matriculaSel || (!pagaMes && !pagaInscripcion) || (pagaMes && !mes)) {
      setMensaje("Faltan datos requeridos.");
      return;
    }

    const total = calcularTotal();
    const idsGrupo =
      grupoIntegrantes.length >= 2 && pagarGrupo
        ? Array.from(new Set(grupoIntegrantes.map((g) => g.id).filter(Boolean)))
        : [matriculaSel.alumno_id];
    const payloads = idsGrupo.map((alumnoId) => ({
      alumno_id: alumnoId,
      mes: pagaMes ? mes : "N/A",
      pago_mes: pagaMes,
      pago_inscripcion: pagaInscripcion,
      medio_pago: medioPago,
      monto_total: Math.round(total / idsGrupo.length),
    }));

    try {
      const results = await Promise.all(
        payloads.map((body) =>
          fetch(`${config.supabaseUrl}/rest/v1/pagos`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          })
        )
      );
      const allOk = results.every((r) => r.ok);
      if (!allOk) {
        const errTxt = await results.find((r) => !r.ok)?.text();
        setMensaje(`Error al registrar pago: ${errTxt || "Error"}`);
        return;
      }
    } catch (err) {
      setMensaje(`Error al registrar pago: ${err}`);
      return;
    }

    setMensaje("✅ Pago registrado con éxito");
    setTimeout(() => {
      setMensaje("");
      setMatriculaId("");
      setPagaMes(false);
      setPagaInscripcion(false);
      setMes("");
      setMedioPago("efectivo");
    }, 2000);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-3xl font-bold text-center mb-6">Ficha de Pagos</h2>

      {cargando ? (
        <p className="text-center text-gray-600">Cargando...</p>
      ) : (
        <>
          <div className="mb-4">
            <label className="block font-semibold mb-1">Seleccionar alumno / curso:</label>
            <select
              className="w-full border border-gray-300 rounded p-2"
              value={matriculaId}
              onChange={(e) => setMatriculaId(e.target.value)}
            >
              <option value="">-- Seleccionar --</option>
              {[...matriculas]
                .sort((a, b) =>
                  `${a.inscripciones?.nombre || ""} ${a.inscripciones?.apellido || ""}`.localeCompare(
                    `${b.inscripciones?.nombre || ""} ${b.inscripciones?.apellido || ""}`
                  )
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.inscripciones?.nombre} {m.inscripciones?.apellido}
                    {m.curso_id && cursosMap[m.curso_id]?.nombre
                      ? ` — ${cursosMap[m.curso_id].nombre}`
                      : ""}
                  </option>
                ))}
            </select>
          </div>

          {matriculaSel && alumno && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg shadow mb-4 text-sm space-y-1">
                <p>
                  <strong>Alumno:</strong> {alumno.nombre} {alumno.apellido}
                </p>
                <p>
                  <strong>Curso:</strong> {curso?.nombre || "-"}
                </p>
                <p>
                  <strong>Cuota mensual:</strong>{" "}
                  {curso?.precio_curso != null ? `$${Number(curso.precio_curso).toLocaleString()}` : "—"}
                </p>
                <p>
                  <strong>Inscripción:</strong>{" "}
                  {curso?.precio_inscripcion != null
                    ? `$${Number(curso.precio_inscripcion).toLocaleString()}`
                    : "—"}
                </p>
                <div className="pt-1">
                  <strong>Promo grupo:</strong>{" "}
                  {grupoIntegrantes.length >= 2 ? (
                    <span className="text-green-700 font-medium">
                      {grupoIntegrantes
                        .map((g) => `${g.nombre || ""} ${g.apellido || ""}`.trim())
                        .join(", ")}
                      {grupoDescuento != null ? ` • ${grupoDescuento}% off` : " • 10% off"}
                    </span>
                  ) : (
                    <span className="text-gray-600">Sin grupo de promo</span>
                  )}
                </div>

                {grupoIntegrantes.length >= 2 && (
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={pagarGrupo}
                      onChange={(e) => setPagarGrupo(e.target.checked)}
                    />
                    <span>
                      Pagar grupo completo ({grupoIntegrantes.length} alumnos)
                    </span>
                  </label>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="flex items-center gap-3 p-2 bg-gray-50 rounded shadow-sm border hover:bg-gray-100 transition cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    checked={pagaMes}
                    onChange={(e) => setPagaMes(e.target.checked)}
                  />
                  <span className="font-medium text-gray-800">Paga mes</span>
                </label>

                {pagaMes && (
                  <select
                    className="w-full border border-gray-300 rounded p-2"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                  >
                    <option value="">-- Seleccionar mes --</option>
                    {MESES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                )}

                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded shadow-sm border border-gray-200 hover:bg-gray-100 transition cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    checked={pagaInscripcion}
                    onChange={(e) => setPagaInscripcion(e.target.checked)}
                  />
                  <span className="font-medium text-gray-800">Paga inscripción</span>
                </label>

                <div>
                  <label className="block font-medium mb-1">Medio de pago:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="medioPago"
                        value="efectivo"
                        checked={medioPago === "efectivo"}
                        onChange={() => setMedioPago("efectivo")}
                      />
                      Efectivo
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="medioPago"
                        value="transferencia"
                        checked={medioPago === "transferencia"}
                        onChange={() => setMedioPago("transferencia")}
                      />
                      Transferencia
                    </label>
                  </div>
                </div>

                <div className="text-center text-xl font-bold text-green-600 mt-4">
                  Total: ${calcularTotal().toLocaleString()}
                </div>

                {mensaje && (
                  <div className="mb-4 text-center text-green-800 font-semibold bg-green-100 border border-green-300 px-4 py-3 rounded shadow">
                    {mensaje}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded shadow"
                >
                  Registrar pago
                </button>
              </form>
            </>
          )}
        </>
      )}

      <div className="text-center mt-6">
        <button
          onClick={() => navigate(from)}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-6 rounded shadow-md transition hover:scale-105"
        >
          ← Volver al menú
        </button>
      </div>
    </div>
  );
}
