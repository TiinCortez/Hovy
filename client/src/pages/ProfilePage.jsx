import Card from '../components/ui/Card';
import AuthService from '../services/auth.service';

const ROLES = {
  admin: 'Administrador',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

function Dato({ label, value }) {
  return (
    <div className="col-12 col-md-6">
      <span className="text-secondary d-block fw-semibold small">{label}</span>
      <span className="fw-bold text-dark">{value || '-'}</span>
    </div>
  );
}

// Read-only profile: shows the data already stored in the session.
export default function ProfilePage() {
  const user = AuthService.getSession()?.user;

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <h2 className="fw-bold fs-2 text-dark mb-1">Perfil</h2>
      <Card title="Datos de la cuenta">
        <div className="row g-3">
          <Dato label="Usuario" value={user?.usuario} />
          <Dato label="Correo" value={user?.email} />
          <Dato label="Rol" value={ROLES[user?.rol] ?? user?.rol} />
        </div>
      </Card>
    </div>
  );
}
