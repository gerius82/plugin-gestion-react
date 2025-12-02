/*
  Formulario de Inscripción modificado para que al confirmar solo se muestre el mensaje de éxito
*/

import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import "../assets/formulario.css";
import { useNavigate, useSearchParams } from "react-router-dom";

const FormularioInscripcionVerano = () => {
  const navigate = useNavigate();
  const [mensajeExito, setMensajeExito] = useState("");
  const [config, setConfig] = useState(null);
  const [turnos, setTurnos] = useState({});
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);
  const [telefonoValido, setTelefonoValido] = useState(true);
  const [emailValido, setEmailValido] = useState(true);
  const [turnoEnListaEspera, setTurnoEnListaEspera] = useState(false);
  const [searchParams] = useSearchParams();
  const origen = searchParams.get("origen");
  const from = searchParams.get("from");

  const rutaSalida =
  origen === "gestion"
    ? "/menu-gestion"
    : from === "menu-intermedio"
    ? "/menu-inscripcion-padres"
    : "/menu-padres";


  const [formulario, setFormulario] = useState({
    nombre: "",
    apellido: "",
    edad: "",
    escuela: "",
    responsable: "",
    telefono: "",
    email: "",
    sede: "",
    curso: "Taller de Verano",
    turno_1: "",
    comentarios: ""
  });

  const TIPO_INSCRIPCION = "TDV";


  const limpiarFormulario = () => {
    setFormulario({
      nombre: "",
      apellido: "",
      edad: "",
      escuela: "",
      responsable: "",
      telefono: "",
      email: "",
      sede: "",
      curso: "Taller de Verano",
      turno_1: "",
      comentarios: ""
    });
    setTurnoEnListaEspera(false);
  };

  const mostrarResumenTurno = () => {
    if (turnoEnListaEspera) {
      return (
        <p className="text-red-600 text-sm mt-2">
          Este turno está completo. Quedarás en lista de espera y te avisaremos cuando se libere un lugar.
        </p>
      );
    }
    return null;
  };

  const [mostrarResumen, setMostrarResumen] = useState(false);

  const direcciones = {
    Fisherton: "Eva Perón 8128",
    "Calle Mendoza": "Mendoza 3024"
  };

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));

    fetch("/turnos_verano.json")
      .then((res) => res.json())
      .then((data) => setTurnos(data));

    emailjs.init("Vkl0XSUcG-KApScqq");
  }, []);

  const handleChange = async (e) => {
    const { id, value } = e.target;
    setFormulario((prev) => ({ ...prev, [id]: value }));

    if (id === "telefono") {
      const soloNumeros = /^\d*$/;
      setTelefonoValido(soloNumeros.test(value));
    }

    if (id === "email") {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValido(regex.test(value));
    }

    if (id === "sede" && value) {
      const nuevosTurnos = await cargarTurnosDisponibles(value);
      setTurnosDisponibles(nuevosTurnos);
    }
  };

  const cargarTurnosDisponibles = async (sedeSeleccionada) => {
    if (!config || !sedeSeleccionada || !turnos[sedeSeleccionada]) return [];

    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/inscripciones?select=turno_1&activo=eq.true&sede=eq.${encodeURIComponent(
        sedeSeleccionada
      )}&tipo_inscripcion=eq.${TIPO_INSCRIPCION}`,
      {
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`
        }
      }
    );
    const data = await response.json();

    const conteo = {};
    data.forEach(({ turno_1 }) => {
      const turno = turno_1?.trim();
      if (turno) conteo[turno] = (conteo[turno] || 0) + 1;
    });

    return Object.entries(turnos[sedeSeleccionada]).map(([turno, max]) => {
      const cantidad = conteo[turno] || 0;
      const lleno = cantidad >= max;
      return {
        turno,
        label: turno,
        lleno
      };
    });
  };

  const cursosDisponibles = () => {
    const edad = parseInt(formulario.edad);
    return [
      { nombre: "Robótica Básica", habilitado: true },
      { nombre: "Robótica Avanzada", habilitado: true },
      { nombre: "Programación con Scratch", habilitado: edad >= 8 },
      { nombre: "Arduino", habilitado: false }
    ];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMostrarResumen(true);
  };

  const confirmarEnvio = async () => {
    setMostrarResumen(false);
    setMensajeExito("Procesando inscripción... Esto puede tardar unos segundos.");
    window.scrollTo({ top: 0, behavior: "smooth" });

    (async () => {
        if (!config) return;
        const payload = {
          ...formulario,
          edad: parseInt(formulario.edad),
          creado_en: new Date().toISOString(),
          tipo_inscripcion: TIPO_INSCRIPCION,   // 👈 marca que es Taller de Verano
        };
    
        try {
          const res = await fetch(`${config.supabaseUrl}/rest/v1/inscripciones`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: config.supabaseKey,
              Authorization: `Bearer ${config.supabaseKey}`
            },
            body: JSON.stringify(payload)
          });
    
          if (res.ok) {
            await emailjs.send("service_efu6ess", "template_92ev0wo", {
              nombre: formulario.nombre,
              apellido: formulario.apellido,
              edad: formulario.edad,
              responsable: formulario.responsable,
              telefono: formulario.telefono,
              email: formulario.email,
              sede: formulario.sede,
              curso: formulario.curso,
              turno_1: formulario.turno_1,
              escuela: formulario.escuela,
              comentarios: formulario.comentarios,
              lista_espera: turnosDisponibles.find((t) => t.turno === formulario.turno_1)?.lleno ? "Sí" : "No"
            });
    
            // ✅ Actualizamos mensaje final
            setMensajeExito(
              "✅ Inscripción enviada correctamente. También se envió un correo de confirmación."
            );
          } else {
            setMensajeExito("❌ Ocurrió un error al enviar la inscripción. Intenta nuevamente.");
          }
        } catch (error) {
          console.error(error);
          setMensajeExito("❌ Error de conexión. Intenta nuevamente más tarde.");
        }
      })();
    };

  return (
    <div className="max-w-[700px] w-full mx-auto p-8 bg-white rounded-xl shadow-lg mt-8">

      {mensajeExito ? (
        // ✅ Solo mensaje de éxito final
        <div className="mt-6 p-4 border-l-4 border-green-400 bg-green-50 text-green-800 rounded animate-fadeIn">
          <h4 className="text-lg font-semibold mb-1">
            ✅ ¡Inscripción completada con éxito!
          </h4>
          <p className="text-sm leading-relaxed">{mensajeExito}</p>
          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={() => {
                limpiarFormulario();
                setMensajeExito("");
                setMostrarResumen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Inscribir otro alumno
            </button>
            <button
              onClick={() => {
                setMensajeExito("");
                setMostrarResumen(false);
                limpiarFormulario();
                navigate(rutaSalida);
              }}
              className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Terminar
            </button>
          </div>
        </div>
      ) : !mostrarResumen ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-center mb-6">Info e Inscripción Taller de Verano</h2>
          {/* Información introductoria del taller */}
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-sm animate-fadeIn">
            <h3 className="text-xl font-semibold text-yellow-700 mb-2">
              ☀️🤖¡Verano 2026 a pura creatividad con LEGO & Robótica!⚙️
            </h3>

            <p className="text-sm text-gray-700 leading-relaxed">
              Una propuesta pensada para chicos y chicas de <strong>5 a 12 años</strong> que quieran explorar, construir y divertirse mientras aprenden.
              Durante las vacaciones nos encontramos para vivir experiencias llenas de creatividad, tecnología y juego. No hace falta experiencia previa: solo ganas de experimentar y pasarlo bien. 😄
            </p>

            {/* Sedes */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">📍 Sedes disponibles:</p>
            <ul className="text-sm text-gray-800 space-y-1 mt-1">
              <li>🏫 <strong>Mendoza 3024 – Rosario (Macrocentro)</strong></li>
              <li>🏫 <strong>Eva Perón 8128 – Rosario (Fisherton)</strong></li>
            </ul>

            {/* Duración, fechas, modalidad */}
            <ul className="mt-4 space-y-1 text-sm text-gray-800">
              <li>📅 <strong>Duración:</strong> 2 meses (8 clases)</li>
              <li>🗓️ <strong>Inicio:</strong> Lunes 5 de enero</li>
              <li>🧩 <strong>Modalidad:</strong> 1 clase por semana de 90 minutos cada una</li>
            </ul>

            {/* Días y horarios */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">🕒 Días y horarios disponibles:</p>
            <ul className="text-sm text-gray-800 space-y-1">
              <li>👉 <strong>Martes:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Miércoles:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Jueves:</strong> 17:00 a 18:30hs · 19:00 a 20:30hs</li>
              <li>👉 <strong>Sábados:</strong> 09:00 a 10:30hs · 11:00 a 12:30hs</li>
            </ul>

            {/* Precios y formas de pago */}
            <p className="text-sm text-gray-700 mt-4 font-semibold">💳 Formas de pago</p>

            <ul className="mt-1 text-sm text-gray-800 space-y-1">
              <li>
                 🔒 <strong>Reserva de cupo:</strong> Inscripción mínima de <strong>$10.000</strong> para asegurar el lugar.
              </li>

              <li>
                 🎉 <strong>Primera clase de prueba:</strong> El taller se abona recién después de la primera clase, cuando el alumno ya vivió la experiencia y decide continuar.
              </li>

              <li>
                 💰 <strong>Opción 1 – Pago completo con descuento: </strong>  
                Si abonás el taller completo al inicio (después de la clase de prueba), obtenés un <strong>5% de descuento</strong>, quedando en <strong>$95.000</strong>.
              </li>

              <li>
                 💸 <strong>Opción 2 – Pago en cuotas: </strong>  
                $50.000 en enero y $50.000 en febrero.
              </li>
            </ul>

            <p className="text-sm text-gray-700 mt-3">
              Queremos que cada familia elija la modalidad que mejor se adapte a su momento, siempre priorizando la experiencia y el bienestar de los chicos.
            </p>
          </div>




            {/* Sección: Datos del alumno */}
            <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del alumno</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-tight">Completá los datos para inscribirte al Taller de Verano de Plugin Robótica.</p>
                <hr className="border-gray-200 mt-1" />
            </div>

          {/* Nombre */}
          <div>
            <label htmlFor="nombre" className="block font-medium mb-1">Nombre:</label>
            <input
              id="nombre"
              type="text"
              placeholder="Nombre del alumno/a"
              value={formulario.nombre}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          {/* Apellido */}
          <div>
            <label htmlFor="apellido" className="block font-medium mb-1">Apellido:</label>
            <input
              id="apellido"
              type="text"
              placeholder="Apellido del alumno/a"
              value={formulario.apellido}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          {/* Edad */}
          <div>
            <label htmlFor="edad" className="block font-medium mb-1">Edad:</label>
            <input
              id="edad"
              type="number"
              value={formulario.edad}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          {/* Escuela */}
          <div>
            <label htmlFor="escuela" className="block font-medium mb-1">Escuela:</label>
            <input
              id="escuela"
              type="text"
              value={formulario.escuela}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            />
          </div>
        {/* Sección: Datos del responsable */}
        <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Datos del responsable</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-tight">Necesitamos estos datos para contactarnos.</p>
            <hr className="border-gray-200 mt-1" />
        </div>

          {/* Responsable */}
          <div>
            <label htmlFor="responsable" className="block font-medium mb-1">Responsable:</label>
            <input
              id="responsable"
              type="text"
              value={formulario.responsable}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
          </div>

          {/* Teléfono */}
          <div>
            <label htmlFor="telefono" className="block font-medium mb-1">Teléfono:</label>
            <input
              id="telefono"
              type="text"
              placeholder="Formato sugerido: 3415076241"
              value={formulario.telefono}
              onChange={handleChange}
              className={`w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition ${
                telefonoValido ? "border-gray-300 focus:ring-green-100" : "border-red-300 focus:ring-red-100"
              }`}
              required
            />
            {!telefonoValido && <p className="text-red-500 text-sm mt-1">Solo números</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block font-medium mb-1">Email:</label>
            <input
              id="email"
              type="email"
              placeholder="ejemplo@correo.com"
              value={formulario.email}
              onChange={handleChange}
              className="w-full max-w-sm mx-auto border border-gray-300 rounded-lg p-2 sm:p-3 placeholder-gray-400 placeholder:italic text-sm sm:text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-100 transition"
              required
            />
            {!emailValido && (
              <p className="text-red-500 text-sm">Ingresa un email válido de la forma ejemplo@correo.com</p>
            )}
          </div>

            {/* Sección: Seleccioná la sede */}
          <div className="mb-3 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">Seleccioná la sede</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-tight">Elegí la sede donde se cursará el taller.</p>
              <hr className="border-gray-200 mt-1" />
          </div>

          {/* Sedes */}
          <div>
            {/*<label className="block font-medium mb-2">Selecciona la sede:</label>*/}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {Object.keys(turnos).map((sede) => {
                const seleccionada = formulario.sede === sede;
                return (
                  <button
                    key={sede}
                    type="button"
                    onClick={() => handleChange({ target: { id: "sede", value: sede } })}
                    className={`p-2 rounded-lg border shadow-md text-center transition-transform duration-200 ${
                      seleccionada
                        ? "bg-green-100 border-green-200 ring-2 ring-green-300 hover:bg-green-300"
                        : "bg-white border-gray-200 hover:bg-gray-50 hover:scale-105"
                    }`}
                  >
                    <h4 className="text-lg">{sede}</h4>
                    <p className="text-sm text-gray-500">{direcciones[sede]}</p>
                  </button>
                );
              })}
            </div>
          </div>

        

        {/* Curso */}
        <div className="mb-4 w-full p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 leading-snug">
                Elección de taller
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
                Único curso disponible.
            </p>

            <div className="p-4 rounded-lg border border-green-300 bg-green-50 shadow-sm">
                <h4 className="text-lg font-semibold">Robótica con Lego</h4>
                <p className="text-sm text-gray-700">
                Propuestas creativas de robótica y programación para pasar unas vacaciones diferentes.
                </p>
                <span className="text-xs text-green-700">
                Taller de Verano
                </span>
            </div>
        </div>


          {/* Turnos */}
          {formulario.sede && (
            <div>
              <label htmlFor="turno_1" className="block font-medium mb-1">Turno preferido:</label>
              <p className="text-sm text-gray-600 mb-2">
                <span className="inline-block w-4 h-4 bg-green-100 border border-green-500 mr-2"></span>Disponible
                <span className="inline-block w-4 h-4 bg-red-50 border border-red-300 ml-4 mr-2"></span>Lista de espera
              </p>

              {turnosDisponibles.length === 0 && (
                <p className="text-center text-gray-500 mb-4">No hay turnos disponibles para esta sede.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {turnosDisponibles.map(({ turno, label, lleno }) => (
                  <button
                    key={turno}
                    type="button"
                    onClick={() => {
                      setFormulario((prev) => ({ ...prev, turno_1: turno }));
                      setTurnoEnListaEspera(lleno);
                    }}
                    className={`p-4 rounded-lg border shadow-md text-left transition-transform duration-200 ${
                      lleno
                        ? formulario.turno_1 === turno
                          ? "bg-red-100 border-red-200 text-red-700 ring-2 ring-red-200 hover:bg-red-200"
                          : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:scale-105"
                        : formulario.turno_1 === turno
                        ? "bg-green-100 border-green-200 text-green-700 ring-2 ring-green-300 hover:bg-green-300"
                        : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:scale-105"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comentarios */}
          <div>
            <label htmlFor="comentarios" className="block font-medium mb-1">Comentarios:</label>
            <textarea
              id="comentarios"
              placeholder="Información adicional o preguntas"
              value={formulario.comentarios}
              onChange={handleChange}
              rows="3"
              className="w-full border border-gray-300 rounded-lg p-3 placeholder-gray-400 placeholder:italic placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-green-100 transition"
            />
          </div>

        {/* Botones del formulario principal */}
        {!mostrarResumen && !mensajeExito && (
        <div className="flex justify-center gap-4 mt-6">
            <button
            onClick={() => {
               
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full max-w-sm mx-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-4 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
            Siguiente
            </button>
            <button
            onClick={() => {
                navigate(rutaSalida);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full max-w-sm mx-auto bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 sm:py-3 px-4 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
            Volver
            </button>
        </div>
        )}






        </form>
        
      ) : (
        <div>
          {/* Título del resumen */}
            <div className="mb-4 p-4 rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800">Resumen de inscripción</h3>
            <p className="text-sm text-gray-600">Verificá que todos los datos sean correctos antes de confirmar.</p>
            <hr className="border-gray-200 mt-1" />
            </div>

            {/* Datos agrupados */}
            <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Datos del alumno</h4>
                    <p><span className="font-semibold">Nombre:</span> {formulario.nombre} {formulario.apellido}</p>
                    <p><span className="font-semibold">Edad:</span> {formulario.edad}</p>
                    <p><span className="font-semibold">Escuela:</span> {formulario.escuela || "No especificada"}</p>
                </div>

                <div className="p-4 rounded-lg bg-white shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Datos del responsable</h4>
                    <p><span className="font-semibold">Responsable:</span> {formulario.responsable}</p>
                    <p><span className="font-semibold">Teléfono:</span> {formulario.telefono}</p>
                    <p><span className="font-semibold">Email:</span> {formulario.email}</p>
                </div>

                <div className="p-4 rounded-lg bg-white shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Taller seleccionado</h4>
                    <p><span className="font-semibold">Sede:</span> <span className="text-green-700">{formulario.sede}</span></p>
                    <p><span className="font-semibold">Taller:</span> <span className="text-green-700">{formulario.curso}</span></p>
                    <p><span className="font-semibold">Turno:</span> {formulario.turno_1}</p>
                    {mostrarResumenTurno()}
                </div>

                {formulario.comentarios && (
                    <div className="p-4 rounded-lg bg-white shadow-sm">
                    <h4 className="font-semibold text-gray-700 mb-2">Comentarios adicionales</h4>
                    <p>{formulario.comentarios}</p>
                    </div>
                )}
            </div>

            {/* Información importante mejorada */}
            <div className="mt-6 p-4 border-l-4 border-green-300 bg-green-50 rounded">
            <h4 className="text-lg font-semibold text-green-800 mb-2">📌 Información importante</h4>
            <p className="text-gray-700 text-sm leading-relaxed">
                Nos comunicamos telefónicamente con todos los inscriptos. Recibirán un mensaje de Whatsapp para el abono de la inscripción y concretar la reserva de banco.
            </p>
            <p className="mt-2 text-gray-700 text-sm leading-relaxed">
                Luego, si el nene/nena realiza la primer clase y decide no continuar, <strong>NO se debe abonar el mes</strong>. Si decide continuar, se deberá abonar la cuota correspondiente.
            </p>
            </div>

            {/* Normas en lista más visual */}
            <div className="mt-4 p-4 border-l-4 border-gray-300 bg-gray-50 rounded">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">📌 Normas del Instituto</h4>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Las ausencias justificadas podrán recuperarse en otros turnos según disponibilidad.</li>
                <li>Los feriados NO podrán recuperarse.</li>
                <li>Los pagos mensuales deberán ser cancelados dentro de los primeros 10 días del mes; luego tendrán un incremento del 5%.</li>
                <li>Agendá este número para recibir notificaciones: <strong>3412153057</strong></li>
            </ul>
            </div>

            
            {/* Botones en la pantalla de resumen */}
            
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                confirmarEnvio();
              }}
              className="w-full sm:w-auto bg-green-400 hover:bg-green-500 text-white font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Confirmar envío
            </button>
            <button
              onClick={() => {
                setMostrarResumen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 sm:py-3 px-6 rounded-lg shadow transition hover:scale-105 text-sm sm:text-base"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default FormularioInscripcionVerano;
