import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

const normalizarEstado = (pago) => {
  const valor = (
    pago.factura_estado ||
    pago.estado_facturacion ||
    pago.facturacion_estado ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (["generado", "emitido", "facturado", "ok"].includes(valor)) return "generado";
  if (["homologacion_generado", "generado_h", "homologado"].includes(valor)) {
    return "homologacion_generado";
  }
  if (["error", "fallido", "rechazado"].includes(valor)) return "error";
  if (["generando", "procesando"].includes(valor)) return "generando";
  return "pendiente";
};

const badgeClase = {
  pendiente: "bg-gray-100 text-gray-700 border-gray-200",
  generando: "bg-blue-100 text-blue-700 border-blue-200",
  homologacion_generado: "bg-amber-100 text-amber-700 border-amber-200",
  generado: "bg-green-100 text-green-700 border-green-200",
  error: "bg-red-100 text-red-700 border-red-200",
};

const badgeLabel = {
  pendiente: "Pendiente",
  generando: "Generando",
  homologacion_generado: "Ya generado (H)",
  generado: "Ya generado",
  error: "Error",
};

export default function FichaFacturacion() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = `/${params.get("from") || "menu-gestion"}`;

  const [config, setConfig] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [mesFiltro, setMesFiltro] = useState(MESES[new Date().getMonth()]);
  const [estadoFiltro, setEstadoFiltro] = useState("pendiente");
  const [seleccionados, setSeleccionados] = useState({});
  const [ordenAlumno, setOrdenAlumno] = useState("ninguno");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cambiandoModo, setCambiandoModo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [modoOperacion, setModoOperacion] = useState("produccion");

  const cargarPagos = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setActualizando(silencioso);
    try {
      const cfg = config || (await (await fetch("/config.json")).json());
      if (!config) setConfig(cfg);

      const select = [
        "id",
        "alumno_id",
        "mes",
        "pago_mes",
        "pago_inscripcion",
        "medio_pago",
        "monto_total",
        "creado_en",
        "factura_estado",
        "factura_numero",
        "factura_error",
        "inscripciones(nombre,apellido)",
      ].join(",");

      const url = new URL(`${cfg.supabaseUrl}/rest/v1/pagos`);
      url.searchParams.set("select", select);
      url.searchParams.set("order", "creado_en.desc");
      url.searchParams.set("limit", "200");

      const response = await fetch(url.toString(), { headers: toHeaders(cfg) });
      const data = await response.json();
      setPagos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando pagos para facturacion", err);
      setMensaje(`Error cargando pagos: ${err}`);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  };

  useEffect(() => {
    cargarPagos();
  }, []);

  useEffect(() => {
    const cargarModo = async () => {
      try {
        const cfg = config || (await (await fetch("/config.json")).json());
        if (!config) setConfig(cfg);
        const apiUrl = cfg?.facturacionApiUrl || "http://127.0.0.1:8787";
        const response = await fetch(`${apiUrl}/modo`);
        const data = await response.json();
        if (response.ok && data?.ok && data?.data?.modo_operacion) {
          setModoOperacion(data.data.modo_operacion);
        }
      } catch {
        // fallback silencioso
      }
    };
    cargarModo();
  }, [config]);

  const pagosPreparados = useMemo(
    () =>
      pagos.map((pago) => {
        const estado = normalizarEstado(pago);
        const alumno = pago.inscripciones || {};
        const nombre = `${alumno.nombre || ""} ${alumno.apellido || ""}`.trim();
        let concepto = "Servicios educativos";
        if (pago.pago_mes && pago.pago_inscripcion) {
          concepto = `Cuota ${pago.mes || ""} + Inscripción`.trim();
        } else if (pago.pago_mes) {
          concepto = `Cuota ${pago.mes || ""}`.trim();
        } else if (pago.pago_inscripcion) {
          concepto = "Inscripción";
        }

        return {
          ...pago,
          estado,
          nombre: nombre || "Alumno sin nombre",
          concepto,
        };
      }),
    [pagos]
  );

  const pagosFiltrados = useMemo(
    () => {
      const filtrados = pagosPreparados.filter((pago) => {
        const okMes = mesFiltro === "todos" ? true : (pago.mes || "N/A") === mesFiltro;
        const okEstado = estadoFiltro === "todos" ? true : pago.estado === estadoFiltro;
        return okMes && okEstado;
      });

      if (ordenAlumno === "asc") {
        filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      } else if (ordenAlumno === "desc") {
        filtrados.sort((a, b) => b.nombre.localeCompare(a.nombre, "es"));
      }

      return filtrados;
    },
    [estadoFiltro, mesFiltro, ordenAlumno, pagosPreparados]
  );

  const idsSeleccionados = useMemo(
    () =>
      pagosFiltrados
        .filter(
          (pago) =>
            seleccionados[pago.id] &&
            pago.estado !== "generado" &&
            !(pago.estado === "homologacion_generado" && modoOperacion !== "produccion")
        )
        .map((pago) => pago.id),
    [modoOperacion, pagosFiltrados, seleccionados]
  );

  const totalSeleccionado = useMemo(
    () =>
      pagosFiltrados.reduce((acc, pago) => {
        if (!seleccionados[pago.id] || pago.estado === "generado") return acc;
        if (pago.estado === "homologacion_generado" && modoOperacion !== "produccion") return acc;
        return acc + Number(pago.monto_total || 0);
      }, 0),
    [modoOperacion, pagosFiltrados, seleccionados]
  );

  const resumen = useMemo(
    () => ({
      total: pagosFiltrados.length,
      pendientes: pagosFiltrados.filter((p) => p.estado === "pendiente").length,
      generados: pagosFiltrados.filter((p) => p.estado === "generado").length,
      errores: pagosFiltrados.filter((p) => p.estado === "error").length,
    }),
    [pagosFiltrados]
  );

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const seleccionarPendientes = () => {
    const siguientes = {};
    pagosFiltrados.forEach((pago) => {
      if (pago.estado === "generado") return;
      if (pago.estado === "homologacion_generado" && modoOperacion !== "produccion") return;
      siguientes[pago.id] = true;
    });
    setSeleccionados(siguientes);
  };

  const limpiarSeleccion = () => setSeleccionados({});

  const toggleOrdenAlumno = () => {
    setOrdenAlumno((prev) => {
      if (prev === "ninguno") return "asc";
      if (prev === "asc") return "desc";
      return "ninguno";
    });
  };

  const handleEnviar = () => {
    if (!idsSeleccionados.length) {
      setMensaje("Seleccioná al menos un pago pendiente para facturar.");
      return;
    }

    const enviar = async () => {
      try {
        setMensaje(`Enviando ${idsSeleccionados.length} pago(s) a facturar...`);
        const apiUrl = config?.facturacionApiUrl || "http://127.0.0.1:8787";
        const response = await fetch(`${apiUrl}/facturar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pago_ids: idsSeleccionados }),
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          setMensaje(`Error al facturar: ${data?.error || "Error desconocido"}`);
          return;
        }

        const ok = (data.resultados || []).filter((r) => r.ok).length;
        const error = (data.resultados || []).filter((r) => !r.ok).length;
        setMensaje(`Facturación terminada. OK: ${ok}. Error: ${error}.`);
        limpiarSeleccion();
        await cargarPagos(true);
      } catch (err) {
        setMensaje(`Error al conectar con el backend de facturación: ${err}`);
      }
    };

    enviar();
  };

  const cambiarModo = async (nuevoModo) => {
    if (nuevoModo === modoOperacion) return;
    if (nuevoModo === "produccion") {
      const confirmado = window.confirm(
        "Vas a cambiar a PRODUCCION. Las próximas facturas serán reales. ¿Querés continuar?"
      );
      if (!confirmado) return;
    }

    try {
      setCambiandoModo(true);
      const apiUrl = config?.facturacionApiUrl || "http://127.0.0.1:8787";
      const response = await fetch(`${apiUrl}/modo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo_operacion: nuevoModo }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setMensaje(`No se pudo cambiar el modo: ${data?.error || "Error desconocido"}`);
        return;
      }
      setModoOperacion(data.data.modo_operacion);
      setMensaje(
        `Modo actualizado a ${
          data.data.modo_operacion === "homologacion" ? "Homologación" : "Producción"
        }.`
      );
    } catch (err) {
      setMensaje(`Error al cambiar el modo: ${err}`);
    } finally {
      setCambiandoModo(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-center flex-1">Facturación</h2>
        <button
          onClick={() => navigate(from)}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-5xl mx-auto">
        {cargando ? (
          <p className="text-center text-gray-600">Cargando pagos...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div className="md:col-span-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border p-4 bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">Ambiente actual</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
                      modoOperacion === "homologacion"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }`}
                  >
                    {modoOperacion === "homologacion" ? "Homologación" : "Producción"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Cambiar ambiente</label>
                  <select
                    className="border border-gray-300 rounded p-2"
                    value={modoOperacion}
                    onChange={(e) => cambiarModo(e.target.value)}
                    disabled={cambiandoModo}
                  >
                    <option value="homologacion">Homologación</option>
                    <option value="produccion">Producción</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Mes</label>
                <select
                  className="w-full border border-gray-300 rounded p-2"
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {MESES.map((mes) => (
                    <option key={mes} value={mes}>
                      {mes}
                    </option>
                  ))}
                  <option value="N/A">N/A</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Estado</label>
                <select
                  className="w-full border border-gray-300 rounded p-2"
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                >
                  <option value="pendiente">Pendientes</option>
                  <option value="todos">Todos</option>
                  <option value="generado">Ya generados</option>
                  <option value="homologacion_generado">Ya generados (H)</option>
                  <option value="error">Con error</option>
                  <option value="generando">Generando</option>
                </select>
              </div>

              <div className="bg-gray-50 rounded-lg border p-3">
                <div className="text-xs text-gray-500">Pagos visibles</div>
                <div className="text-xl font-semibold">{resumen.total}</div>
              </div>

              <div className="bg-green-50 rounded-lg border border-green-100 p-3">
                <div className="text-xs text-green-700">Importe seleccionado</div>
                <div className="text-xl font-semibold text-green-700">
                  ${Number(totalSeleccionado || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-5 text-sm">
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-gray-500">Pendientes</div>
                <div className="font-semibold">{resumen.pendientes}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="text-green-700">Ya generados</div>
                <div className="font-semibold text-green-700">{resumen.generados}</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="text-amber-700">Generados (H)</div>
                <div className="font-semibold text-amber-700">
                  {pagosFiltrados.filter((p) => p.estado === "homologacion_generado").length}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <div className="text-red-700">Con error</div>
                <div className="font-semibold text-red-700">{resumen.errores}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-blue-700">Seleccionados</div>
                <div className="font-semibold text-blue-700">{idsSeleccionados.length}</div>
              </div>
            </div>

            <div className="flex flex-nowrap gap-2 mb-4 overflow-x-auto">
              <button
                onClick={seleccionarPendientes}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-100"
              >
                Seleccionar pendientes
              </button>
              <button
                onClick={limpiarSeleccion}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-100"
              >
                Limpiar selección
              </button>
              <button
                onClick={() => cargarPagos(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-100"
                disabled={actualizando}
              >
                {actualizando ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-4 py-3">Sel.</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={toggleOrdenAlumno}
                        className="inline-flex items-center gap-2 font-semibold bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent p-0 m-0 shadow-none border-0"
                      >
                        Alumno
                        <span className="text-xs text-gray-500">
                          {ordenAlumno === "asc"
                            ? "A-Z"
                            : ordenAlumno === "desc"
                              ? "Z-A"
                              : ""}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Medio</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosFiltrados.map((pago) => {
                    const bloqueado =
                      pago.estado === "generado" ||
                      (pago.estado === "homologacion_generado" && modoOperacion !== "produccion");
                    return (
                      <tr key={pago.id} className="border-t">
                        <td className="px-4 py-3 align-top">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={Boolean(seleccionados[pago.id])}
                            disabled={bloqueado}
                            onChange={() => toggleSeleccion(pago.id)}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-gray-900">{pago.nombre}</div>
                          <div className="text-xs text-gray-500">Pago #{pago.id}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div>{pago.concepto}</div>
                          {pago.factura_numero ? (
                            <div className="text-xs text-gray-500">
                              Factura #{pago.factura_numero}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top capitalize">{pago.medio_pago}</td>
                        <td className="px-4 py-3 align-top">
                          ${Number(pago.monto_total || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {pago.creado_en
                            ? new Date(pago.creado_en).toLocaleDateString("es-AR")
                            : "-"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${badgeClase[pago.estado]}`}
                          >
                            {badgeLabel[pago.estado]}
                          </span>
                          {pago.factura_error ? (
                            <div className="text-xs text-red-600 mt-1 max-w-xs">
                              {pago.factura_error}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {!pagosFiltrados.length ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        No hay pagos para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {mensaje ? (
              <div className="mt-4 text-center text-blue-800 font-semibold bg-blue-100 border border-blue-200 px-4 py-3 rounded shadow-sm">
                {mensaje}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <p className="text-sm text-gray-500">
                Los PDFs y CAE reales se generan desde el backend local de facturación, no desde el navegador.
              </p>
              <button
                onClick={handleEnviar}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-5 rounded shadow"
              >
                Enviar a facturar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
