import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import logo from "./assets/Logo_Plugin_2025.png";
import { AccesoGestion, GestionAuthProvider, RequireGestionAuth, SeguridadGestion } from "./components/GestionAuth";
import Avisos from "./components/FichaAvisosAlumnos";
import CambioTurno from "./components/CambioTurno";
import ControlAsistencias from "./components/FichaControlAsistenciaMensual";
import Cumples from "./components/FichaCumples";
import CumplesAlumnos from "./components/FichaCumplesAlumnos";
import CumplesInfo from "./components/InfoCumples";
import CumplesPagos from "./components/FichaPagosCumples";
import CumplesReservas from "./components/FichaCumplesPadres";
import DarDeBaja from "./components/DarDeBaja";
import EstadisticasAsistencias from "./components/FichaAsistenciasEstadisticas";
import EstadisticasPagos from "./components/FichaPagosEstadisticas";
import Facturacion from "./components/FichaFacturacion";
import FichaAlumno from "./components/FichaAlumno";
import FichaAsistencia from "./components/FichaAsistencia";
import FichaRecuperar from "./components/FichaRecuperar";
import Formulario from "./components/FormularioInscripcion";
import FormularioVerano from "./components/FormularioInscripcionVerano";
import GestorCiclos from "./components/GestorCiclos";
import GestorCursos from "./components/GestorCursos";
import GestorFeriados from "./components/GestorFeriados";
import GestorTurnos from "./components/GestorTurnos";
import GrillaTurnos from "./components/FichaGrillaTurnos";
import Inactivos from "./components/FichaInactivos";
import InstalarApp from "./components/InstalarApp";
import Notificaciones from "./components/FichaNotificaciones";
import Pagos from "./components/FichaPagos";
import ProfesContactoAlumnos from "./components/FichaContactoAlumnosProfes";
import ProfesUrgencias from "./components/FichaUrgenciasProfes";
import Promos from "./components/menus/PromosMenu";
import ResumenAlumnos from "./components/FichaResumenAlumnos";
import AlumnosMenu from "./components/menus/AlumnosMenu";
import AsistenciaMenu from "./components/menus/AsistenciaMenu";
import CumplesMenu from "./components/menus/CumplesMenu";
import MenuGestion from "./components/menus/MenuGestion";
import MenuInscripcionCursos from "./components/menus/MenuInscripcionCursos";
import MenuInscripcionPadres from "./components/menus/MenuInscripcionPadres";
import MenuPadres from "./components/menus/MenuPadres";
import MenuProfes from "./components/menus/MenuProfes";
import MenuResumen from "./components/menus/MenuResumen";
import PagosMenu from "./components/menus/PagosMenu";

function App() {
  return (
    <Router>
      <GestionAuthProvider>
        <div className="min-h-screen flex flex-col items-center p-6 bg-gray-100">
          <img
            src={logo}
            alt="Logo Plugin"
            className="w-72 mb-8 drop-shadow-lg"
          />

          <Routes>
            <Route path="/acceso-gestion" element={<AccesoGestion />} />

            {/* Accesos públicos para familias y profesores */}
            <Route path="/formulario" element={<Formulario />} />
            <Route path="/formulario-verano" element={<FormularioVerano />} />
            <Route path="/menu-padres" element={<MenuPadres />} />
            <Route path="/promos" element={<Promos />} />
            <Route path="/menu-inscripcion-padres" element={<MenuInscripcionPadres />} />
            <Route path="/menu-inscripcion-cursos" element={<MenuInscripcionCursos />} />
            <Route path="/recuperar" element={<FichaRecuperar />} />
            <Route path="/cambio-turno" element={<CambioTurno />} />
            <Route path="/dar-de-baja" element={<DarDeBaja />} />
            <Route path="/cumples-info" element={<CumplesInfo />} />
            <Route path="/cumples-reservas" element={<CumplesReservas />} />
            <Route path="/menu-profes" element={<MenuProfes />} />
            <Route path="/profes-contacto-alumnos" element={<ProfesContactoAlumnos />} />
            <Route path="/profes-urgencias" element={<ProfesUrgencias />} />
            <Route path="/asistencias" element={<FichaAsistencia />} />
            <Route path="/pagos" element={<Pagos />} />

            {/* Todo el sector de Gestión requiere sesión */}
            <Route element={<RequireGestionAuth />}>
              <Route path="/" element={<Navigate to="/menu-gestion" replace />} />
              <Route path="/seguridad-gestion" element={<SeguridadGestion />} />
              <Route path="/menu-gestion" element={<MenuGestion />} />
              <Route path="/alumnos-menu" element={<AlumnosMenu />} />
              <Route path="/ficha" element={<FichaAlumno />} />
              <Route path="/ficha-alumno/:id" element={<FichaAlumno />} />
              <Route path="/facturacion" element={<Facturacion />} />
              <Route path="/estadisticas-pagos" element={<EstadisticasPagos />} />
              <Route path="/pagos-menu" element={<PagosMenu />} />
              <Route path="/asistencia-menu" element={<AsistenciaMenu />} />
              <Route path="/estadisticas-asistencias" element={<EstadisticasAsistencias />} />
              <Route path="/control-asistencias" element={<ControlAsistencias />} />
              <Route path="/resumen-alumnos" element={<ResumenAlumnos />} />
              <Route path="/inactivos" element={<Inactivos />} />
              <Route path="/grilla-turnos" element={<GrillaTurnos />} />
              <Route path="/menu-resumen" element={<MenuResumen />} />
              <Route path="/gestion-cursos" element={<GestorCursos />} />
              <Route path="/gestor-ciclos" element={<GestorCiclos />} />
              <Route path="/avisos" element={<Avisos />} />
              <Route path="/cumples-alumnos" element={<CumplesAlumnos />} />
              <Route path="/gestor-turnos" element={<GestorTurnos />} />
              <Route path="/gestor-feriados" element={<GestorFeriados />} />
              <Route path="/cumples" element={<Cumples />} />
              <Route path="/cumples-menu" element={<CumplesMenu />} />
              <Route path="/cumples-gestion" element={<Cumples />} />
              <Route path="/cumples-pagos" element={<CumplesPagos />} />
              <Route path="/instalar-app" element={<InstalarApp />} />
              <Route path="/notificaciones" element={<Notificaciones />} />
            </Route>
          </Routes>
        </div>
      </GestionAuthProvider>
    </Router>
  );
}

export default App;
