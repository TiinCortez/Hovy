
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf } from 'lucide-react';
import Button from '../components/ui/Button.jsx';

export default function Home() {
  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar Pública */}
      <nav className="home-navbar d-flex align-items-center justify-content-between sticky-top">
        <div className="d-flex align-items-center gap-2">
          <Leaf color="#1B3006" size={28} />
          <h1 className="hovy-brand fs-4 m-0">Valle La Armonía</h1>
        </div>
        
        <div className="d-none d-md-flex gap-4">
          <a href="#servicios" className="nav-link text-decoration-none">Servicios</a>
          <a href="#nosotros" className="nav-link text-decoration-none">Nosotros</a>
          <a href="#contacto" className="nav-link text-decoration-none">Contacto</a>
        </div>

        <div>
          {/* Link enrutado usando el patrón de SPA hacia el login */}
          <Link to="/login" className="text-decoration-none">
            <Button variant="primary">Ingresar</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="hero-section flex-grow-1">
        <div className="container d-flex flex-column align-items-center">
          <Leaf color="#ffffff" size={64} className="mb-3 opacity-75" />
          <h2 className="fs-3 fw-light mb-4">Valle La Armonía</h2>
          
          <h1 className="hero-title mb-4">
            Paisajismo que respira con la<br />naturaleza
          </h1>
          
          <p className="hero-subtitle mb-5">
            Diseñamos y mantenemos espacios verdes sustentables que<br className="d-none d-md-block" />
            transforman tu entorno en un refugio de paz.
          </p>
          
          <Button variant="primary" className="px-5 py-3 fs-5 shadow">
            Solicitar Turno <ArrowRight size={20} />
          </Button>
        </div>
      </main>

      {/* Footer Público */}
      <footer className="home-footer py-4">
        <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2 mb-3 mb-md-0 fw-semibold text-dark">
            <Leaf color="#1B3006" size={20} />
            Valle La Armonía
          </div>
          <p className="m-0 small">© 2024 Valle La Armonía - Paisajismo Sustentable</p>
          <div className="d-flex gap-3 mt-3 mt-md-0 small fw-semibold">
            <a href="#legal" className="text-decoration-none text-dark">Aviso Legal</a>
            <a href="#privacidad" className="text-decoration-none text-dark">Privacidad</a>
            <a href="#whatsapp" className="text-decoration-none text-dark">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}