import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import PerfilService from '../../services/api/perfil.service';
import { getApiError } from '../visitas/visitaUtils';
import { obtenerUbicacion } from './geolocalizacion';
import ConfirmarUbicacionModal from './ConfirmarUbicacionModal';

const VERDE = '#1B3006';

// Optional departure point: the browser gives an approximate position (with the
// user's permission), the user confirms it and from then on the distance of the
// trips to the properties is measured from there.
export default function SalidaCard() {
  const [salida, setSalida] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isBuscando, setIsBuscando] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [propuesta, setPropuesta] = useState(null);
  const [error, setError] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    PerfilService.getSalida()
      .then((res) => { if (!cancelled) setSalida(res.data); })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiError(err, 'No se pudo cargar tu dirección de salida.'));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleUsarUbicacion = async () => {
    setError(null);
    setGuardado(false);
    setConfirmandoQuitar(false);
    setIsBuscando(true);
    try {
      const posicion = await obtenerUbicacion();
      const res = await PerfilService.sugerirSalida(posicion);
      setErrorModal(null);
      setPropuesta(res.data);
    } catch (err) {
      setError(err.mensajeUsuario || getApiError(err, 'No se pudo obtener tu ubicación.'));
    } finally {
      setIsBuscando(false);
    }
  };

  const handleConfirmar = async (domicilio) => {
    setIsSaving(true);
    setErrorModal(null);
    try {
      const res = await PerfilService.guardarSalida({
        latitud: propuesta.latitud,
        longitud: propuesta.longitud,
        domicilio: domicilio || null,
      });
      setSalida(res.data);
      setPropuesta(null);
      setGuardado(true);
    } catch (err) {
      setErrorModal(getApiError(err, 'No se pudo guardar la ubicación.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuitar = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const res = await PerfilService.quitarSalida();
      setSalida(res.data);
      setConfirmandoQuitar(false);
      setGuardado(false);
    } catch (err) {
      setError(getApiError(err, 'No se pudo quitar la ubicación.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Card title="Dirección de salida"><p className="text-secondary mb-0">Cargando...</p></Card>;
  }

  if (loadError) {
    return <Card title="Dirección de salida"><Aviso tipo="error" icono={AlertCircle}>{loadError}</Aviso></Card>;
  }

  const enlaceMapa = salida?.configurada
    ? `https://www.google.com/maps/search/?api=1&query=${salida.latitud},${salida.longitud}`
    : null;

  return (
    <>
      <Card title="Dirección de salida (opcional)">
        <div className="d-flex flex-column gap-3">
          <p className="text-secondary small mb-0">
            Es el punto desde donde salís hacia tus turnos. Con tu permiso, el navegador obtiene tu ubicación
            aproximada y vos confirmás si querés guardarla. De esto dependen los cálculos de distancia y
            el costo de traslado de los presupuestos.
          </p>

          {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}
          {guardado && <Aviso tipo="ok" icono={CheckCircle2}>Dirección de salida guardada.</Aviso>}

          {salida?.configurada ? (
            <div className="d-flex align-items-start gap-2">
              <MapPin size={18} className="flex-shrink-0 mt-1" style={{ color: VERDE }} aria-hidden="true" />
              <div>
                <span className="fw-bold text-dark d-block">{salida.domicilio || 'Ubicación guardada'}</span>
                <span className="text-secondary small">
                  {salida.latitud}, {salida.longitud} ·{' '}
                  <a href={enlaceMapa} target="_blank" rel="noreferrer" style={{ color: VERDE }}>Ver en el mapa</a>
                </span>
              </div>
            </div>
          ) : (
            <div className="combustible-vacio">Todavía no cargaste tu dirección de salida.</div>
          )}

          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Button
              variant="primary"
              onClick={handleUsarUbicacion}
              disabled={isBuscando || isSaving}
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
            >
              {isBuscando
                ? 'Obteniendo ubicación...'
                : (salida?.configurada ? 'Actualizar con mi ubicación' : 'Usar mi ubicación')}
            </Button>

            {salida?.configurada && !confirmandoQuitar && (
              <Button variant="outline-danger" onClick={() => setConfirmandoQuitar(true)} disabled={isBuscando || isSaving}>
                Quitar
              </Button>
            )}
            {salida?.configurada && confirmandoQuitar && (
              <span className="d-flex align-items-center gap-2 small">
                <span className="fw-semibold text-dark">¿Quitar tu dirección de salida?</span>
                <Button variant="danger" size="sm" onClick={handleQuitar} disabled={isSaving}>
                  {isSaving ? 'Quitando...' : 'Sí, quitar'}
                </Button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => setConfirmandoQuitar(false)} disabled={isSaving}>
                  Cancelar
                </button>
              </span>
            )}
          </div>
        </div>
      </Card>

      {propuesta && (
        <ConfirmarUbicacionModal
          // Remounts when a new position is proposed, so the address field restarts.
          key={`${propuesta.latitud},${propuesta.longitud}`}
          propuesta={propuesta}
          isSaving={isSaving}
          error={errorModal}
          onConfirm={handleConfirmar}
          onClose={() => setPropuesta(null)}
        />
      )}
    </>
  );
}
