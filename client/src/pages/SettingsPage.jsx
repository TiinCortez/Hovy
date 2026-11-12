import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Fuel } from 'lucide-react';
import SeccionDesplegable from '../components/ui/SeccionDesplegable';
import MercadoPagoConexionCard from '../components/mercadopago/MercadoPagoConexionCard';
import CombustibleConfigCard from '../components/combustible/CombustibleConfigCard';

const ESTADO_CLASE = {
  ok: 'bg-success-subtle text-success border-success-subtle',
  aviso: 'bg-warning-subtle text-warning-emphasis border-warning-subtle',
  error: 'bg-danger-subtle text-danger border-danger-subtle',
  neutro: 'bg-light text-secondary',
};

function Grupo({ titulo, children }) {
  return (
    <section className="d-flex flex-column gap-2">
      <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{titulo}</span>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  // Coming back from the Mercado Pago authorization: open its section so the
  // result notice is visible.
  const [volviendoDeMercadoPago] = useState(() => searchParams.has('mercadopago'));
  const [estadoMercadoPago, setEstadoMercadoPago] = useState({ texto: 'Cargando...', tipo: 'neutro' });
  const [resumenCombustible, setResumenCombustible] = useState('Cargando...');

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <div>
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Preferencias</span>
        </div>
        <h2 className="fw-bold fs-2 text-dark mb-1">Configuración</h2>
      </div>

      <Grupo titulo="Métodos de pago">
        <SeccionDesplegable
          icono={CreditCard}
          titulo="Mercado Pago"
          resumen="Cobrá con QR y registrá los pagos en la cuenta del cliente."
          defaultAbierta={volviendoDeMercadoPago}
          estado={(
            <span className={`badge rounded-pill border fw-semibold flex-shrink-0 px-3 py-2 ${ESTADO_CLASE[estadoMercadoPago.tipo]}`}>
              {estadoMercadoPago.texto}
            </span>
          )}
        >
          <MercadoPagoConexionCard onResumen={setEstadoMercadoPago} />
        </SeccionDesplegable>
      </Grupo>

      <Grupo titulo="Costos de traslado">
        <SeccionDesplegable icono={Fuel} titulo="Ajuste de combustible" resumen={resumenCombustible}>
          <CombustibleConfigCard onResumen={setResumenCombustible} />
        </SeccionDesplegable>
      </Grupo>
    </div>
  );
}
