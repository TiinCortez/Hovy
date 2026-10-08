import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, X } from 'lucide-react';
import { useVisitasPendientes } from '../../context/visitasPendientesContext.js';

const DURACION_MS = 10000;

const FRANJA_TEXTO = {
  Mañana: 'por la mañana',
  Tarde: 'por la tarde',
  Indistinto: 'en cualquier horario',
};

// Aviso flotante abajo a la derecha cuando el polling trae una solicitud que
// no estaba al cargar el panel. Solo en pantallas md+ (d-none d-md-block): en
// el celular la campanita del Header ya alcanza y el toast taparía la vista.
export default function VisitaNuevaToast() {
  const navigate = useNavigate();
  const { nuevas, descartarNuevas } = useVisitasPendientes();

  // Se reinicia con cada solicitud que entra, así la última se llega a leer.
  useEffect(() => {
    if (nuevas.length === 0) return;
    const timeoutId = setTimeout(descartarNuevas, DURACION_MS);
    return () => clearTimeout(timeoutId);
  }, [nuevas, descartarNuevas]);

  if (nuevas.length === 0) return null;

  const [ultima] = nuevas;
  const franja = FRANJA_TEXTO[ultima.franja_preferida] ?? FRANJA_TEXTO.Indistinto;
  const extra = nuevas.length - 1;

  const abrirDetalle = () => {
    descartarNuevas();
    navigate(`/visitas/${ultima.id_solicitud}`);
  };

  return (
    <div className="visita-toast d-none d-md-block" role="status" aria-live="polite">
      <div className="visita-toast-card shadow-lg">
        <button
          type="button"
          className="visita-toast-cerrar"
          aria-label="Cerrar notificación"
          onClick={descartarNuevas}
        >
          <X size={16} />
        </button>

        <button type="button" className="visita-toast-cuerpo" onClick={abrirDetalle}>
          <span className="visita-toast-icono">
            <UserPlus size={22} />
          </span>
          <span className="d-flex flex-column gap-1 text-start">
            <span className="fw-bold text-dark">¡Nueva solicitud de visita!</span>
            <span className="small text-secondary">
              {ultima.nombre} {ultima.apellido} quiere una visita {franja}.
              {extra > 0 && ` Y ${extra} solicitud${extra > 1 ? 'es' : ''} más.`}
            </span>
            <span className="visita-toast-link small fw-semibold">Ver detalles</span>
          </span>
        </button>
      </div>
    </div>
  );
}
