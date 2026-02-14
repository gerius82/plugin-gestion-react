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
  const [cumplesHabilitado, setCumplesHabilitado] = useState(false);
  const [mostrarPrecioInfo, setMostrarPrecioInfo] = useState(true);
  const [guardandoHabilitado, setGuardandoHabilitado] = useState(false);
  const [precioCumple, setPrecioCumple] = useState("");
  const [promoCumple, setPromoCumple] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [editPrecio, setEditPrecio] = useState(false);
  const [editPromo, setEditPromo] = useState(false);
  const [precioDraft, setPrecioDraft] = useState("");
  const [promoDraft, setPromoDraft] = useState("");
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

  const formatPrecioInput = (valor) => {
    const digits = String(valor || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatPrecioLabel = (valor) => {
    const num = Number(String(valor || "").replace(/\./g, "").replace(/,/g, "."));
    if (!Number.isFinite(num)) return "";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
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

  const cargarCumplesConfig = async () => {
    if (!config) return;
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/cumples_config?select=*&id=eq.global`,
        { headers }
      );
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : null;
      setCumplesHabilitado(Boolean(row?.habilitado));
      setMostrarPrecioInfo(row?.mostrar_precio !== false);
      const precioTxt = row?.precio != null ? String(row.precio) : "";
      const promoTxt = row?.promo || "";
      setPrecioCumple(precioTxt);
      setPromoCumple(promoTxt);
      setPrecioDraft(precioTxt);
      setPromoDraft(promoTxt);
    } catch {
      setCumplesHabilitado(false);
    }
  };

  const guardarCumplesConfig = async (valor) => {
    if (!config) return;
    setGuardandoHabilitado(true);
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/cumples_config`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ id: "global", habilitado: valor }),
      });
      setCumplesHabilitado(valor);
    } finally {
      setGuardandoHabilitado(false);
    }
  };

  const guardarMostrarPrecioInfo = async (valor) => {
    if (!config) return;
    setGuardandoHabilitado(true);
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/cumples_config`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ id: "global", mostrar_precio: valor }),
      });
      setMostrarPrecioInfo(valor);
    } finally {
      setGuardandoHabilitado(false);
    }
  };

  const guardarPrecioPromo = async (opts = {}) => {
    if (!config) return;
    setGuardandoPrecio(true);
    try {
      const precioNum =
        opts.precio === "" ? null : Number(String(opts.precio || "").replace(/\./g, "").replace(/,/g, "."));
      await fetch(`${config.supabaseUrl}/rest/v1/cumples_config`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: "global",
          precio: Number.isFinite(precioNum) ? precioNum : null,
          promo: opts.promo || null,
        }),
      });
      setPrecioCumple(opts.precio || "");
      setPromoCumple(opts.promo || "");
      setMensaje("Precio actualizado.");
      setTimeout(() => setMensaje(""), 1500);
    } finally {
      setGuardandoPrecio(false);
    }
  };

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
      `?select=id,fecha,hora,nombre,apellido,telefono,mensaje,estado,creado_en,cumpleanero_nombre,cumpleanero_edad,menu_especial,menu_especial_cantidad` +
      `&order=fecha.asc&order=hora.asc`;

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
    if (!config) return;
    cargarCumplesConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

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
        menu_especial: !!reservaForm.menu_especial,
        menu_especial_cantidad: reservaForm.menu_especial ? reservaForm.menu_especial_cantidad || null : null,
        estado: "pendiente",
        creado_en: new Date().toISOString(),
      }),
    });

    if (res.ok) {
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
          <img
            src={IMG_CUMPLES}
            alt="Festeja tu cumple"
            className="w-full h-auto max-h-[520px] object-cover"
          />
        </div>
        {mensaje && (
          <div className="text-center text-sm text-emerald-700 mt-4">{mensaje}</div>
        )}

        <div className="mt-6 w-full">
          <div className="p-3 sm:p-4 w-full">
            <h3 className="text-lg font-semibold mb-2">Gestion de agenda</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={cumplesHabilitado}
                  onChange={(e) => guardarCumplesConfig(e.target.checked)}
                  disabled={guardandoHabilitado}
                />
                <span className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
              </label>
              <span className="text-sm font-medium">
                Habilitar Ficha de cumples en Menú Padres
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={mostrarPrecioInfo}
                  onChange={(e) => guardarMostrarPrecioInfo(e.target.checked)}
                  disabled={guardandoHabilitado}
                />
                <span className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
              </label>
              <span className="text-sm font-medium">Mostrar precio en InfoCumples</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="border rounded-lg p-3 bg-white/70">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Precio del cumple</div>
                  {!editPrecio && (
                    <div className="flex gap-2 text-xs">
                      <button
                        className="text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 transition"
                        onClick={() => {
                          setEditPrecio(true);
                          setPrecioDraft(precioCumple);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition"
                        onClick={async () => {
                          await guardarPrecioPromo({ precio: "", promo: promoCumple });
                          setPrecioDraft("");
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
                {!editPrecio ? (
                  <div className="text-xs text-gray-600 mt-2">
                    {precioCumple ? `Precio actual: ${formatPrecioLabel(precioCumple)}` : "Sin precio"}
                  </div>
                ) : (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="border rounded px-3 py-2 text-sm w-full"
                      value={precioDraft}
                      onChange={(e) => setPrecioDraft(formatPrecioInput(e.target.value))}
                      placeholder="Ej: 570000"
                    />
                    <div className="flex gap-2 mt-2 text-xs">
                      <button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded transition"
                        onClick={async () => {
                          await guardarPrecioPromo({ precio: precioDraft, promo: promoCumple });
                          setEditPrecio(false);
                        }}
                        disabled={guardandoPrecio}
                      >
                        Guardar
                      </button>
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition"
                        onClick={() => {
                          setEditPrecio(false);
                          setPrecioDraft(precioCumple);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-3 bg-white/70">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Promo (texto)</div>
                  {!editPromo && (
                    <div className="flex gap-2 text-xs">
                      <button
                        className="text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 transition"
                        onClick={() => {
                          setEditPromo(true);
                          setPromoDraft(promoCumple);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition"
                        onClick={async () => {
                          await guardarPrecioPromo({ precio: precioCumple, promo: "" });
                          setPromoDraft("");
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
                {!editPromo ? (
                  <div className="text-xs text-gray-600 mt-2">
                    {promoCumple ? `Promo actual: ${promoCumple}` : "Sin promo"}
                  </div>
                ) : (
                  <div className="mt-2">
                    <textarea
                      className="border rounded px-3 py-2 text-sm w-full min-h-[72px]"
                      value={promoDraft}
                      onChange={(e) => setPromoDraft(e.target.value)}
                      placeholder="Ej: Promo lanzamiento reservando en febrero 20% off: $450.000."
                    />
                    <div className="flex gap-2 mt-2 text-xs">
                      <button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded transition"
                        onClick={async () => {
                          await guardarPrecioPromo({ precio: precioCumple, promo: promoDraft });
                          setEditPromo(false);
                        }}
                        disabled={guardandoPrecio}
                      >
                        Guardar
                      </button>
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded transition"
                        onClick={() => {
                          setEditPromo(false);
                          setPromoDraft(promoCumple);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 my-4" />
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

            
            {/* Calendario / agenda */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <div className="min-w-[1260px]">
                  <div className="grid grid-cols-[repeat(7,minmax(180px,1fr))] gap-3 text-center text-xs mb-2 text-gray-500">
                    {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[repeat(7,minmax(180px,1fr))] gap-3">
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
                            <div
                              key={`${d.fecha}-${s.slot_num}`}
                              className="flex flex-wrap items-center gap-2 mb-2"
                            >
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
                </div>
              </div>
            </div>

            {/* Mobile: lista por dia (sin scroll horizontal) */}
            <div className="block md:hidden space-y-3">
              {daysInMonth.map((d) => {
                const slots = slotsPorDia[d.fecha] || [];
                const activos = slots.filter((s) => s.activo && s.hora).length;
                const wd = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][d.weekDay];
                const color =
                  activos === 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";

                return (
                  <div key={d.fecha} className={`rounded-xl border p-3 ${color}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-semibold leading-none">{d.day}</div>
                        <div className="text-xs text-gray-600">{wd}</div>
                        <div className="text-[11px] text-gray-500">{formatFecha(d.fecha)}</div>
                      </div>
                      <div className="text-[11px] text-gray-500">{activos}/2 activos</div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {slots.map((s) => (
                        <div key={`${d.fecha}-${s.slot_num}`} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            className="border rounded px-2 py-2 text-sm w-28"
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
                          <label className="flex items-center gap-2 text-sm">
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
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2">Reservas (todas)</h4>
              {(reservasMes || []).length === 0 ? (
                <div className="text-sm text-gray-500">No hay reservas cargadas.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(reservasMes || []).map((r) => {
                    const estado = String(r.estado || "pendiente").toLowerCase();
                    const badgeCls =
                      estado === "cancelada"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : estado === "confirmada"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-700 border-gray-200";
                    const cumpleNombre = r.cumpleanero_nombre || `${r.nombre || ""} ${r.apellido || ""}`.trim();
                    return (
                      <div key={r.id} className="border rounded-xl p-3 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-gray-900">
                              {cumpleNombre || "Cumpleanero sin nombre"}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">Fecha de reserva</div>
                            <div className="text-xs text-gray-700">{formatFecha(r.fecha)}</div>
                            <div className="mt-1 text-[11px] text-gray-500">Horario</div>
                            <div className="text-xs text-gray-700">{r.hora || "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-500">Contacto</div>
                            <div className="text-xs text-gray-700">
                              {r.nombre} {r.apellido}
                              {r.telefono ? ` • ${r.telefono}` : ""}
                            </div>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded-full border ${badgeCls}`}>
                            {estado || "pendiente"}
                          </span>
                        </div>

                        <div className="mt-3">
                          <label className="text-[11px] text-gray-500">Estado</label>
                          <select
                            className="mt-1 w-full border rounded px-2 py-2 text-sm bg-white"
                            value={r.estado || "pendiente"}
                            onChange={(e) => actualizarEstadoReserva(r.id, e.target.value)}
                          >
                            {ESTADOS_RESERVA.map((e) => (
                              <option key={e} value={e}>
                                {e}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            className="text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 text-xs transition"
                            onClick={() => abrirDetalle(r)}
                          >
                            Ver detalle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
      </div>
    </div>
    </div>
  );
}


