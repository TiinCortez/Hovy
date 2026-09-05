import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fondoIzquierdo from '../../../assets/images/FondoLadoIzquierdo01.webp';
import logo from '../../../assets/icons/LogoLogin.svg';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Iniciar sesión con:', formData);
    navigate('/dashboard');
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const handleRegisterRedirect = () => {
    navigate('/register');
  };

  return (
    <div className="container-fluid min-vh-100 p-0 d-flex bg-light">
      <div className="row g-0 w-100">
        
        {/* Panel Izquierdo - Imagen de fondo */}
        <div 
          className="col-md-6 col-lg-7 d-none d-md-block bg-cover"
          style={{ 
            backgroundImage: `url(${fondoIzquierdo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="w-100 h-100 bg-dark bg-opacity-10" />
        </div>

        {/* Panel Derecho - Formulario de Login */}
        <div className="col-12 col-md-6 col-lg-5 d-flex align-items-center justify-content-center p-4 p-md-5">
          <div 
            className="card border-0 shadow-lg p-4 p-sm-5 w-100 position-relative overflow-hidden"
            style={{ maxWidth: '440px', borderRadius: '20px' }}
          >
            
            {/* Acento superior de color (Barra degradada) */}
            <div 
              className="position-absolute top-0 start-0 end-0"
              style={{ 
                height: '6px', 
                background: 'linear-gradient(90deg, #fb923c, #059669)' 
              }} 
            />

            {/* Logo y Encabezado */}
            <div className="text-center mb-4 mt-2">
              <div 
                className="d-inline-flex align-items-center justify-content-center p-3 mb-3 rounded-3"
                style={{ backgroundColor: '#f4f2eb' }}
              >
                <img 
                  src={logo} 
                  alt="Valle La Armonía Logo" 
                  style={{ height: '40px', width: '40px', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none'; // Si no encuentra la imagen muestra un icono de reemplazo
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <i className="bi bi-flower1 fs-2 text-success" style={{ display: 'none' }}></i>
              </div>
              <h2 className="fw-bold tracking-tight mb-1" style={{ color: '#2d4023' }}>
                Bienvenido
              </h2>
              <p className="text-muted small mb-0">Sistema de Valle la Armonía</p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              
              {/* Campo Usuario */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-secondary mb-1">
                  Usuario
                </label>
                <div className="input-group">
                  <span 
                    className="input-group-text border-0 ps-3 pe-2" 
                    style={{ backgroundColor: '#f7f5ee', color: '#888' }}
                  >
                    <i className="bi bi-person"></i>
                  </span>
                  <input
                    type="text"
                    name="usuario"
                    value={formData.usuario}
                    onChange={handleChange}
                    placeholder="Ingrese su usuario"
                    className="form-bg-custom form-control border-0 py-2 shadow-none"
                    style={{ backgroundColor: '#f7f5ee', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-semibold small text-secondary mb-0">
                    Contraseña
                  </label>
                  
                  {/* BOTÓN 1: ¿Olvidó su contraseña? */}
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="btn btn-link p-0 text-decoration-none small fw-medium"
                    style={{ color: '#b45309', fontSize: '0.8rem' }}
                  >
                    ¿Olvidó su contraseña?
                  </button>
                </div>

                <div className="input-group">
                  <span 
                    className="input-group-text border-0 ps-3 pe-2" 
                    style={{ backgroundColor: '#f7f5ee', color: '#888' }}
                  >
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="form-control border-0 py-2 shadow-none"
                    style={{ backgroundColor: '#f7f5ee', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>

              {/* BOTÓN 2: Iniciar Sesión (Submit principal) */}
              <button
                type="submit"
                className="btn w-100 py-2.5 text-white fw-semibold rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ backgroundColor: '#2e4a1e', borderColor: '#2e4a1e' }}
              >
                <span>Iniciar Sesión</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            </form>

            {/* Separador */}
            <div className="position-relative my-4 text-center">
              <hr className="text-secondary opacity-25 m-0" />
              <span 
                className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small"
                style={{ fontSize: '0.8rem' }}
              >
                o
              </span>
            </div>

            {/* BOTÓN 3: Crear Cuenta */}
            <button
              type="button"
              onClick={handleRegisterRedirect}
              className="btn w-100 py-2.5 fw-semibold rounded-pill"
              style={{ 
                color: '#2e4a1e', 
                borderColor: '#2e4a1e',
                backgroundColor: 'transparent'
              }}
            >
              Crear Cuenta
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;