import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { User, MapPin, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import AuthService from '../../services/auth.service.js';

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [registerError, setRegisterError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); // <--- NUEVO ESTADO PARA EL ÉXITO
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    setRegisterError(null);
    setSuccessMessage(null); // Limpiamos el mensaje por si acaso
    
    try {
      const userData = { nombre: data.nombre, apellido: data.apellido, ubicacion: data.ubicacion };
      
      await AuthService.registerUser(data.email, data.password, userData, () => {
        // 1. Mostramos el mensaje de éxito
        setSuccessMessage('Usuario creado con éxito. Redirigiendo...');
        
        // 2. Esperamos 2 segundos (2000 ms) antes de mandarlo al login
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      });
      
    } catch (error) {
      setRegisterError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <main className="register-card">
        <div className="register-shape-desktop" aria-hidden="true"></div>
        <div className="register-shape-mobile" aria-hidden="true"></div>

        <div className="position-relative z-1">
          <header className="text-center mb-4">
            <div className="register-logo-badge">
              <svg className="mb-1" width="28" height="28" fill="none" viewBox="0 0 40 40">
                <path d="M20 28C20 28 12 26 12 17C12 11 19 8 20 8C20 8 20 16 20 28Z" fill="#2d5231" stroke="#2d5231" strokeWidth="1.5"/>
                <path d="M15 19L20 24" stroke="#e8ede4" strokeWidth="1.2"/>
                <path d="M14 14L19 19" stroke="#e8ede4" strokeWidth="1.2"/>
                <path d="M20 28C20 28 28 26 28 17C28 11 21 8 20 8C20 8 20 16 20 28Z" fill="#b96a50" stroke="#b96a50" strokeWidth="1.5"/>
                <path d="M25 19L20 24" stroke="#faeee7" strokeWidth="1.2"/>
                <path d="M26 14L21 19" stroke="#faeee7" strokeWidth="1.2"/>
              </svg>
              <span className="logo-text">Valle La Armonía</span>
              <span className="logo-subtext">Gardening</span>
            </div>
            <h1 className="register-title">Crear Cuenta</h1>
            <p className="register-subtitle">Únete a nuestra comunidad botánica.</p>
          </header>

          {/* MUESTRA EL ERROR SI HAY UNO */}
          {registerError && (
            <div className="alert alert-danger py-2 rounded-3 mb-3 small fw-semibold">
              {registerError}
            </div>
          )}

          {/* MUESTRA EL CARTEL VERDE DE ÉXITO SI SE CREÓ BIEN */}
          {successMessage && (
            <div className="alert alert-success d-flex align-items-center py-2 rounded-3 mb-3 small fw-semibold">
              <CheckCircle size={18} className="me-2 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="d-flex flex-column gap-3">
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="register-label">Nombre</label>
                <div className={`register-input-group ${errors.nombre ? 'border-danger' : ''}`}>
                  <User size={18} className="text-secondary flex-shrink-0" />
                  <input type="text" placeholder="Tu nombre" {...register("nombre", { required: "El nombre es obligatorio" })} />
                </div>
                {errors.nombre && <span className="text-danger small mt-1 d-block ps-2">{errors.nombre.message}</span>}
              </div>
              
              <div className="col-12 col-sm-6">
                <label className="register-label">Apellido</label>
                <div className={`register-input-group ${errors.apellido ? 'border-danger' : ''}`}>
                  <User size={18} className="text-secondary flex-shrink-0" />
                  <input type="text" placeholder="Tu apellido" {...register("apellido", { required: "El apellido es obligatorio" })} />
                </div>
                {errors.apellido && <span className="text-danger small mt-1 d-block ps-2">{errors.apellido.message}</span>}
              </div>
            </div>

            <div>
              <label className="register-label">Provincia - Ciudad</label>
              <div className="register-input-group">
                <MapPin size={18} className="text-secondary flex-shrink-0" />
                <input type="text" placeholder="Ej. Mendoza - San Rafael" {...register("ubicacion")} />
              </div>
            </div>

            <div>
              <label className="register-label">Email</label>
              <div className={`register-input-group ${errors.email ? 'border-danger' : ''}`}>
                <Mail size={18} className="text-secondary flex-shrink-0" />
                <input 
                  type="email" 
                  placeholder="correo@ejemplo.com" 
                  {...register("email", { 
                    required: "El correo electrónico es obligatorio",
                    pattern: { value: /\S+@\S+\.\S+/, message: "El formato del correo no es válido" }
                  })} 
                />
              </div>
              {errors.email && <span className="text-danger small mt-1 d-block ps-2">{errors.email.message}</span>}
            </div>

            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="register-label">Contraseña</label>
                <div className={`register-input-group ${errors.password ? 'border-danger' : ''}`}>
                  <Lock size={18} className="text-secondary flex-shrink-0" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...register("password", { 
                      required: "La contraseña es obligatoria",
                      minLength: { value: 6, message: "Debe tener al menos 6 caracteres" }
                    })} 
                  />
                  <button type="button" className="btn btn-link p-0 text-secondary ms-2 flex-shrink-0" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className="text-danger small mt-1 d-block ps-2">{errors.password.message}</span>}
              </div>

              <div className="col-12 col-sm-6">
                <label className="register-label">Confirmar Contraseña</label>
                <div className={`register-input-group ${errors.confirmPassword ? 'border-danger' : ''}`}>
                  <Lock size={18} className="text-secondary flex-shrink-0" />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...register("confirmPassword", { 
                        required: "Debes confirmar tu contraseña",
                        validate: value => value === getValues('password') || "Las contraseñas no coinciden" 
                    })}
                  />
                  <button type="button" className="btn btn-link p-0 text-secondary ms-2 flex-shrink-0" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="text-danger small mt-1 d-block ps-2">{errors.confirmPassword.message}</span>}
              </div>
            </div>

            <div className="pt-3">
              {/* Deshabilitamos el botón si está cargando O si ya fue exitoso */}
              <button type="submit" className="register-btn" disabled={isLoading || successMessage}>
                {isLoading ? 'Registrando...' : <>Crear Cuenta <ArrowRight size={18} className="ms-1 d-inline" /></>}
              </button>
            </div>
          </form>

          <footer className="text-center mt-4">
            <p className="small text-secondary mb-0">
              ¿Ya tienes una cuenta? <Link to="/login" className="fw-bold text-decoration-none" style={{ color: '#183c13' }}>Iniciar Sesión</Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}