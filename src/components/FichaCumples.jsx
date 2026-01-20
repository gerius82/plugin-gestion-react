import { useEffect, useMemo, useState } from "react";

const IMG_CUMPLES =
  "https://cvogoablzgymmodegfft.supabase.co/storage/v1/object/sign/cumples/cumples%20info.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWJmYzhjNy0wZGU5LTRkMGQtODc2YS0zODEyNjZmMjRmOWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjdW1wbGVzL2N1bXBsZXMgaW5mby5wbmciLCJpYXQiOjE3Njg4NzYwODMsImV4cCI6MjA4NDIzNjA4M30.fViNIiMR5BubUrqEqem3H6VQ6bV28MhsIkhy2KsvjGQ";

const ESTADOS_RESERVA = ["pendiente", "confirmada", "cancelada"];
const HORAS_DEFAULT = ["14:30", "18:00"];
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

const toDateKey = (year, monthIndex, day) => {
  const d = new Date(year, monthIndex, day, 12, 0, 0);
  return d.toISOString().slice(0, 10);
};

const parseMonth = (ym) => {
  const [y, m] = String(ym || "").split("-").map((n) => Number(n));
  if (!y || !m) return null;
  return { year: y, monthIndex: m - 1 };
};

const buildMonthDays = (ym) => {
  const info = parseMonth(ym);
  if (!info) return [];
  const { year, monthIndex } = info;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= last; d += 1) {
    days.push({
      day: d,
      fecha: toDateKey(year, monthIndex, d),
      weekDay: new Date(year, monthIndex, d).getDay(),
    });
  }
  return days;
};

