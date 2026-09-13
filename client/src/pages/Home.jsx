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
    // Usamos min-vh-100 nativo de Bootstrap y d-flex flex-column para que todo ocupe la pantalla completa
    <div className="d-flex flex-column min-vh-100 position-relative overflow-x-hidden">
      
      {/* 1. NAVBAR SUPERIOR */}
      <nav className="home-navbar w-100 d-flex align-items-center justify-content-between bg-white px-3 px-md-4 py-3 border-bottom flex-shrink-0 z-3">
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

        {/* Botón Ingresar */}
        <div>
          <Link to="/login" className="text-decoration-none">
            <Button variant="primary" className="d-none d-md-flex">Ingresar</Button>
            <div className="d-md-none bg-dark text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '38px', height: '38px' }}>
              <User size={18} />
            </div>
          </Link>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      {/* flex-grow-1 hace que tome EXACTAMENTE el espacio restante. */}
      <main className="hero-section flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center px-3 py-4 w-100">
        <div className="container position-relative z-1 d-flex flex-column align-items-center px-2 px-sm-3">
          
          <Leaf color="#ffffff" size={56} className="mb-3 opacity-75 d-none d-sm-block" />
          <Leaf color="#ffffff" size={48} className="mb-3 opacity-75 d-block d-sm-none" />
          
          <h2 className="fs-5 fs-md-3 fw-light mb-3 mb-md-4 text-white">Valle La Armonía</h2>
          
          <h1 className="hero-title mb-3 mb-md-4 text-white px-1 text-wrap text-break">
            Paisajismo que respira con la naturaleza
          </h1>
          
          <p className="hero-subtitle mb-4 mb-md-5 text-white px-2 px-md-0 mx-auto" style={{ maxWidth: '600px' }}>
            Diseñamos y mantenemos espacios verdes sustentables que transforman tu entorno en un refugio de paz.
          </p>
          
          <Button variant="primary" className="px-4 px-md-5 py-3 fs-6 fs-md-5 shadow-lg w-100 w-sm-auto d-flex justify-content-center align-items-center gap-2" style={{ maxWidth: '300px' }}>
            Solicitar Turno <ArrowRight size={20} />
          </Button>
          
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="bg-light py-3 py-md-4 border-top text-center flex-shrink-0 w-100">
        <div className="container px-3">
          <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 gap-md-3 mb-2 mb-md-3 small fw-semibold">
            <a href="#legal" className="text-decoration-none text-secondary">Aviso Legal</a>
            <span className="text-secondary opacity-50 d-none d-sm-inline">•</span>
            <a href="#privacidad" className="text-decoration-none text-secondary">Privacidad</a>
            <span className="text-secondary opacity-50 d-none d-sm-inline">•</span>
            <a href="#whatsapp" className="text-decoration-none text-dark d-flex align-items-center gap-1">
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
          <p className="m-0 text-secondary opacity-75" style={{ fontSize: '0.70rem' }}>
            © 2024 Valle La Armonía. Paisajismo Sustentable. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* 4. BOTTOM NAV (Móvil) */}
      {/* Integrado al flujo natural para garantizar que todo encaje en el 100vh sin scroll */}
      <nav 
        className="d-md-none bg-white border-top d-flex justify-content-around align-items-center pt-2 shadow-lg w-100 flex-shrink-0"
        style={{ zIndex: 1050, paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <a href="#inicio" className="text-decoration-none text-center text-dark d-flex flex-column align-items-center flex-grow-1 px-1">
          <HomeIcon size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '600' }}>Inicio</span>
        </a>
        <a href="#servicios" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center flex-grow-1 px-1">
          <Leaf size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Servicios</span>
        </a>
        <a href="#nosotros" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center flex-grow-1 px-1">
          <Users size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Nosotros</span>
        </a>
        <a href="#contacto" className="text-decoration-none text-center text-secondary d-flex flex-column align-items-center flex-grow-1 px-1">
          <MessageCircle size={22} className="mb-1" />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Contacto</span>
        </a>
      </nav>

    </div>
  );
}