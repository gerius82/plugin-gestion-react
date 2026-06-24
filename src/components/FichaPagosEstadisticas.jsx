// FichaPagosEstadisticas.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";

const FichaPagosEstadisticas = () => {
  const MODULO_PLANTILLAS = "pagos_estadisticas";
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [asistenciasMap, setAsistenciasMap] = useState({});
  const [matriculasMap, setMatriculasMap] = useState({});
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [cicloFiltro, setCicloFiltro] = useState("");
  const [estadoPagoFiltro, setEstadoPagoFiltro] = useState("todos");
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState("");
  const [plantillaActiva, setPlantillaActiva] = useState("");
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [plantillasEditables, setPlantillasEditables] = useState([]);
  const [plantillaEditId, setPlantillaEditId] = useState("");
  const [plantillaForm, setPlantillaForm] = useState({ label: "", text: "" });
  const [errorPlantillas, setErrorPlantillas] = useState("");
  const mesesBase = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const plantillasBase = useMemo(
    () => [
      {
        id: "recordatorio_pago",
        orden: 1,
        label: "Recordatorio de pago",
        text:
          "Hola {nombre} {apellido}, cómo estás?\n" +
          "Notamos que todavía no tenemos registrado el pago correspondiente a {mes}.\n" +
          "Si ya lo realizaste, quizás se nos pasó registrarlo. Nos podrías confirmar?\n" +
          "Gracias.",
      },
      {
        id: "agradecimiento_pago",
        orden: 2,
        label: "Agradecimiento",
        text:
          "Hola {nombre} {apellido}, muchas gracias por el pago de {mes}.\n" +
          "Cualquier duda, escribinos.",
      },
    ],
    []
  );
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
    if (!mostrarPlantillas) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mostrarPlantillas]);

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

  const headers = (extra = {}) => ({
    apikey: config?.supabaseKey,
    Authorization: `Bearer ${config?.supabaseKey}`,
    ...extra,
  });

  const cargarPlantillas = async () => {
    try {
      setErrorPlantillas("");
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/avisos_plantillas?select=id,label,text,orden,activo,modulo&modulo=eq.${encodeURIComponent(MODULO_PLANTILLAS)}&order=orden.asc`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error("No pude cargar las plantillas.");
      const data = await res.json();
      const activas = (Array.isArray(data) ? data : []).filter((p) => p.activo !== false);
      if (activas.length > 0) {
        setPlantillasEditables(activas);
        return;
      }
      await sembrarPlantillasBase();
    } catch {
      setPlantillasEditables(plantillasBase);
      setErrorPlantillas("No pude leer las plantillas desde Supabase. Ejecutá primero la migración SQL.");
    }
  };

  const sembrarPlantillasBase = async () => {
    const payload = plantillasBase.map((p) => ({ ...p, modulo: MODULO_PLANTILLAS }));
    const res = await fetch(`${config.supabaseUrl}/rest/v1/avisos_plantillas`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("No pude guardar las plantillas base.");
    const data = await res.json();
    setPlantillasEditables(Array.isArray(data) ? data : plantillasBase);
  };

  const crearPlantilla = async (payload) => {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/avisos_plantillas`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ ...payload, modulo: MODULO_PLANTILLAS, activo: true }),
    });
    if (!res.ok) throw new Error("No pude crear la plantilla.");
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  };

  const actualizarPlantilla = async (id, payload) => {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/avisos_plantillas?id=eq.${encodeURIComponent(id)}&modulo=eq.${encodeURIComponent(MODULO_PLANTILLAS)}`,
      {
        method: "PATCH",
        headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) throw new Error("No pude actualizar la plantilla.");
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  };

  const eliminarPlantilla = async (id) => {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/avisos_plantillas?id=eq.${encodeURIComponent(id)}&modulo=eq.${encodeURIComponent(MODULO_PLANTILLAS)}`,
      { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }
    );
    if (!res.ok) throw new Error("No pude eliminar la plantilla.");
  };

  useEffect(() => {
    if (!config) return;
    cargarPlantillas();
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
    const filtradosPorMedio =
      medioPago === "todos"
        ? list
        : list.filter((a) => a.medio_pago === medioPago);
    if (estadoPagoFiltro === "pagados") return filtradosPorMedio.filter((a) => a.pago);
    if (estadoPagoFiltro === "no_pagados") return filtradosPorMedio.filter((a) => !a.pago);
    return filtradosPorMedio;
  }, [alumnos, pagosMap, medioPago, matriculasMap, cicloFiltro, estadoPagoFiltro]);

  useEffect(() => {
    if (!config) return;

    const ids = alumnosConEstado.map((a) => a.id).filter(Boolean);
    if (!ids.length) {
      setAsistenciasMap({});
      return;
    }

    (async () => {
      const headers = {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
      };

      const idsQuery = ids.join(",");
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/asistencias?select=alumno_id,tipo,fecha&alumno_id=in.(${idsQuery})&order=fecha.desc`,
        { headers }
      );
      const data = await res.json();
      const grouped = {};
      (Array.isArray(data) ? data : []).forEach((item) => {
        if (!item?.alumno_id) return;
        grouped[item.alumno_id] = grouped[item.alumno_id] || [];
        if (grouped[item.alumno_id].length < 4) {
          grouped[item.alumno_id].push(item);
        }
      });
      setAsistenciasMap(grouped);
    })();
  }, [config, alumnosConEstado]);

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

  const colorAsistencia = (tipo) => {
    if (tipo === "ausente") return "bg-red-500";
    if (tipo === "regular" || tipo === "recuperacion") return "bg-green-500";
    return "bg-gray-300";
  };

  const formatFechaCorta = (fecha) => {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-AR");
  };

  const resetPlantillaForm = () => {
    setPlantillaEditId("");
    setPlantillaForm({ label: "", text: "" });
  };

  const interpolarMensaje = (plantilla, alumno) => {
    if (!plantilla) return "";
    const reemplazos = {
      "{nombre}": (alumno?.nombre || "").trim(),
      "{apellido}": (alumno?.apellido || "").trim(),
      "{mes}": mesSeleccionado,
      "{estado_pago}": alumno?.pago ? "pagado" : "pendiente",
      "{medio_pago}": alumno?.medio_pago || "",
    };
    return Object.keys(reemplazos).reduce(
      (acc, key) => acc.split(key).join(reemplazos[key]),
      plantilla
    );
  };

  const buildWhatsappLink = (telefono, mensajePlano, alumno) => {
    if (!telefono || !mensajePlano) return null;
    const limpio = telefono.replace(/\D/g, "");
    if (!limpio) return null;
    const personalizado = interpolarMensaje(mensajePlano, alumno);
    return `https://wa.me/54${limpio}?text=${encodeURIComponent(personalizado)}`;
  };

  const generarComprobante = async (alumnoId) => {
  const alumno = alumnos.find(a => a.id === alumnoId);
  if (!alumno || !config) return;

  const headers = {
    apikey: config.supabaseKey,
    Authorization: `Bearer ${config.supabaseKey}`,
  };
  let resPago = await fetch(`${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${alumnoId}&mes=eq.${mesSeleccionado}&pago_mes=eq.true&select=medio_pago,pago_inscripcion,pago_mes,mes,monto_total,creado_en,descuento_pct,descuento_detalle`, {
    headers,
  });
  if (!resPago.ok) {
    resPago = await fetch(`${config.supabaseUrl}/rest/v1/pagos?alumno_id=eq.${alumnoId}&mes=eq.${mesSeleccionado}&pago_mes=eq.true&select=medio_pago,pago_inscripcion,pago_mes,mes,monto_total,creado_en`, {
      headers,
    });
  }

  const [pago] = await resPago.json();
  if (!pago) {
    alert("No se encontró información de pago.");
    return;
  }

  const montoTotal = pago.monto_total;
  const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;

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
  if (pago.descuento_detalle) conceptos.push(pago.descuento_detalle);
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

  const fechaTxt = pago.creado_en
    ? new Date(pago.creado_en).toLocaleDateString("es-AR")
    : new Date().toLocaleDateString("es-AR");
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Fecha: ${fechaTxt}`, 85, 132, { align: "right" });

  const nombreArchivo = `Comprobante_${alumno.nombre}_${alumno.apellido}_${mesSeleccionado}.pdf`;
  const pdfBlob = doc.output("blob");
  const pdfFile = new File([pdfBlob], nombreArchivo, { type: "application/pdf" });

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    try {
      await navigator.share({
        title: "Comprobante de pago",
        text: `Comprobante de pago de ${alumno.nombre} ${alumno.apellido}`,
        files: [pdfFile],
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  doc.save(nombreArchivo);
};

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-center flex-1">Estadísticas de Pagos</h2>
        <button
          onClick={() => navigate("/pagos-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-5xl mx-auto overflow-hidden">

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block font-medium mb-1">Estado de pago:</label>
          <select
            className="w-full border p-2 rounded"
            value={estadoPagoFiltro}
            onChange={(e) => setEstadoPagoFiltro(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="pagados">Pagaron</option>
            <option value="no_pagados">No pagaron</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Mensaje a enviar por WhatsApp:</label>
          <div className="mb-2">
            <button
              type="button"
              className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
              onClick={() => setMostrarPlantillas(true)}
            >
              Crear / editar mensajes
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mb-2">
            {plantillasEditables.map((p) => (
              <label
                key={p.id}
                className="inline-flex items-center gap-2 text-sm px-2 py-1 rounded-full border border-gray-200 bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={plantillaActiva === p.id}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPlantillaActiva(p.id);
                      setMensajeWhatsapp(p.text);
                    } else {
                      setPlantillaActiva("");
                      setMensajeWhatsapp("");
                    }
                  }}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          <textarea
            className="w-full border rounded p-3 text-sm min-h-[90px]"
            placeholder="Escribí el mensaje para WhatsApp"
            value={mensajeWhatsapp}
            onChange={(e) => {
              const valor = e.target.value;
              setMensajeWhatsapp(valor);
              const activa = plantillasEditables.find((p) => p.id === plantillaActiva);
              if (activa && valor !== activa.text) {
                setPlantillaActiva("");
              }
            }}
          />
          <p className="mt-1 text-xs text-gray-500">
            Podés usar {`{nombre}`}, {`{apellido}`}, {`{mes}`}, {`{estado_pago}`} y {`{medio_pago}`}.
          </p>
          {errorPlantillas && <p className="mt-2 text-sm text-red-600">{errorPlantillas}</p>}
        </div>
      </div>

      <div className="flex justify-center gap-6 font-medium text-lg my-4">
        <span className="text-green-600">Pagados: {pagados}</span>
        <span className="text-red-600">Faltan pagar: {noPagados}</span>
      </div>

      <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[620px] table-auto border-t border-b text-left">
        <thead>
          <tr>
            <th className="cursor-pointer py-2 px-3 whitespace-nowrap w-[62%]" onClick={() => {
              setOrden("nombre");
              setAscendente((v) => !v);
            }}>
              Alumno ⬍
            </th>
            <th className="py-2 px-4 whitespace-nowrap text-right w-[110px]">Asist.</th>
            <th className="cursor-pointer py-2 px-3 whitespace-nowrap w-[150px]" onClick={() => {
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
              <td className="py-2 px-3">
                <div className="max-w-[320px] break-words">{a.nombre} {a.apellido}</div>
              </td>
              <td className="py-2 px-4 w-[110px]">
                <div className="flex items-center justify-end gap-1.5 min-w-[72px]">
                  {(asistenciasMap[a.id] || []).map((r, idx) => (
                    <span
                      key={`${a.id}-${idx}`}
                      className={`inline-block w-2 h-2 rounded-full ${colorAsistencia(r.tipo)}`}
                      title={`${r.tipo} - ${formatFechaCorta(r.fecha)}`}
                    />
                  ))}
                </div>
              </td>
              <td className={`py-2 px-3 font-bold ${a.pago ? "text-green-600" : "text-red-600"}`}>
                {a.pago ? (
                  <div className="flex items-center gap-2">
                    <span>Sí</span>
                    {buildWhatsappLink(a.telefono || "", mensajeWhatsapp, a) && (
                      <a
                        href={buildWhatsappLink(a.telefono || "", mensajeWhatsapp, a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-500 hover:bg-green-600 transition text-white"
                        title="Enviar mensaje por WhatsApp"
                      >
                        <FaWhatsapp className="w-4 h-4" />
                      </a>
                    )}
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
                    {buildWhatsappLink(a.telefono || "", mensajeWhatsapp, a) && (
                      <a
                        href={buildWhatsappLink(a.telefono || "", mensajeWhatsapp, a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-500 hover:bg-green-600 transition text-white"
                        title="Enviar mensaje por WhatsApp"
                      >
                        <FaWhatsapp className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </div>
      {mostrarPlantillas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Mensajes prediseñados</h3>
              <button
                type="button"
                className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                onClick={() => {
                  setMostrarPlantillas(false);
                  resetPlantillaForm();
                  setErrorPlantillas("");
                }}
              >
                Cerrar
              </button>
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium mb-1">Nombre del mensaje</div>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={plantillaForm.label}
                onChange={(e) => setPlantillaForm((p) => ({ ...p, label: e.target.value }))}
              />
              <div className="text-sm font-medium mt-3 mb-1">Texto del mensaje</div>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
                value={plantillaForm.text}
                onChange={(e) => setPlantillaForm((p) => ({ ...p, text: e.target.value }))}
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  onClick={async () => {
                    if (!plantillaForm.label.trim() || !plantillaForm.text.trim()) {
                      setErrorPlantillas("Completá nombre y texto del mensaje.");
                      return;
                    }
                    try {
                      if (plantillaEditId) {
                        const actualizada = await actualizarPlantilla(plantillaEditId, {
                          label: plantillaForm.label,
                          text: plantillaForm.text,
                        });
                        const updated = plantillasEditables.map((p) =>
                          p.id === plantillaEditId ? { ...p, ...actualizada } : p
                        );
                        setPlantillasEditables(updated);
                      } else {
                        const ordenMax = plantillasEditables.reduce(
                          (max, p) => Math.max(max, p.orden || 0),
                          0
                        );
                        const nueva = await crearPlantilla({
                          id: `custom-${Date.now()}`,
                          label: plantillaForm.label,
                          text: plantillaForm.text,
                          orden: ordenMax + 1,
                        });
                        setPlantillasEditables([...plantillasEditables, nueva]);
                      }
                      setErrorPlantillas("");
                      resetPlantillaForm();
                    } catch {
                      setErrorPlantillas("No pude guardar la plantilla en Supabase.");
                    }
                  }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="text-sm px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  onClick={() => {
                    resetPlantillaForm();
                    setErrorPlantillas("");
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Mensajes</div>
              {plantillasEditables.length === 0 ? (
                <div className="text-sm text-gray-500">No hay mensajes.</div>
              ) : (
                <div className="space-y-2">
                  {plantillasEditables.map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="text-xs text-gray-500 whitespace-pre-line">{p.text}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          onClick={async () => {
                            setPlantillaEditId(p.id);
                            setPlantillaForm({ label: p.label, text: p.text });
                            setErrorPlantillas("");
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                          onClick={async () => {
                            try {
                              await eliminarPlantilla(p.id);
                              const updated = plantillasEditables.filter((item) => item.id !== p.id);
                              setPlantillasEditables(updated);
                              if (plantillaEditId === p.id) resetPlantillaForm();
                              if (plantillaActiva === p.id) {
                                setPlantillaActiva("");
                                setMensajeWhatsapp("");
                              }
                              setErrorPlantillas("");
                            } catch {
                              setErrorPlantillas("No pude eliminar la plantilla en Supabase.");
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FichaPagosEstadisticas;



