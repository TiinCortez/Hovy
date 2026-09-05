import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Leaf, User, Lock, Eye, EyeOff, ArrowRight, UserPlus } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import AuthService from '../../services/auth.service.js';

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Implementación de React Hook Form para control de errores y validaciones[cite: 4]
  const { register, handleSubmit, formState: { errors } } = useForm();

  //const onSUbmit = navigate('/dashboard');
  const onSubmit = async (data) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      // Usamos el servicio centralizado que inyecta la conexión a Supabase[cite: 4]
      await AuthService.login(data.email, data.password, () => {
        navigate('/dashboard');
      });
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoading(false);
    }
  }; 

  return (
    <div className="login-container container-fluid p-0 overflow-hidden">
      <div className="row g-0 h-100">
        
        {/* Mitad Izquierda (Imagen Split Screen) */}
        <div className="col-lg-6 login-image-panel shadow-lg"></div>

        {/* Mitad Derecha (Formulario) */}
        <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center p-4">
          <div className="login-form-wrapper">
            
            <div className="login-card p-4">
              <div className="text-center mb-5">
                <div className="d-inline-flex align-items-center justify-content-center bg-white rounded-circle shadow-sm p-3 mb-3 border">
                  <Leaf color="#1B3006" size={40} />
                </div>
                <h1 className="fw-bold" style={{ color: '#1B3006', fontSize: '2.5rem' }}>Bienvenido</h1>
                <p className="text-secondary fs-5 m-0">Sistema de Valle la Armonía</p>
              </div>

              {/* Manejo de error general de autenticación */}
              {loginError && (
                <div className="alert alert-danger d-flex align-items-center py-2 rounded-3 mb-4" role="alert">
                  <span className="small fw-semibold">{loginError}</span>
                </div>
              )}

              {/* Formulario Controlado[cite: 4] */}
              <form onSubmit={handleSubmit(onSubmit)}>
                
                {/* Campo Usuario/Correo */}
                <div className="mb-4">
                  <label className="form-label fw-bold text-secondary mb-1">Correo Electrónico</label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent border-end-0 rounded-start-pill ps-3 text-secondary">
                      <User size={20} />
                    </span>
                    <input
                      type="email"
                      className={`form-control border-start-0 rounded-end-pill py-2 ${errors.email ? 'is-invalid' : ''}`}
                      placeholder="Ingrese su correo"
                      {...register("email", { 
                        required: "El correo es obligatorio",
                        pattern: {
                          value: /\S+@\S+\.\S+/,
                          message: "El formato del correo no es válido"
                        }
                      })}
                    />
                  </div>
                  {errors.email && <div className="text-danger small mt-1 ps-3">{errors.email.message}</div>}
                </div>

                {/* Campo Contraseña */}
                <div className="mb-2">
                  <label className="form-label fw-bold text-secondary mb-1">Contraseña</label>
                  <div className="input-group">
                    <span className="input-group-text bg-transparent border-end-0 rounded-start-pill ps-3 text-secondary">
                      <Lock size={20} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`form-control border-start-0 border-end-0 py-2 ${errors.password ? 'is-invalid' : ''}`}
                      placeholder="••••••••"
                      {...register("password", { required: "La contraseña es obligatoria" })}
                    />
                    <span 
                      className="input-group-text bg-transparent border-start-0 rounded-end-pill pe-3 text-secondary"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </span>
                  </div>
                  {errors.password && <div className="text-danger small mt-1 ps-3">{errors.password.message}</div>}
                </div>

                {/* Recuperar Contraseña */}
                <div className="text-end mb-4">
                  <a href="#olvido" className="text-decoration-none fw-semibold small" style={{ color: '#1B3006' }}>
                    ¿Olvidó su contraseña?
                  </a>
                </div>

                {/* Botón Principal */}
                <Button type="submit" variant="primary" className="w-100 py-3 mb-4 shadow-sm fs-5" disabled={isLoading}>
                  {isLoading ? 'Verificando...' : (
                    <>Iniciar Sesión <ArrowRight size={20} /></>
                  )}
                </Button>

                <hr className="text-secondary mb-4 opacity-25" />

                {/* Crear Cuenta */}
                <div className="text-center">
                  <p className="text-secondary small mb-2">¿No tienes una cuenta?</p>
                  <Button variant="outline-primary" className="w-100 py-2 rounded-pill bg-transparent border-secondary text-dark fw-semibold">
                    Crear Cuenta <UserPlus size={18} className="ms-1" />
                  </Button>
                </div>

              </form>
            </div>
            
            <div className="text-center mt-5 text-secondary small fw-medium">
              Valle La Armonía © 2024
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}