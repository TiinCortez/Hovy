import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import AuthService from '../../services/auth.service.js';

const LARGO_MINIMO_PASSWORD = 8;

function CampoPassword({
  id,
  label,
  error,
  errorId,
  autoComplete,
  enterKeyHint = 'done',
  placeholder = '••••••••',
  registration,
  ayuda,
}) {
  const [visible, setVisible] = useState(false);
  const ayudaId = ayuda ? `${id}-ayuda` : undefined;
  const describedBy = [ayudaId, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="login-label">{label}</label>
      <div className={`login-field ${error ? 'is-invalid' : ''}`}>
        <Lock size={18} className="login-field-icon" aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          {...registration}
        />
        <button
          type="button"
          className="login-eye-btn"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {ayuda && (
        <p id={ayudaId} className="text-secondary m-0 mt-1" style={{ fontSize: 'var(--hovy-texto-xs)' }}>{ayuda}</p>
      )}
      {error && <div id={errorId} className="text-danger small mt-1 fw-medium">{error.message}</div>}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  // vista: 'login' | 'primer-ingreso' | 'recuperar-email' | 'recuperar-codigo'
  const [vista, setVista] = useState('login');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [credencialesTemporales, setCredencialesTemporales] = useState(null);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');

  const headingRef = useRef(null);
  const haCambiadoVistaRef = useRef(false);

  useEffect(() => {
    if (!haCambiadoVistaRef.current) {
      haCambiadoVistaRef.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [vista]);

  const formLogin = useForm({ mode: 'onTouched' });
  const formPrimerIngreso = useForm({ mode: 'onTouched' });
  const formRecuperarEmail = useForm({ mode: 'onTouched' });
  const formRecuperarCodigo = useForm({ mode: 'onTouched' });

  const cambiarVista = (nuevaVista, { mantenerAviso = false } = {}) => {
    setErrorMsg(null);
    if (!mantenerAviso) setSuccessMsg(null);
    setVista(nuevaVista);
  };

  const handleLogin = async (data) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await AuthService.login(data.email.trim(), data.password, () => {
        navigate('/dashboard');
      });
    } catch (error) {
      if (error.requiereCambioPassword) {
        setCredencialesTemporales({ email: data.email.trim(), passwordTemporal: data.password });
        formPrimerIngreso.reset();
        cambiarVista('primer-ingreso');
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimerIngreso = async (data) => {
    if (!credencialesTemporales) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await AuthService.cambiarPasswordInicial(
        { ...credencialesTemporales, nuevaPassword: data.nuevaPassword },
        () => navigate('/dashboard')
      );
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirRecuperacion = () => {
    const emailActual = (formLogin.getValues('email') || '').trim();
    if (emailActual) formRecuperarEmail.setValue('email', emailActual);
    cambiarVista('recuperar-email');
  };

  const handleEnviarCodigo = async (data) => {
    const email = data.email.trim();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await AuthService.solicitarCodigoRecuperacion(email);
      setEmailRecuperacion(email);
      formRecuperarCodigo.reset();
      setSuccessMsg(res.mensaje || 'Si el correo está registrado, vas a recibir un código de recuperación.');
      cambiarVista('recuperar-codigo', { mantenerAviso: true });
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReenviarCodigo = async () => {
    if (!emailRecuperacion || isResending) return;
    setIsResending(true);
    setErrorMsg(null);
    try {
      const res = await AuthService.reenviarCodigoRecuperacion(emailRecuperacion);
      setSuccessMsg(res.mensaje || 'Si el correo está registrado, vas a recibir un nuevo código.');
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleRestablecerPassword = async (data) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await AuthService.restablecerPassword({
        email: emailRecuperacion,
        codigo: data.codigo.trim(),
        nuevaPassword: data.nuevaPassword,
      });
      formLogin.setValue('email', emailRecuperacion);
      formLogin.setValue('password', '');
      setSuccessMsg('Contraseña actualizada. Ya podés iniciar sesión.');
      cambiarVista('login', { mantenerAviso: true });
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-portal">
      <div className="login-portal-deco login-portal-deco--top" aria-hidden="true" />
      <div className="login-portal-deco login-portal-deco--bottom" aria-hidden="true" />

      <header className="login-topbar">
        <div className="login-brand">
          <img
            src="/hovy-emblema.webp"
            alt=""
            className="login-brand-emblema"
            width="36"
            height="36"
          />
          <span className="login-brand-nombre">Hovy</span>
        </div>
      </header>

      <main className="login-main">
        <div className="login-portal-card">

          {vista !== 'login' && (
            <button
              type="button"
              className="login-text-btn mb-3"
              onClick={() => cambiarVista(vista === 'recuperar-codigo' ? 'recuperar-email' : 'login')}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {vista === 'recuperar-codigo' ? 'Cambiar correo' : 'Volver al ingreso'}
            </button>
          )}

          {vista === 'login' && (
            <div className="mb-4">
              <h1 ref={headingRef} tabIndex={-1} className="login-title">Bienvenido</h1>
              <p className="login-subtitle">Panel operativo de agenda, clientes y cobros.</p>
            </div>
          )}

          {vista === 'primer-ingreso' && (
            <div className="mb-4">
              <h1 ref={headingRef} tabIndex={-1} className="login-title">Elegí tu contraseña</h1>
              <p className="login-subtitle">
                Ingresaste con una clave temporal. Definí una contraseña propia para continuar.
              </p>
            </div>
          )}

          {vista === 'recuperar-email' && (
            <div className="mb-4">
              <h1 ref={headingRef} tabIndex={-1} className="login-title">Recuperar acceso</h1>
              <p className="login-subtitle">Ingresá tu correo y te enviamos un código de verificación.</p>
            </div>
          )}

          {vista === 'recuperar-codigo' && (
            <div className="mb-4">
              <h1 ref={headingRef} tabIndex={-1} className="login-title">Ingresá el código</h1>
              <p className="login-subtitle">
                Revisá <strong className="text-dark">{emailRecuperacion}</strong> y definí tu nueva contraseña.
              </p>
            </div>
          )}

          {successMsg && (
            <div
              className="alert alert-success d-flex align-items-start gap-2 rounded-3 py-2 px-3 mb-3 small fw-semibold"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div
              className="alert alert-danger d-flex align-items-start gap-2 rounded-3 py-2 px-3 mb-3 small fw-semibold"
              role="alert"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-1" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {vista === 'login' && (
            <form onSubmit={formLogin.handleSubmit(handleLogin)} className="d-flex flex-column gap-3" noValidate>
              <div>
                <label htmlFor="login-email" className="login-label">Correo electrónico</label>
                <div className={`login-field ${formLogin.formState.errors.email ? 'is-invalid' : ''}`}>
                  <Mail size={18} className="login-field-icon" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    aria-invalid={formLogin.formState.errors.email ? 'true' : undefined}
                    aria-describedby={formLogin.formState.errors.email ? 'login-email-error' : undefined}
                    placeholder="Ingresá tu correo"
                    {...formLogin.register('email', {
                      required: 'El correo es obligatorio',
                      pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: 'El formato del correo no es válido',
                      },
                    })}
                  />
                </div>
                {formLogin.formState.errors.email && (
                  <div id="login-email-error" className="text-danger small mt-1 fw-medium">
                    {formLogin.formState.errors.email.message}
                  </div>
                )}
              </div>

              <CampoPassword
                id="login-password"
                label="Contraseña"
                autoComplete="current-password"
                error={formLogin.formState.errors.password}
                errorId="login-password-error"
                registration={formLogin.register('password', {
                  required: 'La contraseña es obligatoria',
                })}
              />

              <div className="d-flex justify-content-end">
                <button type="button" className="login-text-btn" onClick={abrirRecuperacion}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <Button type="submit" variant="primary" className="w-100 login-submit" disabled={isLoading}>
                {isLoading ? 'Ingresando…' : (
                  <>Iniciar sesión <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </Button>
            </form>
          )}

          {vista === 'primer-ingreso' && (
            <form onSubmit={formPrimerIngreso.handleSubmit(handlePrimerIngreso)} className="d-flex flex-column gap-3" noValidate>
              <CampoPassword
                id="inicial-password"
                label="Nueva contraseña"
                autoComplete="new-password"
                enterKeyHint="next"
                ayuda={`Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.`}
                error={formPrimerIngreso.formState.errors.nuevaPassword}
                errorId="inicial-password-error"
                registration={formPrimerIngreso.register('nuevaPassword', {
                  required: 'Ingresá una contraseña nueva',
                  minLength: {
                    value: LARGO_MINIMO_PASSWORD,
                    message: `Debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
                  },
                  validate: (val) =>
                    val !== credencialesTemporales?.passwordTemporal || 'Debe ser distinta a la contraseña temporal',
                })}
              />

              <CampoPassword
                id="inicial-password-confirm"
                label="Confirmar contraseña"
                autoComplete="new-password"
                error={formPrimerIngreso.formState.errors.confirmarPassword}
                errorId="inicial-password-confirm-error"
                registration={formPrimerIngreso.register('confirmarPassword', {
                  required: 'Confirmá la nueva contraseña',
                  validate: (val) =>
                    val === formPrimerIngreso.getValues('nuevaPassword') || 'Las contraseñas no coinciden',
                })}
              />

              <Button type="submit" variant="primary" className="w-100 login-submit mt-1" disabled={isLoading}>
                {isLoading ? 'Guardando…' : (
                  <>Guardar y entrar <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </Button>
            </form>
          )}

          {vista === 'recuperar-email' && (
            <form onSubmit={formRecuperarEmail.handleSubmit(handleEnviarCodigo)} className="d-flex flex-column gap-3" noValidate>
              <div>
                <label htmlFor="recuperar-email" className="login-label">Correo electrónico</label>
                <div className={`login-field ${formRecuperarEmail.formState.errors.email ? 'is-invalid' : ''}`}>
                  <Mail size={18} className="login-field-icon" aria-hidden="true" />
                  <input
                    id="recuperar-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    aria-invalid={formRecuperarEmail.formState.errors.email ? 'true' : undefined}
                    aria-describedby={formRecuperarEmail.formState.errors.email ? 'recuperar-email-error' : undefined}
                    placeholder="Ingresá tu correo"
                    {...formRecuperarEmail.register('email', {
                      required: 'El correo es obligatorio',
                      pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: 'El formato del correo no es válido',
                      },
                    })}
                  />
                </div>
                {formRecuperarEmail.formState.errors.email && (
                  <div id="recuperar-email-error" className="text-danger small mt-1 fw-medium">
                    {formRecuperarEmail.formState.errors.email.message}
                  </div>
                )}
              </div>

              <Button type="submit" variant="primary" className="w-100 login-submit" disabled={isLoading}>
                {isLoading ? 'Enviando…' : (
                  <>Enviar código <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </Button>
            </form>
          )}

          {vista === 'recuperar-codigo' && (
            <form onSubmit={formRecuperarCodigo.handleSubmit(handleRestablecerPassword)} className="d-flex flex-column gap-3" noValidate>
              <div>
                <label htmlFor="recuperar-codigo" className="login-label">Código de verificación</label>
                <div className={`login-field ${formRecuperarCodigo.formState.errors.codigo ? 'is-invalid' : ''}`}>
                  <KeyRound size={18} className="login-field-icon" aria-hidden="true" />
                  <input
                    id="recuperar-codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    aria-invalid={formRecuperarCodigo.formState.errors.codigo ? 'true' : undefined}
                    aria-describedby={formRecuperarCodigo.formState.errors.codigo ? 'recuperar-codigo-error' : undefined}
                    placeholder="Ingresá el código recibido"
                    {...formRecuperarCodigo.register('codigo', {
                      required: 'El código es obligatorio',
                    })}
                  />
                </div>
                {formRecuperarCodigo.formState.errors.codigo && (
                  <div id="recuperar-codigo-error" className="text-danger small mt-1 fw-medium">
                    {formRecuperarCodigo.formState.errors.codigo.message}
                  </div>
                )}
              </div>

              <CampoPassword
                id="recuperar-password"
                label="Nueva contraseña"
                autoComplete="new-password"
                ayuda={`Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.`}
                error={formRecuperarCodigo.formState.errors.nuevaPassword}
                errorId="recuperar-password-error"
                registration={formRecuperarCodigo.register('nuevaPassword', {
                  required: 'Ingresá tu nueva contraseña',
                  minLength: {
                    value: LARGO_MINIMO_PASSWORD,
                    message: `Debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
                  },
                })}
              />

              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="login-text-btn"
                  onClick={handleReenviarCodigo}
                  disabled={isResending}
                >
                  {isResending ? 'Reenviando…' : 'Reenviar código'}
                </button>
              </div>

              <Button type="submit" variant="primary" className="w-100 login-submit" disabled={isLoading}>
                {isLoading ? 'Actualizando…' : (
                  <>Actualizar contraseña <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </Button>
            </form>
          )}

          <div className="login-card-note">
            <ShieldCheck size={15} className="text-success flex-shrink-0" aria-hidden="true" />
            <span>Alta de cuentas gestionada por administración</span>
          </div>
        </div>
      </main>

      <footer className="login-footer">Hovy © 2026</footer>
    </div>
  );
}
