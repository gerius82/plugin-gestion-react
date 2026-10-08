import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const estaInstalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true;

export default function InstalarApp() {
  const navigate = useNavigate();
  const [eventoInstalacion, setEventoInstalacion] = useState(
    () => window.__pluginInstallPrompt || null
  );
  const [instalada, setInstalada] = useState(estaInstalada);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const habilitarInstalacion = (event) => {
      setEventoInstalacion(event.detail || window.__pluginInstallPrompt || null);
    };
    const confirmarInstalacion = () => {
      setInstalada(true);
      setEventoInstalacion(null);
      setMensaje("La aplicación quedó instalada correctamente.");
    };

    window.addEventListener("plugin-install-available", habilitarInstalacion);
    window.addEventListener("appinstalled", confirmarInstalacion);
    return () => {
      window.removeEventListener("plugin-install-available", habilitarInstalacion);
      window.removeEventListener("appinstalled", confirmarInstalacion);
    };
  }, []);

  const instalar = async () => {
    const prompt = eventoInstalacion || window.__pluginInstallPrompt;
    if (!prompt) {
      setMensaje(
        "Si no aparece el instalador, abrí el menú ⋮ de Chrome y elegí “Instalar aplicación” o “Agregar a pantalla principal”."
      );
      return;
    }

    await prompt.prompt();
    const resultado = await prompt.userChoice;
    window.__pluginInstallPrompt = null;
    setEventoInstalacion(null);
    if (resultado.outcome === "accepted") {
      setMensaje("Instalación aceptada. El ícono aparecerá en tu celular.");
    } else {
      setMensaje("La instalación fue cancelada. Podés volver a intentarlo cuando quieras.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 text-center">
        <img
          src="/app-icon-512.png"
          alt="Ícono de PLUGIN Gestión"
          className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow"
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Instalar PLUGIN Gestión</h1>
        <p className="text-gray-600 mb-5">
          Instalá el sistema en tu celular Android y abrilo desde un ícono, como cualquier otra aplicación.
        </p>

        <div className="text-left bg-green-50 border border-green-100 rounded-xl p-4 mb-5 text-sm text-green-900 space-y-2">
          <p>✓ La web actual seguirá funcionando normalmente.</p>
          <p>✓ No se guardan datos sensibles sin conexión.</p>
          <p>✓ Las actualizaciones se reciben desde la misma web.</p>
        </div>

        {instalada ? (
          <div className="rounded-lg border border-green-200 bg-green-100 px-4 py-3 text-green-800 font-semibold">
            La aplicación ya está instalada en este dispositivo.
          </div>
        ) : (
          <button
            type="button"
            onClick={instalar}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-5 rounded-xl shadow"
          >
            Instalar en este celular
          </button>
        )}

        {mensaje && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {mensaje}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate("/menu-gestion")}
          className="mt-5 text-sm text-gray-600 underline hover:text-gray-900"
        >
          Volver al sistema
        </button>
      </div>
    </div>
  );
}
