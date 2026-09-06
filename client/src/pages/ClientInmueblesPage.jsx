import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function ClientInmueblesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Botón Volver */}
      <div>
        <Button 
          variant="outline-primary" 
          className="btn-sm bg-white text-dark border rounded-3 mb-3"
          onClick={() => navigate('/clients')}
        >
          <ArrowLeft size={16} /> Volver a Clientes
        </Button>
      </div>

      {/* Header */}
      <div className="d-flex align-items-center gap-3">
        <div className="p-3 rounded-3 bg-light text-success d-flex align-items-center justify-content-center">
          <Building2 size={28} />
        </div>
        <div>
          <h2 className="fw-bold fs-2 text-dark m-0">Inmuebles del Cliente #{id}</h2>
          <p className="text-secondary small m-0">
            Ficha del cliente y gestión detallada de sus inmuebles y terrenos vinculados.
          </p>
        </div>
      </div>

      {/* Contenido Mock */}
      <Card className="p-4 shadow-sm border-0">
        <div className="text-center py-5">
          <Building2 size={48} className="text-secondary opacity-50 mb-3" />
          <h4 className="fw-bold text-dark mb-2">Detalle de Inmuebles</h4>
          <p className="text-secondary small mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
            Esta sección mostrará los lotes, parcelas y residencias asociadas al cliente ID #{id}.
          </p>
          <span className="badge bg-success-subtle text-success px-3 py-2 fw-semibold">
            Página en desarrollo (Mock)
          </span>
        </div>
      </Card>
    </div>
  );
}