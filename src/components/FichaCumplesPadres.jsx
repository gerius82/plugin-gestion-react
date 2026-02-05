import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const IMG_CUMPLES =
  "https://cvogoablzgymmodegfft.supabase.co/storage/v1/object/sign/cumples/cumples%20info.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWJmYzhjNy0wZGU5LTRkMGQtODc2YS0zODEyNjZmMjRmOWUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjdW1wbGVzL2N1bXBsZXMgaW5mby5wbmciLCJpYXQiOjE3Njg4NzYwODMsImV4cCI6MjA4NDIzNjA4M30.fViNIiMR5BubUrqEqem3H6VQ6bV28MhsIkhy2KsvjGQ";

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

const addMinutes = (hora, minutos) => {
  if (!hora) return "";
  const [h, m] = String(hora).split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + minutos;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export default function FichaCumplesPadres() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const origin = params.get("origin");
  const rutaVolver =
    from === "info-cumples" || from === "cumples-menu"
      ? `/cumples-info${origin ? `?from=${encodeURIComponent(origin)}` : ""}`
      : "/menu-padres";
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
    menu_especial: false,
    menu_especial_cantidad: "",
    menu_opcion: "",
  });

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
      `?select=id,fecha,hora,estado` +
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
  const pasoReserva = slotSeleccionado ? 3 : diaSeleccionado ? 2 : 1;

  const handleReserva = async () => {
    if (!config || !slotSeleccionado) return;
    if (!reservaForm.nombre || !reservaForm.apellido || !reservaForm.telefono) {
      setMensaje("Completa nombre, apellido y telefono.");
      return;
    }
    if (!reservaForm.menu_opcion) {
      setMensaje("Selecciona el menu.");
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
        menu_especial_cantidad: reservaForm.menu_especial
          ? reservaForm.menu_especial_cantidad || null
          : null,
        menu_opcion: reservaForm.menu_opcion || "",
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
        "Solicitud de fecha para Cumple Robótico",
        "",
        "Datos del evento",
        `- Fecha: ${formatFecha(slotSeleccionado.fecha)}`,
        `- Hora: ${slotSeleccionado.hora}`,
        "",
        "Datos de contacto",
        `- Nombre: ${reservaForm.nombre} ${reservaForm.apellido}`,
        `- Teléfono: ${reservaForm.telefono}`,
        "",
        "Cumpleañero/a",
        `- Nombre: ${reservaForm.cumpleanero_nombre || "-"}`,
        `- Edad: ${reservaForm.cumpleanero_edad || "-"}`,
        "",
        "Menú y comida especial",
        `- Menú: ${reservaForm.menu_opcion || "-"}`,
        `- Comida especial: ${menuEspecial}${menuCantidad}`,
        "",
        "Mensaje adicional",
        `${reservaForm.mensaje || "-"}`,
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
      menu_opcion: "",
    });
    setSlotSeleccionado(null);
    await cargarDatosMes();
    setMensaje("Reserva enviada.");
    setTimeout(() => setMensaje(""), 1500);
  };

  return (
    <div className="w-full mt-6 px-2 sm:px-6">
      <div className="w-full">
        <div className="w-full px-3 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between mb-4 gap-4">
          <h2 className="text-2xl font-bold text-center flex-1">Festeja tu cumple</h2>
          <button
            onClick={() => navigate(rutaVolver)}
            className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 flex-none w-auto"
            style={{ border: "1px solid #d1d5db" }}
          >
            Volver
          </button>
        </div>
        <p className="text-sm text-gray-600 text-center max-w-2xl mx-auto">
          Robótica, juegos, baile y una fiesta pensada para chicos. Elegí el día y horario y nosotros
          nos encargamos del resto.
        </p>
      </div>
      <div className="mt-4 overflow-hidden">
        <img src={IMG_CUMPLES} alt="Festeja tu cumple" className="w-full h-auto" />
      </div>
      {mensaje && (
        <div className="text-center text-sm text-emerald-700 mt-4 px-2 sm:px-4">{mensaje}</div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Solicitud de reserva</h3>
        <div className="text-xs sm:text-sm text-gray-600 mb-4 space-y-2">
          <div className="font-semibold text-gray-800">Cómo realizar la reserva del cumpleaños en Plugin</div>
          <div className="font-semibold text-gray-700">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mr-2">
              Paso 1
            </span>
            Elegí la fecha
          </div>
          <div>
            Selecciona la fecha disponible que mejor se adapte a tu familia. Recomendamos elegir con
            tiempo para asegurar lugar.
          </div>
        </div>
<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
          <span className="text-sm font-medium">Mes:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition shadow-md"
              onClick={() => {
                const idx = mesesDisponibles.findIndex((m) => m.value === mesSeleccionado);
                if (idx > 0) setMesSeleccionado(mesesDisponibles[idx - 1].value);
              }}
              aria-label="Mes anterior"
            >{"<"}</button>
            <div className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-800 min-w-[160px] text-center">
              {mesesDisponibles.find((m) => m.value === mesSeleccionado)?.label || "Mes"}
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition shadow-md"
              onClick={() => {
                const idx = mesesDisponibles.findIndex((m) => m.value === mesSeleccionado);
                if (idx >= 0 && idx < mesesDisponibles.length - 1) {
                  setMesSeleccionado(mesesDisponibles[idx + 1].value);
                }
              }}
              aria-label="Mes siguiente"
            >{">"}</button>
          </div>
        </div>

        <div className="w-full">
          <div className="px-2">
            <div>
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] sm:text-xs mb-2 text-gray-500">
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                <div key={d} className="whitespace-nowrap">
                  {d}
                </div>
              ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4 pb-1">
                {Array.from({
                  length: daysInMonth[0] ? (daysInMonth[0].weekDay + 6) % 7 : 0,
                }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {daysInMonth.map((d) => {
                  const slots = slotsPorDia[d.fecha] || [];
                  const disponibles = slots.filter((s) => {
                    if (!s.activo || !s.hora) return false;
                    const key = `${s.fecha}-${s.hora}`;
                    return !reservasPorSlot.has(key);
                  });
                  const disponiblesCount = disponibles.length;
                  const disponibleLabel = disponiblesCount > 0 ? "Disponible" : "No disponible";
                  const isSelected = diaSeleccionado === d.fecha;
                  const color =
                    disponiblesCount === 0
                      ? isSelected
                        ? "bg-red-100 border-red-500 text-red-700 hover:bg-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]"
                        : "bg-red-50 border-red-500 text-red-700 hover:bg-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]"
                      : isSelected
                      ? "bg-emerald-100 border-emerald-500 text-emerald-700 hover:bg-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
                      : "bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]";
                  const selectedCls =
                    isSelected && disponiblesCount === 0
                      ? "ring-2 ring-red-300"
                      : isSelected
                      ? "ring-2 ring-emerald-300"
                      : "ring-1 ring-gray-200";
                  return (
                    <button
                      key={d.fecha}
                      className={`rounded-lg border-2 py-1 text-[8px] sm:text-xs font-medium transition ${color} ${selectedCls} flex flex-col items-center justify-center min-h-[52px] sm:min-h-[64px] w-full`}
                      onClick={() => {
                        setDiaSeleccionado(d.fecha);
                        setSlotSeleccionado(null);
                      }}
                    >
                      <div className="text-base sm:text-3xl font-semibold leading-none">{d.day}</div>
                      <div className="text-[7px] sm:text-[10px] leading-tight text-center px-1">
                        {disponibleLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {diaSeleccionado && (
          <div className="border rounded-xl p-3 mb-4">
                                                <div className="text-xs sm:text-sm text-gray-600 mb-2">
              <div className="font-semibold text-gray-700">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mr-2">
                  Paso 2
                </span>
                Elegi el horario
              </div>
              <div>Ahora selecciona uno de los horarios disponibles para el día elegido.</div>
            </div>

<div className="text-sm font-semibold mb-2">
              Horarios disponibles para {formatFecha(diaSeleccionado)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {slotsDisponibles.map((s, idx) => {
                const isHoraSelected =
                  slotSeleccionado &&
                  slotSeleccionado.fecha === s.fecha &&
                  slotSeleccionado.hora === s.hora;
                const horaCls = isHoraSelected
                  ? "bg-emerald-100 border-emerald-500 text-emerald-800 ring-2 ring-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.5)] hover:bg-emerald-100"
                  : "bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50 ring-1 ring-gray-200 shadow-sm";
                const horaFin = addMinutes(s.hora, 150);
                return (
                  <button
                    key={`${s.fecha}-${s.slot_num}`}
                    className={`w-full rounded-xl border-2 px-4 py-4 text-left transition ${horaCls}`}
                    onClick={() => setSlotSeleccionado(s)}
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">
                      Turno {idx + 1}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                      <span>Hora</span>
                      <span>
                        {s.hora} a {horaFin}hs
                      </span>
                    </div>
                  </button>
                );
              })}
              {slotsDisponibles.length === 0 && (
                <div className="text-xs text-gray-500">No hay horarios disponibles.</div>
              )}
            </div>
          </div>
        )}

        {slotSeleccionado && (
          <div className="border rounded-xl p-4">
                        <div className="text-xs sm:text-sm text-gray-600 mb-2">
              <div className="font-semibold text-gray-700">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mr-2">
                  Paso 3
                </span>
                Completa los datos
              </div>
              <div>
                Carga los datos del cumpleañero/a y del adulto responsable para avanzar con la
                solicitud.
              </div>
            </div>

<div className="text-sm font-semibold mb-2">
              Reserva para {formatFecha(slotSeleccionado.fecha)} de {slotSeleccionado.hora} a{" "}
              {addMinutes(slotSeleccionado.hora, 150)}hs
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Nombre (madre/padre)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={reservaForm.nombre}
                  onChange={(e) => setReservaForm((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Apellido (madre/padre)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={reservaForm.apellido}
                  onChange={(e) => setReservaForm((p) => ({ ...p, apellido: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Teléfono de contacto (revisar que sea correcto)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={reservaForm.telefono}
                  onChange={(e) => setReservaForm((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nombre del cumpleañero</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={reservaForm.cumpleanero_nombre}
                  onChange={(e) =>
                    setReservaForm((p) => ({ ...p, cumpleanero_nombre: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium">Edad que cumple</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={reservaForm.cumpleanero_edad}
                  onChange={(e) =>
                    setReservaForm((p) => ({ ...p, cumpleanero_edad: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-700">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mr-2">
                    Paso 4
                  </span>
                  Elegí el menú
                </span>
                <div>
                Si hay algun niño celíaco, indicalo para preparar una opción especial. 
              </div>
                
              </div>
              <div className="md:col-span-2">
                
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["Patitas de pollo + snacks", "Panchos + snacks"].map((opcion) => {
                    const isActive = reservaForm.menu_opcion === opcion;
                    const cls = isActive
                      ? "bg-emerald-100 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200 hover:bg-emerald-100"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
                    return (
                      <button
                        key={opcion}
                        type="button"
                        className={`w-full rounded-lg border px-3 py-3 text-sm font-medium text-left transition ${cls}`}
                        onClick={() =>
                          setReservaForm((p) => ({ ...p, menu_opcion: opcion }))
                        }
                      >
                        {opcion}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[11px] sm:text-xs font-medium whitespace-nowrap leading-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    checked={!!reservaForm.menu_especial}
                    onChange={(e) =>
                      setReservaForm((p) => ({
                        ...p,
                        menu_especial: e.target.checked,
                        menu_especial_cantidad: e.target.checked ? p.menu_especial_cantidad : "",
                      }))
                    }
                  />
                  Requiere comida especial para celíacos
                </label>
                <input
                  type="number"
                  min="0"
                  className="border rounded px-2 py-1 text-sm w-20 sm:w-24"
                  placeholder="Cantidad"
                  value={reservaForm.menu_especial_cantidad}
                  onChange={(e) =>
                    setReservaForm((p) => ({ ...p, menu_especial_cantidad: e.target.value }))
                  }
                  disabled={!reservaForm.menu_especial}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Observaciones</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                  value={reservaForm.mensaje}
                  onChange={(e) => setReservaForm((p) => ({ ...p, mensaje: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-start mt-3">
              <div className="flex flex-col items-start gap-2">
                <div className="text-sm text-gray-500 text-left">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mr-2">
                    Paso 5
                  </span>
                  Listo, nosotros nos ocupamos del resto. Te mostramos el resumen:
                </div>
                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <div className="font-semibold text-gray-700 mb-1">Resumen de la reserva</div>
                  <div>
                    <span className="font-medium text-gray-500">Fecha:</span>{" "}
                    {formatFecha(slotSeleccionado?.fecha) || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Horario:</span>{" "}
                    {slotSeleccionado?.hora || "-"}
                    {slotSeleccionado?.hora ? ` a ${addMinutes(slotSeleccionado.hora, 150)}hs` : ""}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Contacto:</span>{" "}
                    {reservaForm.nombre || "-"} {reservaForm.apellido || ""}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Telefono:</span>{" "}
                    {reservaForm.telefono || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Cumpleanero:</span>{" "}
                    {reservaForm.cumpleanero_nombre || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Edad:</span>{" "}
                    {reservaForm.cumpleanero_edad || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Menu:</span>{" "}
                    {reservaForm.menu_opcion || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Comida especial:</span>{" "}
                    {reservaForm.menu_especial ? "Si" : "No"}
                    {reservaForm.menu_especial
                      ? ` (${reservaForm.menu_especial_cantidad || 0})`
                      : ""}
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Observaciones:</span>{" "}
                    {reservaForm.mensaje || "-"}
                  </div>
                </div>
                <span className="text-sm text-gray-500 text-left">
                  El mensaje de WhatsApp es para continuar conversando y coordinar el pago la reserva.
                </span>
                <button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded transition"
                  onClick={handleReserva}
                >
                  Enviar solicitud por Whatsapp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
    
  );
}
