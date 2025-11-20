import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FichaPagos = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from")}`;

  

  const [config, setConfig] = useState(null);
  const [valores, setValores] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [alumnoId, setAlumnoId] = useState("");
  const [pagaMes, setPagaMes] = useState(false);
  const [pagaInscripcion, setPagaInscripcion] = useState(false);
  const [mes, setMes] = useState("");
  const [medioPago, setMedioPago] = useState("efectivo");
  const [mensaje, setMensaje] = useState("");

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  useEffect(() => {
    const cargar = async () => {
      const cfg = await (await fetch("/config.json")).json();
      const vals = await (await fetch("/valores.json")).json();
      const res = await fetch(`${cfg.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=id,nombre,apellido,telefono,tiene_promo`, {
        headers: {
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
        },
      });
      const data = await res.json();
      setConfig(cfg);
      setValores(vals);
      setAlumnos(data);
    };
    cargar();
  }, []);

    const alumno = alumnos.find((a) => a.id === alumnoId);
    useEffect(() => {
        if (!alumnoId) return;
    
        setPagaMes(true);
    
        const ahora = new Date();
        const nombreMes = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ][ahora.getMonth()];
        setMes(nombreMes);
    
        setMedioPago("transferencia");
    }, [alumnoId]);

  const hermanosPromo = alumno
    ? alumnos.filter(
        (a) =>
          a.id !== alumno.id &&
          a.tiene_promo &&
          a.telefono === alumno.telefono &&
          a.apellido === alumno.apellido
      )
    : [];

  const calcularTotal = () => {
    if (!alumno) return 0;
    let monto = 0;
    if (pagaMes) {
      monto += alumno.tiene_promo ? valores.cuota_promo : valores.cuota_normal;
      if (alumno.tiene_promo && hermanosPromo.length) monto += valores.cuota_promo;
    }
    if (pagaInscripcion) {
      monto += alumno.tiene_promo ? valores.inscripcion_promo : valores.inscripcion_normal;
      if (alumno.tiene_promo && hermanosPromo.length) monto += valores.inscripcion_promo;
    }
    return monto;
  };

  const calcularMontoIndividual = (al, pagaMes, pagaInscripcion) => {
    if (!al || !valores) return 0;
    let monto = 0;
    if (pagaMes)        monto += al.tiene_promo ? valores.cuota_promo       : valores.cuota_normal;
    if (pagaInscripcion) monto += al.tiene_promo ? valores.inscripcion_promo : valores.inscripcion_normal;
    return monto;
  };
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alumno || (!pagaMes && !pagaInscripcion) || (pagaMes && !mes)) {
      alert("Faltan datos requeridos.");
      return;
    }
    const headers = {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      "Content-Type": "application/json",
    };

    const pagos = [];

    if (pagaMes) {
      pagos.push({
        alumno_id: alumno.id,
        mes,
        pago_mes: true,
        pago_inscripcion: false,
        medio_pago: medioPago,
        monto_total: calcularMontoIndividual(alumno, true, false),
      });
      if (alumno.tiene_promo && hermanosPromo.length) {
        pagos.push({
          alumno_id: hermanosPromo[0].id,
          mes,
          pago_mes: true,
          pago_inscripcion: false,
          medio_pago: medioPago,
          monto_total: valores.cuota_promo,
        });
      }
    }

    if (pagaInscripcion) {
      pagos.push({
        alumno_id: alumno.id,
        mes: "N/A",
        pago_mes: false,
        pago_inscripcion: true,
        medio_pago: medioPago,
        monto_total: calcularMontoIndividual(alumno, true, false),
      });
      if (alumno.tiene_promo && hermanosPromo.length) {
        pagos.push({
          alumno_id: hermanosPromo[0].id,
          mes: "N/A",
          pago_mes: false,
          pago_inscripcion: true,
          medio_pago: medioPago,
          monto_total: valores.inscripcion_promo,
        });
      }
    }

    const errores = [];
    for (const pago of pagos) {
      const res = await fetch(`${config.supabaseUrl}/rest/v1/pagos`, {
        method: "POST",
        headers,
        body: JSON.stringify(pago),
      });
      if (!res.ok) errores.push(await res.text());
    }

    if (errores.length) {
      alert("Error al registrar pagos:\n" + errores.join("\n"));
    } else {
      setMensaje("✅ Pago registrado con éxito");
      setTimeout(() => {
        setMensaje("");
        setAlumnoId("");
        setPagaMes(false);
        setPagaInscripcion(false);
        setMes("");
        setMedioPago("efectivo");
      }, 3000);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-3xl font-bold text-center mb-6">Ficha de Pagos</h2>

      <div className="mb-4">
        <label className="block font-semibold mb-1">Seleccionar alumno:</label>
        <select
          className="w-full border border-gray-300 rounded p-2"
          value={alumnoId}
          onChange={(e) => setAlumnoId(e.target.value)}
        >
          <option value="">-- Seleccionar --</option>
          {[...alumnos]
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((a) => (
                <option key={a.id} value={a.id}>
                {a.nombre} {a.apellido}
                </option>
            ))}

        </select>
      </div>

      {alumno && (
        <>
          <div className="bg-gray-50 p-4 rounded-lg shadow mb-4">
            <p><strong>Alumno:</strong> {alumno.nombre} {alumno.apellido}</p>
            <p><strong>Promo:</strong> {alumno.tiene_promo ? <span className="text-green-700 font-semibold">✅ Activa</span> : "No"}</p>
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
                {meses.map((m) => (
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
                  <input type="radio" name="medioPago" value="efectivo" checked={medioPago === "efectivo"} onChange={() => setMedioPago("efectivo")} />
                  Efectivo
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="medioPago" value="transferencia" checked={medioPago === "transferencia"} onChange={() => setMedioPago("transferencia")} />
                  Transferencia
                </label>
              </div>
            </div>

            <div className="text-center text-xl font-bold text-green-600 mt-4">
              Total: ${calcularTotal().toLocaleString()}
            </div>

            {mensaje && (
            <div className="mb-4 text-center text-green-800 font-semibold bg-green-100 border border-green-300 px-4 py-3 rounded shadow animate-fade-in-out">
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
};

export default FichaPagos;
