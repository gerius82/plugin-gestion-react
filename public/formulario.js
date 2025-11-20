console.log("formulario.js está corriendo ✅");

window.addEventListener("load", function () {
let supabaseUrl = "", supabaseKey = "";

fetch("config.json")
.then(res => res.json())
.then(cfg => {
  supabaseUrl = cfg.supabaseUrl;
  supabaseKey = cfg.supabaseKey;
  
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`
  };

  let cuposMaximos = {};

  fetch("turnos.json")
  .then(res => res.json())
  .then(data => {
    cuposMaximos = data;
    initFormulario();
  });

  function initFormulario() {
    document.getElementById("sede").addEventListener("change", e => {
      cargarTurnosPorSede(e.target.value);
    });

    document.getElementById("edad").addEventListener("input", function () {
      const edad = parseInt(this.value);
      const cursoSelect = document.getElementById("curso");
      [...cursoSelect.options].forEach(option => {
        const minEdad = parseInt(option.getAttribute("data-min-edad"));
        if (!isNaN(minEdad)) {
          option.disabled = edad < minEdad;
        }
      });
    });

    document.getElementById("inscripcionForm").addEventListener("submit", async function (e) {
      e.preventDefault();
    
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
    
      const inscriptos = await contarInscriptos(data.sede, data.turno1);
      const max = cuposMaximos[data.sede]?.[data.turno1] ?? 13;
      const listaEspera = inscriptos >= max;
    
      const payload = {
        nombre: data.nombre,
        apellido: data.apellido,
        edad: parseInt(data.edad),
        escuela: data.escuela,
        responsable: data.responsable,
        telefono: data.telefono,
        email: data.email,
        sede: data.sede,
        turno_1: data.turno1,
        turno_2: data.turno2,
        curso: data.curso,
        comentarios: data.comentarios,
        lista_espera: listaEspera
      };
    
      mostrarResumen(payload);
      payload.creado_en = obtenerFechaLocalISO();

    });
    
  }

  async function contarInscriptos(sede, turno) {
    const url = `${supabaseUrl}/rest/v1/inscripciones?select=id&sede=eq.${encodeURIComponent(sede)}&turno_1=eq.${encodeURIComponent(turno)}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    return data.length;
  }
  
  async function cargarTurnosPorSede(sede) {
    const turno1 = document.getElementById("turno1");
    const turno2 = document.getElementById("turno2");
  
    turno1.innerHTML = '<option value="">-- Selecciona un turno --</option>';
    turno2.innerHTML = '<option value="">-- Selecciona una segunda opción --</option>';
  
    if (!cuposMaximos[sede]) return;
  
    // Traer todos los inscriptos de esa sede
    const url = `${supabaseUrl}/rest/v1/inscripciones?activo=eq.true&select=turno_1&sede=eq.${encodeURIComponent(sede)}`;
    const res = await fetch(url, { headers });
    const datos = await res.json();

  
    // Contar cantidad de inscriptos por turno
    const conteo = {};
    for (const { turno_1 } of datos) {
      const clave = (turno_1 ?? "").trim();
      if (!clave) continue;
      conteo[clave] = (conteo[clave] || 0) + 1;
    }
  
    // Armar select
    for (const [turno, max] of Object.entries(cuposMaximos[sede])) {
      const cantidad = conteo[turno.trim()] || 0;
      const listaEspera = cantidad >= max;
      const label = listaEspera ? `${turno} - Lista de espera` : turno;
      const option = new Option(label, turno);
      turno1.appendChild(option.cloneNode(true));
      turno2.appendChild(option.cloneNode(true));
    }
  }
  


  function mostrarResumen(data) {
    document.querySelector("form").style.display = "none";
    const contenedor = document.getElementById("resumen");
    const contenido = document.getElementById("resumenContenido");

    contenido.innerHTML = `
      <p><strong>Nombre:</strong> ${data.nombre} ${data.apellido}</p>
      <p><strong>Edad:</strong> ${data.edad}</p>
      <p><strong>Escuela:</strong> ${data.escuela}</p>
      <p><strong>Responsable:</strong> ${data.responsable}</p>
      <p><strong>Teléfono:</strong> ${data.telefono}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Sede:</strong> ${data.sede}</p>
      <p><strong>Curso:</strong> ${data.curso}</p>
      <p><strong>Turno preferido:</strong> ${data.turno_1}</p>
      <p><strong>Segunda opción:</strong> ${data.turno_2}</p>
      <p><strong>Comentarios:</strong> ${data.comentarios}</p>
      <p><strong>Lista de espera:</strong> ${data.lista_espera ? 'Sí' : 'No'}</p>
    `;

    contenedor.style.display = "block";

    document.getElementById("confirmarEnvio").onclick = async () => {
      const res = await fetch(`${supabaseUrl}/rest/v1/inscripciones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        contenedor.innerHTML = `
          <h3>Inscripción enviada correctamente</h3>
          <p>Gracias por inscribirte.</p>
          <div style="text-align:center; margin-top: 1rem;">
            <button id="volverFormularioFinal" class="btn-volver">Volver</button>
          </div>
         `;
         
         // Enviar email de confirmación
          emailjs.init("Vkl0XSUcG-KApScqq"); // tu Public Key actual
          const templateParams = {
            email: data.email,
            nombre: data.nombre,
            apellido: data.apellido,
            edad: data.edad,
            escuela: data.escuela,
            responsable: data.responsable,
            telefono: data.telefono,
            email: data.email,
            sede: data.sede,
            curso: data.curso,
            turno_1: data.turno_1,
            turno_2: data.turno_2,
            comentarios: data.comentarios,
            lista_espera: data.lista_espera ? 'Sí' : 'No',
            
          };
          

          emailjs.send('service_efu6ess', 'template_92ev0wo', templateParams)
            .then(() => {
              console.log("Correo enviado correctamente");
            }, (error) => {
              console.error("Error al enviar correo:", error);
          });
          
          document.getElementById("volverFormularioFinal").onclick = () => {
            location.reload(); // vuelve al formulario limpio
          };
        } else {
        contenedor.innerHTML += `<p style="color:red;">Ocurrió un error al enviar la inscripción.</p>`;
      }
    };
  }
    
  document.getElementById("volverFormulario").onclick = () => {
    document.getElementById("resumen").style.display = "none";
    document.querySelector("form").style.display = "block";
  };
    
});

function obtenerFechaLocalISO() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60000;
  const localISO = new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
  return `${localISO}-03:00`;
}

document.getElementById("volverMenu").onclick = () => {
  window.location.href = "index.html"; // Cambiar si el archivo se llama distinto
};

// Detectar parámetro en la URL
const urlParams = new URLSearchParams(window.location.search);
const vieneDelMenu = urlParams.get("from") === "menu";

if (!vieneDelMenu) {
  const botonVolverMenu = document.getElementById("volverMenu");
  if (botonVolverMenu) {
    botonVolverMenu.style.display = "none";
  }
}
});




