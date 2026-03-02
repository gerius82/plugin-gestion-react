import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import FormularioInscripcion from "./components/FormularioInscripcion";
import logo from "./assets/Logo_Plugin_2025.png";
import MenuGestion from "./components/menus/MenuGestion";
import MenuPadres from "./components/menus/MenuPadres";
import PromosMenu from "./components/menus/PromosMenu";
import MenuInscripcionPadres from "./components/menus/MenuInscripcionPadres";
import MenuInscripcionCursos from "./components/menus/MenuInscripcionCursos";
import MenuProfes from "./components/menus/MenuProfes";
import MenuResumen from "./components/menus/MenuResumen";
import FichaAlumno from "./components/FichaAlumno";
import FichaAsistencia from "./components/FichaAsistencia";
import FichaPagos from "./components/FichaPagos";
import FichaPagosEstadisticas from "./components/FichaPagosEstadisticas";
import PagosMenu from "./components/menus/PagosMenu";
import AsistenciaMenu from "./components/menus/AsistenciaMenu";
import FichaAsistenciasEstadisticas from "./components/FichaAsistenciasEstadisticas";
import AlumnosMenu from "./components/menus/AlumnosMenu";
import FichaResumenAlumnos from "./components/FichaResumenAlumnos";
import FichaInactivos from "./components/FichaInactivos";
import FichaRecuperar from "./components/FichaRecuperar"; // ajustá la ruta si está en otra carpeta
import CambioTurno from "./components/CambioTurno";
import DarDeBaja from "./components/DarDeBaja"; // ajustá la ruta si lo ponés en otra carpeta
import FichaGrillaTurnos from "./components/FichaGrillaTurnos";
import FormularioInscripcionVerano from "./components/FormularioInscripcionVerano";
import GestorCursos from "./components/GestorCursos";
import GestorCiclos from "./components/GestorCiclos";
import FichaAvisosAlumnos from "./components/FichaAvisosAlumnos";
import GestorTurnos from "./components/GestorTurnos";
import FichaCumples from "./components/FichaCumples";
import FichaCumplesPadres from "./components/FichaCumplesPadres";
import InfoCumples from "./components/InfoCumples";
import FichaCumplesAlumnos from "./components/FichaCumplesAlumnos";
import CumplesMenu from "./components/menus/CumplesMenu";
import FichaContactoAlumnosProfes from "./components/FichaContactoAlumnosProfes";
import FichaUrgenciasProfes from "./components/FichaUrgenciasProfes";






function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col items-center p-6 bg-gray-100">
        <img src={logo} alt="Logo Plugin" className="w-72 mb-8 drop-shadow-lg" />
        <Routes>
          <Route path="/" element={<Navigate to="/menu-gestion" replace />} />
          <Route path="/formulario" element={<FormularioInscripcion />} />

          <Route path="/alumnos-menu" element={<AlumnosMenu />} />
          <Route path="/ficha" element={<FichaAlumno />} />
          <Route path="/ficha-alumno/:id" element={<FichaAlumno />} />
          <Route path="/menu-gestion" element={<MenuGestion />} />
          <Route path="/menu-padres" element={<MenuPadres />} />
          <Route path="/promos" element={<PromosMenu />} />
          <Route path="/menu-profes" element={<MenuProfes />} />
          <Route path="/profes-contacto-alumnos" element={<FichaContactoAlumnosProfes />} />
          <Route path="/profes-urgencias" element={<FichaUrgenciasProfes />} />
          <Route path="/asistencias" element={<FichaAsistencia />} />
          <Route path="/pagos" element={<FichaPagos />} />
          <Route path="/estadisticas-pagos" element={<FichaPagosEstadisticas />} />
          <Route path="/pagos-menu" element={<PagosMenu />} />
          <Route path="/asistencia-menu" element={<AsistenciaMenu />} />
          <Route path="/estadisticas-asistencias" element={<FichaAsistenciasEstadisticas />} />
          <Route path="/resumen-alumnos" element={<FichaResumenAlumnos />} />
          <Route path="/inactivos" element={<FichaInactivos />} />
          <Route path="/recuperar" element={<FichaRecuperar />} />
          <Route path="/cambio-turno" element={<CambioTurno />} />
          <Route path="/dar-de-baja" element={<DarDeBaja />} />
          <Route path="/grilla-turnos" element={<FichaGrillaTurnos />} />
          <Route path="/menu-resumen" element={<MenuResumen />} />
          <Route path="/menu-padres" element={<MenuPadres />} />
          <Route path="/menu-inscripcion-padres" element={<MenuInscripcionPadres />} />
          <Route path="/menu-inscripcion-cursos" element={<MenuInscripcionCursos />} />
          <Route path="/gestion-cursos" element={<GestorCursos />} />
          <Route path="/gestor-ciclos" element={<GestorCiclos />} />
          <Route path="/avisos" element={<FichaAvisosAlumnos />} />
          <Route path="/cumples-alumnos" element={<FichaCumplesAlumnos />} />
          <Route path="/gestor-turnos" element={<GestorTurnos />} />
          <Route path="/cumples" element={<FichaCumples />} />
          <Route path="/cumples-menu" element={<CumplesMenu />} />
          <Route path="/cumples-gestion" element={<FichaCumples />} />
          <Route path="/cumples-info" element={<InfoCumples />} />
          <Route path="/cumples-reservas" element={<FichaCumplesPadres />} />

          

          

          {/* Taller de Verano → formulario similar (nuevo componente) */}
          <Route path="/formulario-verano" element={<FormularioInscripcionVerano />} />






        </Routes>
      </div>
    </Router>
  );
}

export default App;