export default function FichaCumples() {
  const [config, setConfig] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`;
  });
  const [slotsMes, setSlotsMes] = useState([]);
  const [reservasMes, setReservasMes] = useState([]);
  const [slotsDraft, setSlotsDraft] = useState({});
  const [diaSeleccionado, setDiaSeleccionado] = useState("");
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [reservaForm, setReservaForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    mensaje: "",
    cumpleanero_nombre: "",
    cumpleanero_edad: "",
    invitados: Array.from({ length: 12 }, () => ""),
    menu_especial: false,
    menu_especial_cantidad: "",
  });
  const [reservaDetalle, setReservaDetalle] = useState(null);
  const [modoEditarDetalle, setModoEditarDetalle] = useState(false);
  const [detalleForm, setDetalleForm] = useState(null);

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    const [y, m, d] = String(fecha).split("-");
    if (!y || !m || !d) return fecha;
    return `${d}-${m}-${y}`;
  };

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((cfg) => setConfig(cfg));
  }, []);

  const headers = useMemo(() => {
    if (!config) return {};
    return {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    };
  }, [config]);

  const daysInMonth = useMemo(() => buildMonthDays(mesSeleccionado), [mesSeleccionado]);
  const mesesDisponibles = useMemo(() => {
    const now = new Date();
    const lista = [];
    for (let i = 0; i < 4; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      lista.push({
        value: `${d.getFullYear()}-${mm}`,
        label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return lista;
  }, []);

  const cargarDatosMes = async () => {
    if (!config || !mesSeleccionado) return;
    const info = parseMonth(mesSeleccionado);
    if (!info) return;
    const { year, monthIndex } = info;
    const from = toDateKey(year, monthIndex, 1);
    const to = toDateKey(year, monthIndex + 1, 0);

    const urlSlots =
      `${config.supabaseUrl}/rest/v1/cumple_slots` +
      `?select=id,fecha,hora,activo,slot_num` +
      `&fecha=gte.${from}` +
      `&fecha=lte.${to}`;

    const urlReservas =
      `${config.supabaseUrl}/rest/v1/cumple_reservas` +
      `?select=id,fecha,hora,nombre,apellido,telefono,mensaje,estado,creado_en,cumpleanero_nombre,cumpleanero_edad,invitados,menu_especial,menu_especial_cantidad` +
      `&fecha=gte.${from}` +
      `&fecha=lte.${to}`;

    const [resSlots, resReservas] = await Promise.all([
      fetch(urlSlots, { headers }),
      fetch(urlReservas, { headers }),
    ]);
    const dataSlots = await resSlots.json();
    const dataReservas = await resReservas.json();

    setSlotsMes(Array.isArray(dataSlots) ? dataSlots : []);
    setReservasMes(Array.isArray(dataReservas) ? dataReservas : []);
  };

  useEffect(() => {
    cargarDatosMes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, mesSeleccionado]);

  useEffect(() => {
    const draft = {};
    const slotsMap = new Map(
      (Array.isArray(slotsMes) ? slotsMes : []).map((s) => [`${s.fecha}-${s.slot_num}`, s])
    );

    daysInMonth.forEach((d) => {
      [1, 2].forEach((slotNum, idx) => {
        const key = `${d.fecha}-${slotNum}`;
        const existing = slotsMap.get(key);
        draft[key] = {
          id: existing?.id || null,
          fecha: d.fecha,
          slot_num: slotNum,
          hora: existing?.hora || HORAS_DEFAULT[idx],
          activo: existing?.activo ?? false,
        };
      });
    });

    setSlotsDraft(draft);
  }, [slotsMes, daysInMonth]);

  const reservasPorSlot = useMemo(() => {
    const map = new Map();
    (Array.isArray(reservasMes) ? reservasMes : []).forEach((r) => {
      const estado = String(r.estado || "").toLowerCase();
      if (estado === "cancelada") return;
      const key = `${r.fecha}-${r.hora}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [reservasMes]);

  const guardarSlots = async () => {
    if (!config) return;
    const pendientes = Object.values(slotsDraft);
    for (const slot of pendientes) {
      if (slot.activo && !slot.hora) {
        setMensaje("Completa el horario para los slots activos.");
        return;
      }
    }

    setMensaje("Guardando cambios...");
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    for (const slot of pendientes) {
      const payload = {
        fecha: slot.fecha,
        slot_num: slot.slot_num,
        hora: slot.hora || null,
        activo: !!slot.activo,
      };

      if (slot.id) {
        await fetch(`${config.supabaseUrl}/rest/v1/cumple_slots?id=eq.${slot.id}`, {
          method: "PATCH",
          headers: headersJson,
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${config.supabaseUrl}/rest/v1/cumple_slots`, {
          method: "POST",
          headers: headersJson,
          body: JSON.stringify(payload),
        });
      }
    }

    await cargarDatosMes();
    setMensaje("Cambios guardados.");
    setTimeout(() => setMensaje(""), 1500);
  };

  const handleReserva = async () => {
    if (!config || !slotSeleccionado) return;
    if (!reservaForm.nombre || !reservaForm.apellido || !reservaForm.telefono) {
      setMensaje("Completa nombre, apellido y telefono.");
      return;
    }

    setMensaje("Enviando reserva...");
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const res = await fetch(`${config.supabaseUrl}/rest/v1/cumple_reservas`, {
      method: "POST",
      headers: headersJson,
      body: JSON.stringify({
        fecha: slotSeleccionado.fecha,
        hora: slotSeleccionado.hora,
        nombre: reservaForm.nombre,
        apellido: reservaForm.apellido,
        telefono: reservaForm.telefono,
        mensaje: reservaForm.mensaje || "",
        cumpleanero_nombre: reservaForm.cumpleanero_nombre || "",
        cumpleanero_edad: reservaForm.cumpleanero_edad || null,
        invitados: reservaForm.invitados || [],
        menu_especial: !!reservaForm.menu_especial,
        menu_especial_cantidad: reservaForm.menu_especial ? reservaForm.menu_especial_cantidad || null : null,
        estado: "pendiente",
        creado_en: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      const invitadosTxt = (reservaForm.invitados || []).filter(Boolean).join(", ");
      const menuEspecial = reservaForm.menu_especial ? "Si" : "No";
      const menuCantidad = reservaForm.menu_especial
        ? ` (${reservaForm.menu_especial_cantidad || 0})`
        : "";
      const detalleMsg = [
        "Solicitud cumple",
        `Fecha: ${formatFecha(slotSeleccionado.fecha)}`,
        `Hora: ${slotSeleccionado.hora}`,
        `Contacto: ${reservaForm.nombre} ${reservaForm.apellido}`,
        `Telefono: ${reservaForm.telefono}`,
        `Cumpleanero: ${reservaForm.cumpleanero_nombre || "-"}`,
        `Edad: ${reservaForm.cumpleanero_edad || "-"}`,
        `Invitados: ${invitadosTxt || "-"}`,
        `Menu especial: ${menuEspecial}${menuCantidad}`,
        `Mensaje: ${reservaForm.mensaje || "-"}`,
      ].join("\n");
      const waUrl = `https://wa.me/5493415064891?text=${encodeURIComponent(detalleMsg)}`;
      window.open(waUrl, "_blank");
    }

    setReservaForm({
      nombre: "",
      apellido: "",
      telefono: "",
      mensaje: "",
      cumpleanero_nombre: "",
      cumpleanero_edad: "",
      invitados: Array.from({ length: 12 }, () => ""),
      menu_especial: false,
      menu_especial_cantidad: "",
    });
    setSlotSeleccionado(null);
    await cargarDatosMes();
    setMensaje("Reserva enviada.");
    setTimeout(() => setMensaje(""), 1500);
  };

  const actualizarEstadoReserva = async (id, estado) => {
    if (!config || !id) return;
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    await fetch(`${config.supabaseUrl}/rest/v1/cumple_reservas?id=eq.${id}`, {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify({ estado }),
    });
    await cargarDatosMes();
  };

  const abrirDetalle = (reserva) => {
    setReservaDetalle(reserva);
    setModoEditarDetalle(false);
    setDetalleForm({
      nombre: reserva?.nombre || "",
      apellido: reserva?.apellido || "",
      telefono: reserva?.telefono || "",
      mensaje: reserva?.mensaje || "",
      cumpleanero_nombre: reserva?.cumpleanero_nombre || "",
      cumpleanero_edad: reserva?.cumpleanero_edad ?? "",
      invitados: Array.isArray(reserva?.invitados)
        ? reserva.invitados
        : Array.from({ length: 12 }, () => ""),
      menu_especial: !!reserva?.menu_especial,
      menu_especial_cantidad: reserva?.menu_especial_cantidad ?? "",
      estado: reserva?.estado || "pendiente",
    });
  };

  const guardarDetalle = async () => {
    if (!config || !reservaDetalle) return;
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    const payload = {
      nombre: detalleForm?.nombre || "",
      apellido: detalleForm?.apellido || "",
      telefono: detalleForm?.telefono || "",
      mensaje: detalleForm?.mensaje || "",
      cumpleanero_nombre: detalleForm?.cumpleanero_nombre || "",
      cumpleanero_edad: detalleForm?.cumpleanero_edad || null,
      invitados: detalleForm?.invitados || [],
      menu_especial: !!detalleForm?.menu_especial,
      menu_especial_cantidad: detalleForm?.menu_especial
        ? detalleForm?.menu_especial_cantidad || null
        : null,
      estado: detalleForm?.estado || "pendiente",
    };

    await fetch(`${config.supabaseUrl}/rest/v1/cumple_reservas?id=eq.${reservaDetalle.id}`, {
      method: "PATCH",
      headers: headersJson,
      body: JSON.stringify(payload),
    });
    await cargarDatosMes();
    setReservaDetalle((prev) => (prev ? { ...prev, ...payload } : prev));
    setDetalleForm((prev) => (prev ? { ...prev, ...payload } : prev));
    setModoEditarDetalle(false);
  };

  const eliminarDetalle = async () => {
    if (!config || !reservaDetalle) return;
    const confirmar = confirm("Eliminar esta reserva?");
    if (!confirmar) return;
    const headersJson = {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    await fetch(`${config.supabaseUrl}/rest/v1/cumple_reservas?id=eq.${reservaDetalle.id}`, {
      method: "DELETE",
      headers: headersJson,
    });
    await cargarDatosMes();
    setReservaDetalle(null);
    setModoEditarDetalle(false);
  };

  const slotsPorDia = useMemo(() => {
    const map = {};
    Object.values(slotsDraft).forEach((s) => {
      map[s.fecha] = map[s.fecha] || [];
      map[s.fecha].push(s);
    });
    Object.keys(map).forEach((f) => {
      map[f].sort((a, b) => a.slot_num - b.slot_num);
    });
    return map;
  }, [slotsDraft]);

  const slotsDisponibles = useMemo(() => {
    if (!diaSeleccionado) return [];
    return (slotsPorDia[diaSeleccionado] || []).filter((s) => {
      if (!s.activo || !s.hora) return false;
      const key = `${s.fecha}-${s.hora}`;
      return !reservasPorSlot.has(key);
    });
  }, [diaSeleccionado, slotsPorDia, reservasPorSlot]);

  return (
    <div className="w-full mt-6 px-2 sm:px-4">
      <div className="p-4 sm:p-6 mb-4 w-full">
        <h2 className="text-2xl font-bold mb-2 text-center">Festeja tu cumple</h2>
        <p className="text-sm text-gray-600 text-center max-w-2xl mx-auto">
          Robotica, juegos, baile y una fiesta pensada para chicos. Elegi el dia y horario y nosotros
          nos encargamos del resto.
        </p>
        <div className="mt-4 overflow-hidden">
          <img src={IMG_CUMPLES} alt="Festeja tu cumple" className="w-full h-auto" />
        </div>
        {mensaje && (
          <div className="text-center text-sm text-emerald-700 mt-4">{mensaje}</div>
        )}

        <div className="mt-6 w-full">
          <div className="p-3 sm:p-4 w-full">
            <h3 className="text-lg font-semibold mb-4">Gestion de agenda</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <label className="text-sm font-medium">Mes:</label>
              <select
                className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
              >
                {mesesDisponibles.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                className="sm:ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded transition w-full sm:w-auto"
                onClick={guardarSlots}
              >
                Guardar cambios
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs mb-2 text-gray-500">
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 w-full">
              {Array.from({
                length: daysInMonth[0] ? (daysInMonth[0].weekDay + 6) % 7 : 0,
              }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {daysInMonth.map((d) => {
                const slots = slotsPorDia[d.fecha] || [];
                const activos = slots.filter((s) => s.activo && s.hora).length;
                const color =
                  activos === 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";

                return (
                  <div key={d.fecha} className={`rounded-xl border p-3 sm:p-4 ${color}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl font-semibold text-gray-800 leading-none">
                        {d.day}
                      </span>
                      <span className="text-[11px] text-gray-500">{activos}/2 activos</span>
                    </div>
                    {slots.map((s) => (
                      <div key={`${d.fecha}-${s.slot_num}`} className="flex flex-wrap items-center gap-2 mb-2">
                        <input
                          type="time"
                          className="border rounded px-2 py-1 text-xs w-full sm:w-24"
                          value={s.hora || ""}
                          onChange={(e) =>
                            setSlotsDraft((prev) => ({
                              ...prev,
                              [`${s.fecha}-${s.slot_num}`]: {
                                ...s,
                                hora: e.target.value,
                              },
                            }))
                          }
                        />
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={!!s.activo}
                            onChange={(e) =>
                              setSlotsDraft((prev) => ({
                                ...prev,
                                [`${s.fecha}-${s.slot_num}`]: {
                                  ...s,
                                  activo: e.target.checked,
                                },
                              }))
                            }
                          />
                          Activo
                        </label>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2">Reservas del mes</h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 text-[11px] sm:text-sm">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Hora</th>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-left">Telefono</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reservasMes || []).map((r) => {
                      const estado = String(r.estado || "").toLowerCase();
                      const filaCls =
                        estado === "cancelada"
                          ? "border-t bg-red-50"
                          : estado === "confirmada"
                          ? "border-t bg-emerald-50"
                          : "border-t";
                      return (
                        <tr key={r.id} className={filaCls}>
                          <td className="px-3 py-2">{formatFecha(r.fecha)}</td>
                          <td className="px-3 py-2">{r.hora}</td>
                          <td className="px-3 py-2">{r.nombre} {r.apellido}</td>
                          <td className="px-3 py-2">{r.telefono}</td>
                          <td className="px-3 py-2">
                            <select
                              className="border rounded px-2 py-1 text-xs"
                              value={r.estado || "pendiente"}
                              onChange={(e) => actualizarEstadoReserva(r.id, e.target.value)}
                            >
                              {ESTADOS_RESERVA.map((e) => (
                                <option key={e} value={e}>{e}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              className="text-xs text-emerald-700 hover:text-emerald-900 transition px-2 py-1 rounded hover:bg-emerald-50"
                              onClick={() => abrirDetalle(r)}
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(!reservasMes || reservasMes.length === 0) && (
                      <tr>
                        <td colSpan="6" className="px-3 py-3 text-center text-gray-500">
                          Sin reservas en este mes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      {reservaDetalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-emerald-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-white px-6 py-4 border-b border-emerald-100">
              <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">Detalle de la reserva</h4>
                <p className="text-xs text-gray-500">
                  {formatFecha(reservaDetalle.fecha)} - {reservaDetalle.hora}
                </p>
              </div>
            </div>
            </div>

            <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-gray-500">
                  Estado actual: <span className="capitalize">{reservaDetalle.estado || "pendiente"}</span>
                </div>
              </div>

              {modoEditarDetalle ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium">Nombre</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.nombre || ""}
                    onChange={(e) => setDetalleForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Apellido</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.apellido || ""}
                    onChange={(e) => setDetalleForm((p) => ({ ...p, apellido: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Telefono</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.telefono || ""}
                    onChange={(e) => setDetalleForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Estado</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.estado || "pendiente"}
                    onChange={(e) => setDetalleForm((p) => ({ ...p, estado: e.target.value }))}
                  >
                    {ESTADOS_RESERVA.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Cumpleanero</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.cumpleanero_nombre || ""}
                    onChange={(e) =>
                      setDetalleForm((p) => ({ ...p, cumpleanero_nombre: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Edad</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={detalleForm?.cumpleanero_edad ?? ""}
                    onChange={(e) =>
                      setDetalleForm((p) => ({ ...p, cumpleanero_edad: e.target.value }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">Invitados</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    {(detalleForm?.invitados || Array.from({ length: 12 }, () => "")).map((inv, idx) => (
                      <input
                        key={`det-inv-${idx}`}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder={`Invitado ${idx + 1}`}
                        value={inv}
                        onChange={(e) =>
                          setDetalleForm((p) => {
                            const nuevos = [...(p?.invitados || [])];
                            while (nuevos.length < 12) nuevos.push("");
                            nuevos[idx] = e.target.value;
                            return { ...p, invitados: nuevos };
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={!!detalleForm?.menu_especial}
                      onChange={(e) =>
                        setDetalleForm((p) => ({
                          ...p,
                          menu_especial: e.target.checked,
                          menu_especial_cantidad: e.target.checked ? p.menu_especial_cantidad : "",
                        }))
                      }
                    />
                    Requiere comida especial para celiacos
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="border rounded px-2 py-1 text-sm w-24"
                    placeholder="Cantidad"
                    value={detalleForm?.menu_especial_cantidad ?? ""}
                    onChange={(e) =>
                      setDetalleForm((p) => ({ ...p, menu_especial_cantidad: e.target.value }))
                    }
                    disabled={!detalleForm?.menu_especial}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">Mensaje</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                    value={detalleForm?.mensaje || ""}
                    onChange={(e) => setDetalleForm((p) => ({ ...p, mensaje: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded transition"
                    onClick={guardarDetalle}
                  >
                    Guardar
                  </button>
                  <button
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded transition"
                    onClick={eliminarDetalle}
                  >
                    Eliminar
                  </button>
                  <button
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded transition"
                    onClick={() => {
                      setModoEditarDetalle(false);
                      setDetalleForm({
                        nombre: reservaDetalle?.nombre || "",
                        apellido: reservaDetalle?.apellido || "",
                        telefono: reservaDetalle?.telefono || "",
                        mensaje: reservaDetalle?.mensaje || "",
                        cumpleanero_nombre: reservaDetalle?.cumpleanero_nombre || "",
                        cumpleanero_edad: reservaDetalle?.cumpleanero_edad ?? "",
                        invitados: Array.isArray(reservaDetalle?.invitados)
                          ? reservaDetalle.invitados
                          : Array.from({ length: 12 }, () => ""),
                        menu_especial: !!reservaDetalle?.menu_especial,
                        menu_especial_cantidad: reservaDetalle?.menu_especial_cantidad ?? "",
                        estado: reservaDetalle?.estado || "pendiente",
                      });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Contacto</div>
                  <div>{reservaDetalle.nombre} {reservaDetalle.apellido}</div>
                  <div>{reservaDetalle.telefono}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Cumpleanero</div>
                  <div>{reservaDetalle.cumpleanero_nombre || "-"}</div>
                  <div>{reservaDetalle.cumpleanero_edad || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Menu especial</div>
                  <div>
                    {reservaDetalle.menu_especial ? "Si" : "No"}
                    {reservaDetalle.menu_especial
                      ? ` (${reservaDetalle.menu_especial_cantidad || 0})`
                      : ""}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-500 text-xs">Invitados</div>
                  <div className="text-sm">
                    {Array.isArray(reservaDetalle.invitados) && reservaDetalle.invitados.filter(Boolean).length
                      ? reservaDetalle.invitados.filter(Boolean).join(", ")
                      : "—"}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-500 text-xs">Mensaje</div>
                  <div className="text-sm">{reservaDetalle.mensaje || "-"}</div>
                </div>
                <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded transition"
                    onClick={() => setModoEditarDetalle(true)}
                  >
                    Editar
                  </button>
                  <button
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded transition"
                    onClick={() => {
                      setReservaDetalle(null);
                      setModoEditarDetalle(false);
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


