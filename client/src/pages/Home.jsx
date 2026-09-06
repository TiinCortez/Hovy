import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Leaf, 
  User, 
  Home as HomeIcon, 
  Users, 
  MessageCircle
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';

export default function Home() {
  return (
    <div className="d-flex flex-column min-vh-100 position-relative pb-5 pb-md-0">
      
      {/* NAVBAR SUPERIOR */}
      <nav className="home-navbar d-flex align-items-center justify-content-between sticky-top bg-white px-3 px-md-4 py-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <Leaf color="#1B3006" size={28} />
          <h1 className="hovy-brand fs-4 m-0 text-dark fw-bold">Valle La Armonía</h1>
        </div>
        
        {/* Menú Desktop (Oculto en móvil) */}
        <div className="d-none d-md-flex gap-4 align-items-center">
          <a href="#servicios" className="nav-link text-decoration-none fw-semibold text-secondary">Servicios</a>
          <a href="#nosotros" className="nav-link text-decoration-none fw-semibold text-secondary">Nosotros</a>
          <a href="#contacto" className="nav-link text-decoration-none fw-semibold text-secondary">Contacto</a>
        </div>

        {/* Botón Ingresar (Adaptativo)[cite: 4] */}
        <div>
          <Link to="/login" className="text-decoration-none">
            {/* Versión Desktop */}
            <Button variant="primary" className="d-none d-md-flex">Ingresar</Button>
            {/* Versión Mobile: Círculo oscuro con ícono */}
            <div className="d-md-none bg-dark text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
              <User size={18} />
            </div>
          </Link>
        </div>
      </nav>

      {/* HERO SECTION ORIGINAL */}
      <main className="hero-section flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center px-3 py-5">
        <div className="container position-relative z-1 d-flex flex-column align-items-center">
          
          <Leaf color="#ffffff" size={64} className="mb-3 opacity-75" />
          <h2 className="fs-3 fw-light mb-4 text-white">Valle La Armonía</h2>
          
          <h1 className="hero-title mb-4 text-white">
            Paisajismo que respira con la<br />naturaleza
          </h1>
          
          <p className="hero-subtitle mb-5 text-white">
            Diseñamos y mantenemos espacios verdes sustentables que<br className="d-none d-md-block" />
            transforman tu entorno en un refugio de paz.
          </p>
          
          <Button variant="primary" className="px-5 py-3 fs-5 shadow">
            Solicitar Turno <ArrowRight size={20} />
          </Button>
          
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-light py-4 border-top text-center mt-auto">
        <div className="container">
          <div className="d-flex justify-content-center gap-3 mb-3 small fw-semibold">
            <a href="#legal" className="text-decoration-none text-secondary">Aviso Legal</a>
            <span className="text-secondary opacity-50">•</span>
            <a href="#privacidad" className="text-decoration-none text-secondary">Privacidad</a>
            <span className="text-secondary opacity-50">•</span>
            <a href="#whatsapp" className="text-decoration-none text-dark d-flex align-items-center gap-1">
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
          <p className="m-0 small text-secondary opacity-75" style={{ fontSize: '0.75rem' }}>
            © 2024 Valle La Armonía. Paisajismo Sustentable. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* BOTTOM NAV (Móvil) - Visible solo en pantallas pequeñas */}
      <nav 
        className="fixed-bottom d-md-none bg-white border-top d-flex justify-content-around align-items-center pt-2 shadow-lg"
        style={{ zIndex: 1050, paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <a href="#inicio" className="text-decoration-none text-center text-dark d-flex flex-column align-items-center">
          <HomeIcon size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '600' }}>Inicio</span>
        </a>
        <a href="#servicios" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center">
          <Leaf size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Servicios</span>
        </a>
        <a href="#nosotros" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center">
          <Users size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Nosotros</span>
        </a>
        <a href="#contacto" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center">
          <MessageCircle size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Contacto</span>
        </a>
      </nav>

    </div>
  );
}