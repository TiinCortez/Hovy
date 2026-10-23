import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, MapPin } from 'lucide-react';
import Button from '../ui/Button';
import CloseButton from '../ui/CloseButton';
import Aviso from '../ui/Aviso';

const MAX_DOMICILIO = 200;
const VERDE = '#1B3006';

// Explicit confirmation of the departure point. Nothing is saved until the user
// presses "Confirmar ubicación". The address is a suggestion and can be edited.
export default function ConfirmarUbicacionModal({ propuesta, isSaving, error, onConfirm, onClose }) {
  const [domicilio, setDomicilio] = useState(propuesta?.direccion ?? '');

  if (!propuesta) return null;

  const enlaceMapa = `https://www.google.com/maps/search/?api=1&query=${propuesta.latitud},${propuesta.longitud}`;

  return createPortal(
    <div className="modal d-block bg-dark bg-opacity-50" style={{ zIndex: 1060 }} role="dialog" aria-modal="true" aria-labelledby="confirmar-ubicacion-titulo">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-dark fs-4" id="confirmar-ubicacion-titulo">Confirmar ubicación</h5>
            <CloseButton label="Cerrar" onClick={onClose} disabled={isSaving} />
          </div>

          <div className="modal-body p-4 d-flex flex-column gap-3">
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
          </div>

          <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
            <button type="button" className="btn btn-light rounded-pill px-4 fw-semibold text-secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <Button
              variant="primary"
              onClick={() => onConfirm(domicilio.trim())}
              disabled={isSaving}
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
            >
              {isSaving ? 'Guardando...' : 'Confirmar ubicación'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
