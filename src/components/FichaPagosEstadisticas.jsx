// FichaPagosEstadisticas.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const FichaPagosEstadisticas = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [matriculasMap, setMatriculasMap] = useState({});
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [cicloFiltro, setCicloFiltro] = useState("");
  const mesesBase = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const mesIndex = useMemo(
    () =>
      mesesBase.reduce((acc, m, idx) => {
        acc[m] = idx;
        return acc;
      }, {}),
    []
  );
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const ahora = new Date();
    return mesesBase[ahora.getMonth()];
  });
  const [medioPago, setMedioPago] = useState("todos");
  const [orden, setOrden] = useState("nombre");
  const [ascendente, setAscendente] = useState(true);

  const MES_INSCRIPCION = "Inscripción";

  const meses = [
    ...mesesBase,
    MES_INSCRIPCION
  ];

  useEffect(() => {
    (async () => {
      const res = await fetch("/config.json");
      const json = await res.json();
      setConfig(json);
    })();
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      const headers = {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      };

      const [resAlu, resMat, resCiclos] = await Promise.all([
        fetch(`${config.supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=*`, {
          headers,
        }),
        fetch(`${config.supabaseUrl}/rest/v1/matriculas?select=alumno_id,ciclo_codigo,estado,fecha_inicio,creado_en&estado=eq.activa`, {
          headers,
        }),
        fetch(`${config.supabaseUrl}/rest/v1/ciclos?select=codigo,nombre_publico,activo,orden&order=orden.asc`, {
          headers,
        }),
      ]);

      const dataAlu = await resAlu.json();
      setAlumnos(Array.isArray(dataAlu) ? dataAlu : []);

      const dataMat = await resMat.json();
      const map = {};
      (Array.isArray(dataMat) ? dataMat : []).forEach((m) => {
        if (!m.alumno_id || !m.ciclo_codigo || String(m.estado).toLowerCase() !== "activa") return;
        const fecha = m.fecha_inicio || m.creado_en;
        const d = fecha ? new Date(fecha) : null;
        const startMonth = d && !isNaN(d) ? d.getMonth() : null;
        map[m.alumno_id] = map[m.alumno_id] || [];
        map[m.alumno_id].push({ ciclo: m.ciclo_codigo, startMonth });
      });
      setMatriculasMap(map);

      const dataCiclos = await resCiclos.json();
      const listaCiclos = Array.isArray(dataCiclos) ? dataCiclos : [];
      setCiclosDisponibles(listaCiclos);
    })();
  }, [config]);

  useEffect(() => {
    if (!config || !mesSeleccionado) return;
    (async () => {
      const headers = {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      };

      let filtro = "";
      if (mesSeleccionado === MES_INSCRIPCION) {
        filtro = "pago_inscripcion=eq.true";
      } else {
        filtro = `mes=eq.${mesSeleccionado}&pago_mes=eq.true`;
      }
      if (medioPago !== "todos") filtro += `&medio_pago=eq.${medioPago}`;

      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/pagos?select=alumno_id,mes,pago_mes,pago_inscripcion,medio_pago&${filtro}`,
        { headers }
      );
      const data = await res.json();
      setPagos(Array.isArray(data) ? data : []);
    })();
  }, [config, mesSeleccionado, medioPago]);

  const pagosMap = useMemo(() => {
    const map = new Map();
    for (const p of pagos) map.set(p.alumno_id, p.medio_pago || true);
    return map;
  }, [pagos]);

  const alumnosConEstado = useMemo(() => {
    const list = alumnos
      .filter((a) => {
        const mats = matriculasMap[a.id] || [];
        if (mats.length === 0) return false; // solo alumnos con al menos una matrícula activa
        const matsPorCiclo = cicloFiltro ? mats.filter((m) => m.ciclo === cicloFiltro) : mats;
        if (matsPorCiclo.length === 0) return false;

        if (mesSeleccionado === MES_INSCRIPCION) return true;
        const idxSel = mesIndex[mesSeleccionado];
        if (idxSel === undefined) return true;
        // Corresponde pagar si el inicio es este mes o anterior
        return matsPorCiclo.some(
          (m) => m.startMonth == null || m.startMonth <= idxSel
        );
      })
      .map((a) => ({
        ...a,
        pago: pagosMap.has(a.id),
        medio_pago: pagosMap.get(a.id) || null,
      }));
    return medioPago === "todos"
      ? list
      : list.filter((a) => a.medio_pago === medioPago);
  }, [alumnos, pagosMap, medioPago, matriculasMap, cicloFiltro]);

  const alumnosOrdenados = useMemo(() => {
    const arr = [...alumnosConEstado];
    if (orden === "nombre") {
      arr.sort((a, b) =>
        ascendente ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre)
      );
    } else {
      arr.sort((a, b) =>
        ascendente ? Number(b.pago) - Number(a.pago) : Number(a.pago) - Number(b.pago)
      );
    }
    return arr;
  }, [alumnosConEstado, orden, ascendente]);

  const { pagados, noPagados } = useMemo(() => {
    const p = alumnosConEstado.filter((a) => a.pago).length;
    return { pagados: p, noPagados: alumnosConEstado.length - p };
  }, [alumnosConEstado]);

  const generarComprobante = async (alumnoId) => {
  const alumno = alumnos.find(a => a.id === alumnoId);
  if (!alumno || !config) return;

  const resPago = await fetch(`${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${alumnoId}&mes=eq.${mesSeleccionado}&pago_mes=eq.true&select=medio_pago,pago_inscripcion,pago_mes,mes,monto_total`, {
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    },
  });

  const [pago] = await resPago.json();
  if (!pago) {
    alert("No se encontró información de pago.");
    return;
  }

  let montoTotal = pago.monto_total;
  let nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;

  if (alumno.tiene_promo) {
    const hermanos = alumnos.filter(a =>
      a.id !== alumnoId &&
      a.telefono === alumno.telefono &&
      a.tiene_promo
    );
    if (hermanos.length > 0) {
      nombreCompleto = `${alumno.nombre} y ${hermanos[0].nombre} ${alumno.apellido}`;
      montoTotal *= 2;
    }
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [90, 140] });

  const logoImg = new Image();
  logoImg.src = "/Logo_Plugin_2025.png";
  await new Promise(res => (logoImg.onload = res));

  const aspectRatio = logoImg.height / logoImg.width;
  const desiredWidth = 40;
  const desiredHeight = desiredWidth * aspectRatio;
  doc.addImage(logoImg, "PNG", 25, 10, desiredWidth, desiredHeight);

  doc.setDrawColor(150);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 35, 85, 35);
  doc.line(5, 43, 85, 43);

  doc.setFontSize(14);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(0);
  doc.text("COMPROBANTE DE PAGO", 45, 41, { align: "center" });

  let y = 50;
  const label = "Helvetica";
  doc.setFontSize(11);
  doc.setFont(label, "bold");
  doc.text("Recibí de:", 5, y);
  doc.setFont(label, "normal");
  doc.setTextColor(100);
  doc.text(nombreCompleto, 5, y + 5);

  y += 12;
  doc.setFont(label, "bold");
  doc.setTextColor(0);
  doc.text("Importe:", 5, y);
  doc.setFont(label, "normal");
  doc.setTextColor(100);
  doc.text(`$${montoTotal.toLocaleString('es-AR')}`, 5, y + 5);

  y += 12;
  doc.setFont(label, "bold");
  doc.setTextColor(0);
  doc.text("Concepto:", 5, y);
  doc.setFont(label, "normal");
  doc.setTextColor(100);
  let conceptos = [];
  if (pago.pago_mes) conceptos.push(`Pago cuota mes ${mesSeleccionado}`);
  if (pago.pago_inscripcion) conceptos.push("Inscripción");
  if (alumno.tiene_promo) conceptos.push("Con promo");
  
  y += 5;
  for (const concepto of conceptos) {
    doc.text(`- ${concepto}`, 8, y);
    y += 5;
  }

  y += 2;
  doc.setFont(label, "bold");
  doc.setTextColor(0);
  doc.text("Medio de pago:", 5, y);
  doc.setFont(label, "normal");
  doc.setTextColor(100);
  doc.text(pago.medio_pago.charAt(0).toUpperCase() + pago.medio_pago.slice(1), 5, y + 5);

  const fechaTxt = new Date().toLocaleDateString("es-AR");
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Fecha: ${fechaTxt}`, 85, 132, { align: "right" });

  doc.save(`Comprobante_${alumno.nombre}_${alumno.apellido}_${mesSeleccionado}.pdf`);
};

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold text-center mb-6">Estadísticas de Pagos</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block font-medium mb-1">Seleccionar Mes:</label>
          <select
            className="w-full border p-2 rounded"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
          >
            {meses.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Medio de pago:</label>
          <select
            className="w-full border p-2 rounded"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Ciclo:</label>
          <select
            className="w-full border p-2 rounded"
            value={cicloFiltro}
            onChange={(e) => setCicloFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            {ciclosDisponibles.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre_publico || c.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center gap-6 font-medium text-lg my-4">
        <span className="text-green-600">Pagados: {pagados}</span>
        <span className="text-red-600">Faltan pagar: {noPagados}</span>
      </div>

      <table className="min-w-full table-auto border-t border-b text-left">
        <thead>
          <tr>
            <th className="cursor-pointer py-2 px-3 whitespace-nowrap" onClick={() => {
              setOrden("nombre");
              setAscendente((v) => !v);
            }}>
              Alumno ⬍
            </th>
            <th className="cursor-pointer py-2 px-3 whitespace-nowrap" onClick={() => {
              setOrden("pago");
              setAscendente((v) => !v);
            }}>
              Pagó ⬍
            </th>
          </tr>
        </thead>
        <tbody>
          {alumnosOrdenados.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2 px-3 whitespace-normal">{a.nombre} {a.apellido}</td>
              <td className={`py-2 px-3 font-bold ${a.pago ? "text-green-600" : "text-red-600"}`}>
                {a.pago ? (
                  <div className="flex items-center gap-2">
                    <span>Sí</span>
                    <button
                        onClick={() => generarComprobante(a.id)}
                        className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2 py-1 rounded text-xs shadow-sm transition"
                        title="Descargar comprobante en PDF"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4.5 0A1.5 1.5 0 0 0 3 1.5V14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5.707a1 1 0 0 0-.293-.707L10.707 2.293A1 1 0 0 0 10 2H5.5A1.5 1.5 0 0 0 4.5 0zM5 1h5v3a1 1 0 0 0 1 1h3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V1.5A.5.5 0 0 1 5 1z"/>
                            <path d="M8.5 8a.5.5 0 0 1 .5.5v3.793l.146-.147a.5.5 0 0 1 .708.708l-1 1a.498.498 0 0 1-.708 0l-1-1a.5.5 0 1 1 .708-.708l.146.147V8.5a.5.5 0 0 1 .5-.5z"/>
                        </svg>
                        PDF
                    </button>

                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>No</span>
                    {a.telefono && (
                      <a
                        href={`https://wa.me/54${a.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola, cómo estás? Notamos que todavía no tenemos registro del pago de la cuota correspondiente a ${mesSeleccionado}. Si ya lo realizaste, quizás se nos pasó registrarlo. Nos podrías confirmar? Gracias! y disculpas por la molestia...`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-500 hover:bg-green-600 transition"
                        title="Recordar por WhatsApp"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 16 16" className="w-4 h-4">
                            <path d="M13.601 2.326A7.955 7.955 0 0 0 8 0C3.582 0 0 3.582 0 8c0 1.425.375 2.748 1.03 3.914L0 16l4.188-1.03A7.963 7.963 0 0 0 8 16c4.418 0 8-3.582 8-8 0-2.137-.832-4.089-2.399-5.674zM8 14.5a6.5 6.5 0 1 1 4.401-11.074l.19.185A6.495 6.495 0 0 1 8 14.5z"/>
                            <path d="M11.168 9.29c-.228-.114-1.348-.667-1.556-.743-.207-.077-.358-.114-.51.114-.152.228-.586.743-.72.895-.133.152-.266.171-.494.057-.228-.114-.962-.354-1.83-1.13-.676-.602-1.133-1.347-1.267-1.575-.133-.228-.014-.352.1-.466.103-.102.228-.266.342-.399.115-.133.152-.228.229-.38.076-.152.038-.285-.019-.399-.058-.114-.51-1.23-.699-1.681-.184-.445-.372-.384-.51-.392-.133-.008-.285-.01-.437-.01-.152 0-.4.057-.61.285-.21.228-.81.792-.81 1.931 0 1.14.83 2.243.945 2.399.114.152 1.63 2.5 3.96 3.494.554.24.984.384 1.32.49.554.176 1.057.152 1.455.092.444-.066 1.348-.551 1.538-1.083.19-.532.19-.99.133-1.083-.057-.095-.209-.152-.437-.266z"/>
                        </svg>
                        </a>
                    
                    
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate("/menu-gestion")}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-6 rounded shadow-md transition hover:scale-105"
        >
          ← Volver al menú
        </button>
      </div>
    </div>
  );
};

export default FichaPagosEstadisticas;
