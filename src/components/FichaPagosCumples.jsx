import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const ESTADOS_VALIDOS = ["pendiente", "confirmada"];

const formatFecha = (fecha) => {
  if (!fecha) return "";
  const [y, m, d] = String(fecha).split("-");
  if (!y || !m || !d) return fecha;
  return `${d}-${m}-${y}`;
};

const formatPrecio = (valor) => {
  const num = Number(valor || 0);
  if (!Number.isFinite(num)) return "$0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const extraerMontoPromo = (texto = "") => {
  const matches = String(texto || "").match(/\$?\s*[\d.]{3,}/g);
  if (!matches?.length) return null;
  const limpio = matches[matches.length - 1].replace(/[^\d]/g, "");
  const monto = Number(limpio);
  return Number.isFinite(monto) ? monto : null;
};

const labelConcepto = (concepto) => {
  if (concepto === "total") return "Pago total";
  return concepto.charAt(0).toUpperCase() + concepto.slice(1);
};

export default function FichaPagosCumples() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [precioCumple, setPrecioCumple] = useState(0);
  const [promoCumple, setPromoCumple] = useState("");
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [selecciones, setSelecciones] = useState({});
  const [pagosPorReserva, setPagosPorReserva] = useState({});
  const promoMonto = useMemo(() => extraerMontoPromo(promoCumple), [promoCumple]);

  const headers = useMemo(() => {
    if (!config) return {};
    return {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };
  }, [config]);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg));
  }, []);

  useEffect(() => {
    if (!config) return;
    (async () => {
      setLoading(true);
      try {
        const [resReservas, resConfig, resPagos] = await Promise.all([
          fetch(
            `${config.supabaseUrl}/rest/v1/cumple_reservas?select=id,fecha,hora,nombre,apellido,telefono,estado,creado_en,cumpleanero_nombre,cumpleanero_edad,monto_total,promo_aplicada,promo_detalle,reserva_senia_pct&order=fecha.asc&order=hora.asc`,
            { headers }
          ),
          fetch(`${config.supabaseUrl}/rest/v1/cumples_config?select=precio,promo&id=eq.global`, {
            headers,
          }),
          fetch(
            `${config.supabaseUrl}/rest/v1/cumple_pagos?select=id,reserva_id,concepto,monto,medio_pago,aplica_promo,promo_detalle,creado_en&order=creado_en.desc`,
            { headers }
          ),
        ]);

        const dataReservas = await resReservas.json();
        const dataConfig = await resConfig.json();
        const dataPagos = resPagos.ok ? await resPagos.json() : [];
        const lista = (Array.isArray(dataReservas) ? dataReservas : []).filter((r) =>
          ESTADOS_VALIDOS.includes(String(r.estado || "").toLowerCase())
        );
        setReservas(lista);

        const pagosAgrupados = (Array.isArray(dataPagos) ? dataPagos : []).reduce((acc, pago) => {
          if (!pago?.reserva_id) return acc;
          if (!acc[pago.reserva_id]) acc[pago.reserva_id] = [];
          acc[pago.reserva_id].push(pago);
          return acc;
        }, {});
        setPagosPorReserva(pagosAgrupados);

        const rowConfig = Array.isArray(dataConfig) ? dataConfig[0] : null;
        setPrecioCumple(Number(rowConfig?.precio || 0));
        setPromoCumple(rowConfig?.promo || "");

        setSelecciones((prev) => {
          const next = { ...prev };
          lista.forEach((r) => {
            if (!next[r.id]) {
              next[r.id] = {
                concepto: String(r.estado || "").toLowerCase() === "confirmada" ? "diferencia" : "reserva",
                medioPago: "transferencia",
                aplicaPromo: !!r.promo_aplicada,
              };
            }
          });
          return next;
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [config, headers]);

  const calcularMonto = (concepto, aplicaPromo = false, montoReserva = null, seniaPct = 50) => {
    const totalBase = aplicaPromo && Number.isFinite(promoMonto) ? promoMonto : montoReserva ?? precioCumple;
    const total = Number(totalBase || 0);
    if (!Number.isFinite(total)) return 0;
    const pct = Number(seniaPct || 50);
    const senia = Math.round(total * ((Number.isFinite(pct) ? pct : 50) / 100));
    if (concepto === "reserva") return senia;
    if (concepto === "diferencia") return total - senia;
    return total;
  };

  const registrarPago = async (reserva) => {
    if (!config) return;

    const seleccion = selecciones[reserva.id] || {
      concepto: String(reserva.estado || "").toLowerCase() === "confirmada" ? "diferencia" : "reserva",
      medioPago: "transferencia",
      aplicaPromo: !!reserva.promo_aplicada,
    };
    const nombreCumple =
      reserva.cumpleanero_nombre || `${reserva.nombre || ""} ${reserva.apellido || ""}`.trim();
    const monto = calcularMonto(
      seleccion.concepto,
      seleccion.aplicaPromo,
      reserva.monto_total,
      reserva.reserva_senia_pct
    );

    setMensaje("");

    try {
      const pagosActuales = pagosPorReserva[reserva.id] || [];
      const conceptosActuales = new Set(
        pagosActuales.map((pago) => String(pago.concepto || "").toLowerCase())
      );
      const pagoCompletoExistente =
        conceptosActuales.has("total") ||
        (conceptosActuales.has("reserva") && conceptosActuales.has("diferencia"));

      if (pagoCompletoExistente) {
        setMensaje(`La reserva de ${nombreCumple} ya tiene el pago completo registrado.`);
        return;
      }

      if (seleccion.concepto === "total" && (conceptosActuales.has("reserva") || conceptosActuales.has("diferencia"))) {
        setMensaje(`No se puede registrar pago total para ${nombreCumple} porque ya hay pagos parciales cargados.`);
        return;
      }

      if (seleccion.concepto === "reserva" && conceptosActuales.has("diferencia")) {
        setMensaje(`No se puede registrar reserva para ${nombreCumple} porque ya existe una diferencia cargada.`);
        return;
      }

      if (seleccion.concepto === "diferencia" && !conceptosActuales.has("reserva")) {
        setMensaje(`Para ${nombreCumple}, primero hay que registrar la reserva antes de cargar la diferencia.`);
        return;
      }

      const resExistente = await fetch(
        `${config.supabaseUrl}/rest/v1/cumple_pagos?select=id&reserva_id=eq.${reserva.id}&concepto=eq.${seleccion.concepto}&limit=1`,
        { headers }
      );

      if (!resExistente.ok) {
        const error = await resExistente.json().catch(() => null);
        throw new Error(
          error?.message || "No se pudo consultar la tabla de pagos de cumpleaños."
        );
      }

      const pagosExistentes = await resExistente.json();
      if (Array.isArray(pagosExistentes) && pagosExistentes.length > 0) {
        setMensaje(`Ya existe un pago registrado de ${seleccion.concepto} para ${nombreCumple}.`);
        return;
      }

      const payload = {
        reserva_id: reserva.id,
        concepto: seleccion.concepto,
        monto,
        medio_pago: seleccion.medioPago,
        aplica_promo: !!seleccion.aplicaPromo,
        promo_detalle: seleccion.aplicaPromo ? reserva.promo_detalle || promoCumple || null : null,
      };

      const resInsert = await fetch(`${config.supabaseUrl}/rest/v1/cumple_pagos`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      if (!resInsert.ok) {
        const error = await resInsert.json().catch(() => null);
        throw new Error(error?.message || "No se pudo registrar el pago.");
      }

      setMensaje(`Pago registrado para ${nombreCumple}: ${seleccion.concepto} por ${formatPrecio(monto)}.`);
      setPagosPorReserva((prev) => ({
        ...prev,
        [reserva.id]: [
          {
            id: `${reserva.id}-${seleccion.concepto}-${Date.now()}`,
            reserva_id: reserva.id,
            concepto: seleccion.concepto,
            monto,
            medio_pago: seleccion.medioPago,
            aplica_promo: !!seleccion.aplicaPromo,
            promo_detalle: seleccion.aplicaPromo ? reserva.promo_detalle || promoCumple || null : null,
            creado_en: new Date().toISOString(),
          },
          ...(prev[reserva.id] || []),
        ],
      }));
    } catch (error) {
      const texto = String(error?.message || "");
      if (texto.toLowerCase().includes("cumple_pagos")) {
        setMensaje("No existe la tabla cumple_pagos en Supabase. Hay que crearla para registrar pagos.");
        return;
      }
      setMensaje(texto || "No se pudo registrar el pago.");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-center flex-1">Pagos de Cumples</h2>
        <button
          onClick={() => navigate("/cumples-menu")}
          className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="mb-5 flex flex-wrap gap-4 text-sm">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <div className="text-gray-500">Precio actual</div>
            <div className="text-lg font-semibold text-emerald-700">{formatPrecio(precioCumple)}</div>
          </div>
          <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 flex-1 min-w-[220px]">
            <div className="text-gray-500">Promo vigente</div>
            <div className="text-sm font-medium text-sky-700">{promoCumple || "Sin promo cargada"}</div>
          </div>
        </div>

        {mensaje && <div className="mb-4 text-sm text-emerald-700">{mensaje}</div>}

        {loading ? (
          <p className="text-gray-600">Cargando reservas...</p>
        ) : reservas.length === 0 ? (
          <p className="text-gray-500">No hay reservas pendientes o confirmadas.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reservas.map((reserva) => {
              const seleccion = selecciones[reserva.id] || {
                concepto: String(reserva.estado || "").toLowerCase() === "confirmada" ? "diferencia" : "reserva",
                medioPago: "transferencia",
                aplicaPromo: !!reserva.promo_aplicada,
              };
              const nombreCumple =
                reserva.cumpleanero_nombre || `${reserva.nombre || ""} ${reserva.apellido || ""}`.trim();
              const monto = calcularMonto(
                seleccion.concepto,
                seleccion.aplicaPromo,
                reserva.monto_total,
                reserva.reserva_senia_pct
              );
              const pagosRegistrados = pagosPorReserva[reserva.id] || [];
              const conceptosPagados = new Set(
                pagosRegistrados.map((pago) => String(pago.concepto || "").toLowerCase())
              );
              const pagoCompleto =
                conceptosPagados.has("total") ||
                (conceptosPagados.has("reserva") && conceptosPagados.has("diferencia"));
              const opcionesConcepto = [
                {
                  value: "reserva",
                  disabled: conceptosPagados.has("reserva") || conceptosPagados.has("diferencia") || conceptosPagados.has("total"),
                },
                {
                  value: "diferencia",
                  disabled: !conceptosPagados.has("reserva") || conceptosPagados.has("diferencia") || conceptosPagados.has("total"),
                },
                {
                  value: "total",
                  disabled: conceptosPagados.has("total") || conceptosPagados.has("reserva") || conceptosPagados.has("diferencia"),
                },
              ];
              const conceptoSeleccionadoValido =
                opcionesConcepto.find((opcion) => opcion.value === seleccion.concepto && !opcion.disabled) ||
                opcionesConcepto.find((opcion) => !opcion.disabled);

              return (
                <div key={reserva.id} className="border rounded-xl p-4 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{nombreCumple}</div>
                      <div className="text-sm text-gray-600">
                        {formatFecha(reserva.fecha)} {reserva.hora ? `- ${reserva.hora}` : ""}
                      </div>
                      <div className="text-sm text-gray-600">
                        {reserva.nombre} {reserva.apellido}
                        {reserva.telefono ? ` • ${reserva.telefono}` : ""}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 capitalize">
                      {reserva.estado}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Concepto</label>
                      <select
                        className="w-full border rounded px-3 py-2 text-sm"
                        value={conceptoSeleccionadoValido?.value || seleccion.concepto}
                        onChange={(e) =>
                          setSelecciones((prev) => ({
                            ...prev,
                            [reserva.id]: { ...seleccion, concepto: e.target.value },
                          }))
                        }
                        disabled={pagoCompleto}
                      >
                        {opcionesConcepto.map((opcion) => (
                          <option key={opcion.value} value={opcion.value} disabled={opcion.disabled}>
                            {labelConcepto(opcion.value)}
                            {conceptosPagados.has(opcion.value) ? " - ya registrado" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Medio de pago</label>
                      <select
                        className="w-full border rounded px-3 py-2 text-sm"
                        value={seleccion.medioPago}
                        onChange={(e) =>
                          setSelecciones((prev) => ({
                            ...prev,
                            [reserva.id]: { ...seleccion, medioPago: e.target.value },
                          }))
                        }
                      >
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm font-normal text-gray-700 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={!!seleccion.aplicaPromo}
                          onChange={(e) =>
                            setSelecciones((prev) => ({
                              ...prev,
                              [reserva.id]: { ...seleccion, aplicaPromo: e.target.checked },
                            }))
                          }
                          disabled={!promoCumple || !Number.isFinite(promoMonto)}
                        />
                        Aplica promo vigente
                      </label>
                      {seleccion.aplicaPromo && Number.isFinite(promoMonto) && (
                        <div className="mt-1 text-xs text-sky-700">
                          Monto promocional: {formatPrecio(promoMonto)}
                        </div>
                      )}
                    </div>
                  </div>

                  {pagosRegistrados.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["reserva", "diferencia"].map((concepto) => {
                        const registrado = conceptosPagados.has(concepto);
                        return (
                          <span
                            key={concepto}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              registrado
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-50 text-gray-500 border-gray-200"
                            }`}
                          >
                            {labelConcepto(concepto)}
                            {registrado ? " registrado" : " pendiente"}
                          </span>
                        );
                      })}
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          pagoCompleto
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        Pago completo {pagoCompleto ? "registrado" : "pendiente"}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Monto</div>
                      <div className="text-xl font-semibold text-emerald-700">{formatPrecio(monto)}</div>
                    </div>
                    <button
                      onClick={() => registrarPago(reserva)}
                      disabled={pagoCompleto}
                      className={`text-white text-sm font-medium px-4 py-2 rounded-lg shadow transition ${
                        pagoCompleto
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      }`}
                    >
                      {pagoCompleto ? "Pago completo" : "Registrar pago"}
                    </button>
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Pagos registrados</div>
                    {pagosRegistrados.length === 0 ? (
                      <div className="text-sm text-gray-400">Todavía no hay pagos cargados.</div>
                    ) : (
                      <div className="space-y-2">
                        {pagosRegistrados.map((pago) => (
                          <div
                            key={pago.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-gray-800 capitalize">
                                {pago.concepto} · {pago.medio_pago}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatFecha(String(pago.creado_en || "").slice(0, 10))}
                                {pago.aplica_promo && pago.promo_detalle ? ` · ${pago.promo_detalle}` : ""}
                              </div>
                            </div>
                            <div className="text-sm font-medium text-emerald-700 flex-none">
                              {formatPrecio(pago.monto)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
