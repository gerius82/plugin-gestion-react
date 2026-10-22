import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import { getSupabaseAuthClient } from "../lib/supabaseAuth";

const ADMIN_EMAIL = "plugin.robotica@gmail.com";
const GestionAuthContext = createContext(null);

const esSesionAdministrativa = (session) =>
  String(session?.user?.email || "").trim().toLowerCase() === ADMIN_EMAIL;

export function GestionAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorInicial, setErrorInicial] = useState("");

  useEffect(() => {
    let activo = true;
    let subscription;

    (async () => {
      try {
        const client = await getSupabaseAuthClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (activo) setSession(data.session || null);

        const listener = client.auth.onAuthStateChange((_event, nextSession) => {
          if (activo) setSession(nextSession || null);
        });
        subscription = listener.data.subscription;
      } catch (error) {
        if (activo) setErrorInicial(error?.message || "No se pudo comprobar el acceso.");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      cargando,
      errorInicial,
      esAdministrador: esSesionAdministrativa(session),
      async ingresar(password) {
        const client = await getSupabaseAuthClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password,
        });
        if (error) throw error;
        if (!esSesionAdministrativa(data.session)) {
          await client.auth.signOut();
          throw new Error("Esta cuenta no tiene acceso a Gestión.");
        }
        return data.session;
      },
      async salir() {
        const client = await getSupabaseAuthClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
      async actualizarPassword(password) {
        const client = await getSupabaseAuthClient();
        const { error } = await client.auth.updateUser({
          password,
          data: {
            ...(session?.user?.user_metadata || {}),
            must_change_password: false,
          },
        });
        if (error) throw error;

        const { data, error: refreshError } = await client.auth.refreshSession();
        if (refreshError) throw refreshError;
        setSession(data.session || null);
      },
    }),
    [session, cargando, errorInicial],
  );

  return <GestionAuthContext.Provider value={value}>{children}</GestionAuthContext.Provider>;
}

export function useGestionAuth() {
  const context = useContext(GestionAuthContext);
  if (!context) throw new Error("useGestionAuth debe usarse dentro de GestionAuthProvider");
  return context;
}

export function RequireGestionAuth() {
  const { cargando, errorInicial, esAdministrador, session } = useGestionAuth();
  const location = useLocation();

  if (cargando) return <p className="text-sm text-gray-600">Comprobando acceso...</p>;
  if (errorInicial) return <p className="text-sm text-red-600">{errorInicial}</p>;

  if (!esAdministrador) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/acceso-gestion?next=${encodeURIComponent(next)}`} replace />;
  }

  const debeCambiarPassword = session?.user?.user_metadata?.must_change_password === true;
  if (debeCambiarPassword && location.pathname !== "/seguridad-gestion") {
    return <Navigate to="/seguridad-gestion" replace />;
  }

  return <Outlet />;
}

export function AccesoGestion() {
  const { cargando, esAdministrador, ingresar } = useGestionAuth();
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const next = new URLSearchParams(location.search).get("next") || "/menu-gestion";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/menu-gestion";

  useEffect(() => {
    if (!cargando && esAdministrador) navigate(destino, { replace: true });
  }, [cargando, destino, esAdministrador, navigate]);

  const iniciarSesion = async (event) => {
    event.preventDefault();
    if (!password) return;
    try {
      setEnviando(true);
      setMensaje("");
      await ingresar(password);
      navigate(destino, { replace: true });
    } catch (error) {
      const texto = String(error?.message || "");
      setMensaje(
        texto.toLowerCase().includes("invalid login credentials")
          ? "La contraseña no es correcta."
          : texto || "No se pudo iniciar sesión.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (cargando || esAdministrador) {
    return <p className="text-sm text-gray-600">Comprobando acceso...</p>;
  }

  return (
    <div className="w-full flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-center gap-3 mb-2">
        <FaLock className="text-orange-500 text-2xl" />
        <h1 className="text-2xl font-bold text-gray-900">Acceso a Gestión</h1>
      </div>
      <p className="text-sm text-gray-600 text-center mb-6">
        Ingresá la contraseña de la cuenta administrativa.
      </p>

      <form onSubmit={iniciarSesion}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
        <input
          type="email"
          value={ADMIN_EMAIL}
          readOnly
          className="w-full border rounded-lg px-3 py-2 mb-4 bg-gray-100 text-gray-600"
        />

        <label htmlFor="gestion-password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="gestion-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          className="w-full border rounded-lg px-3 py-2 mb-3"
        />

        {mensaje && <p className="text-sm text-red-600 mb-3">{mensaje}</p>}

        <button
          type="submit"
          disabled={enviando || !password}
          className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5"
        >
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      </div>
    </div>
  );
}

export function SeguridadGestion() {
  const { actualizarPassword } = useGestionAuth();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const navigate = useNavigate();

  const guardar = async (event) => {
    event.preventDefault();
    if (password.length < 12) {
      setMensaje("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (password !== confirmacion) {
      setMensaje("Las contraseñas no coinciden.");
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");
      await actualizarPassword(password);
      navigate("/menu-gestion", { replace: true });
    } catch (error) {
      setMensaje(error?.message || "No se pudo guardar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <FaLock className="text-orange-500 text-2xl" />
          <h1 className="text-2xl font-bold text-gray-900">Elegí tu contraseña</h1>
        </div>
        <p className="text-sm text-gray-600 text-center mb-6">
          Este paso se realiza una sola vez. Usá una clave de al menos 12 caracteres.
        </p>

        <form onSubmit={guardar}>
          <label htmlFor="nueva-password" className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <input
            id="nueva-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            autoFocus
            required
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />

          <label htmlFor="confirmar-password" className="block text-sm font-medium text-gray-700 mb-1">
            Repetir contraseña
          </label>
          <input
            id="confirmar-password"
            type="password"
            value={confirmacion}
            onChange={(event) => setConfirmacion(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
            className="w-full border rounded-lg px-3 py-2 mb-3"
          />

          {mensaje && <p className="text-sm text-red-600 mb-3">{mensaje}</p>}

          <button
            type="submit"
            disabled={guardando || !password || !confirmacion}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5"
          >
            {guardando ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
