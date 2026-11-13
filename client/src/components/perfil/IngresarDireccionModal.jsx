import { useId, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import ModalUbicacion from './ModalUbicacion';
import { buscarDireccion } from './geolocalizacion';
import { VERDE } from '../../styles/colores';

const MAX_DOMICILIO = 200;

// Written address -> coordinates. Saves nothing: the point it finds goes on to
// the confirmation step, where the user can open it on the map.
export default function IngresarDireccionModal({ onElegida, onClose }) {
  const idFormulario = useId();
  const [direccion, setDireccion] = useState('');
  const [isBuscando, setIsBuscando] = useState(false);
  const [error, setError] = useState(null);

  const texto = direccion.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!texto) return;
    setError(null);
    setIsBuscando(true);
    try {
      onElegida(await buscarDireccion(texto));
    } catch (err) {
      setError(err.mensajeUsuario);
      setIsBuscando(false);
    }
  };

  return (
    <ModalUbicacion
      titulo="Ingresar ubicación de salida"
      cerrable={!isBuscando}
      onClose={onClose}
      footer={(
        <Button
          type="submit"
          form={idFormulario}
          variant="primary"
          disabled={isBuscando || !texto}
          style={{ backgroundColor: VERDE, borderColor: VERDE }}
        >
          {isBuscando ? 'Buscando…' : 'Buscar dirección'}
        </Button>
      )}
    >
      {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}

      <form id={idFormulario} onSubmit={handleSubmit}>
        <label className="combustible-label" htmlFor="salida-direccion-manual">Dirección de salida</label>
        <input
          id="salida-direccion-manual"
          className="form-control bg-light rounded-3"
          value={direccion}
          maxLength={MAX_DOMICILIO}
          placeholder="Ej: Belgrano 450, San Salvador de Jujuy"
          onChange={(e) => setDireccion(e.target.value)}
          disabled={isBuscando}
          autoFocus
        />
        <div className="form-text">Incluí calle, altura y localidad para que la búsqueda sea más precisa.</div>
      </form>
    </ModalUbicacion>
  );
}
