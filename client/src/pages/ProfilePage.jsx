import { useState } from 'react';
import { Mail, MapPin, ShieldCheck, User } from 'lucide-react';
import Card from '../components/ui/Card';
import SeccionDesplegable from '../components/ui/SeccionDesplegable';
import SalidaCard from '../components/perfil/SalidaCard';
import AuthService from '../services/auth.service';
import { VERDE } from '../styles/colores';


const ROLES = {
  admin: 'Administrador',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

// One labeled row; long values (emails) wrap instead of being cut or overflowing.
function Dato({ icono: Icono, label, value }) {
  return (
    <div className="d-flex align-items-center gap-3 p-3 rounded-3" style={{ backgroundColor: 'var(--hovy-crema-50)' }}>
      <Icono size={18} className="text-secondary flex-shrink-0" aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <span className="text-secondary d-block fw-semibold" style={{ fontSize: 'var(--hovy-texto-xs)' }}>{label}</span>
        <span className="fw-bold text-dark d-block" style={{ overflowWrap: 'anywhere' }}>{value || '-'}</span>
      </div>
    </div>
  );
}

// Account data is read-only; the departure point is the only editable item.
export default function ProfilePage() {
  const user = AuthService.getSession()?.user;
  const [resumenSalida, setResumenSalida] = useState('Cargando…');
  const rol = ROLES[user?.rol] ?? user?.rol;
  const inicial = (user?.usuario || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="hovy-rotulo">Mi cuenta</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark mb-1">Perfil</h2>
      </div>

      {/* Account card: identity on top, then each field on its own row (read-only) */}
      <Card>
        <div className="d-flex align-items-center gap-3 pb-3 mb-3 border-bottom">
          <span
            className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
            style={{ width: 56, height: 56, backgroundColor: VERDE, fontSize: 'var(--hovy-texto-2xl)' }}
            aria-hidden="true"
          >
            {inicial}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 className="fw-bold fs-5 text-dark m-0 text-truncate">{user?.usuario || 'Mi cuenta'}</h3>
            {rol && (
              <span
                className="d-inline-flex align-items-center gap-1 rounded-pill fw-semibold mt-1"
                style={{ padding: '0.2rem 0.6rem', fontSize: 'var(--hovy-texto-xs)', backgroundColor: 'rgba(27, 48, 6, 0.08)', color: VERDE }}
              >
                <ShieldCheck size={12} /> {rol}
              </span>
            )}
          </div>
        </div>
        <div className="d-flex flex-column gap-2">
          <Dato icono={User} label="Usuario" value={user?.usuario} />
          <Dato icono={Mail} label="Correo" value={user?.email} />
        </div>
      </Card>

      <SeccionDesplegable
        icono={MapPin}
        titulo="Dirección de salida"
        resumen={resumenSalida}
      >
        <SalidaCard onResumen={setResumenSalida} />
      </SeccionDesplegable>
    </div>
  );
}
