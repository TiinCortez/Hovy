import { useState } from 'react';
import { XCircle } from 'lucide-react';
import Button from '../ui/Button';
import ServiciosVisitaPanel from './ServiciosVisitaPanel';
import PresupuestoPanel from './PresupuestoPanel';
import TurnoPanel from './TurnoPanel';
import CancelarVisitaModal from './CancelarVisitaModal';

// Guided flow of a Confirmada visit without turno: services -> estimate -> final price -> turno
export default function FlujoConfirmada({ visita, onRefresh }) {
  const [showCancel, setShowCancel] = useState(false);
  const hasServicios = Array.isArray(visita.servicios) && visita.servicios.length > 0;
  const accepted = visita.presupuesto?.estado === 'Aceptado';

  return (
    <>
      <ServiciosVisitaPanel visita={visita} onSaved={onRefresh} />
      {/* key remounts the panel when the first services are saved so it fetches the estimate */}
      <PresupuestoPanel key={hasServicios ? 'con-servicios' : 'sin-servicios'} visita={visita} onSaved={onRefresh} />
      <TurnoPanel visita={visita} enabled={accepted} onSaved={onRefresh} />

      <div>
        <Button variant="light" className="text-danger d-flex align-items-center gap-2" onClick={() => setShowCancel(true)}>
          <XCircle size={18} /> Cancelar visita
        </Button>
      </div>

      {showCancel && (
        <CancelarVisitaModal
          idSolicitud={visita.id_solicitud}
          onClose={() => setShowCancel(false)}
          onCancelled={() => onRefresh('Visita cancelada.')}
        />
      )}
    </>
  );
}
