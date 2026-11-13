import { useState } from 'react';
import { AlertCircle, MapPin } from 'lucide-react';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import ModalUbicacion from './ModalUbicacion';
import { VERDE } from '../../styles/colores';

const MAX_DOMICILIO = 200;

// Explicit confirmation of the departure point. Nothing is saved until the user
// presses "Confirmar ubicación". The address is a suggestion and can be edited.
export default function ConfirmarUbicacionModal({ propuesta, isSaving, error, onConfirm, onClose }) {
  const [domicilio, setDomicilio] = useState(propuesta?.direccion ?? '');

  if (!propuesta) return null;

  const enlaceMapa = `https://www.google.com/maps/search/?api=1&query=${propuesta.latitud},${propuesta.longitud}`;

  return (
    <ModalUbicacion
      titulo="Confirmar ubicación"
      cerrable={!isSaving}
      onClose={onClose}
      footer={(
        <Button
          variant="primary"
          onClick={() => onConfirm(domicilio.trim())}
          disabled={isSaving}
          style={{ backgroundColor: VERDE, borderColor: VERDE }}
        >
          {isSaving ? 'Guardando...' : 'Confirmar ubicación'}
        </Button>
      )}
    >
      {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}

      <div>
        <label className="combustible-label" htmlFor="ubicacion-domicilio">Dirección de salida</label>
        <input
          id="ubicacion-domicilio"
          className="form-control bg-light rounded-3"
          value={domicilio}
          maxLength={MAX_DOMICILIO}
          placeholder="No pudimos obtener la dirección: se guardarán solo las coordenadas"
          onChange={(e) => setDomicilio(e.target.value)}
          disabled={isSaving}
        />
        <div className="form-text d-flex align-items-center gap-2">
          <MapPin size={14} aria-hidden="true" />
          <span>
            {propuesta.latitud}, {propuesta.longitud} ·{' '}
            <a href={enlaceMapa} target="_blank" rel="noreferrer" style={{ color: VERDE }}>Ver en el mapa</a>
          </span>
        </div>
      </div>

      <div>
        <p className="fw-semibold text-dark mb-1">¿Estás seguro de que deseás confirmar la ubicación?</p>
        <p className="small text-secondary mb-0">
          De esto dependerán los cálculos de distancia a tus turnos. Es una ubicación aproximada y
          podés cambiarla o quitarla cuando quieras.
        </p>
      </div>
    </ModalUbicacion>
  );
}
