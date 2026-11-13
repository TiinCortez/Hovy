import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Fuel } from 'lucide-react';
import SeccionDesplegable from '../components/ui/SeccionDesplegable';
import MercadoPagoConexionCard from '../components/mercadopago/MercadoPagoConexionCard';
import CombustibleConfigCard from '../components/combustible/CombustibleConfigCard';
import Badge from '../components/ui/Badge';

// Tipo de Badge según el estado de la integración
const ESTADO_BADGE = {
  ok: 'exito',
  aviso: 'pendiente',
  error: 'pendiente',
  neutro: 'neutro',
};

function Grupo({ titulo, children }) {
  return (
    <section className="d-flex flex-column gap-2">
      <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>{titulo}</span>
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
          <span className="hovy-rotulo">Preferencias</span>
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
            <Badge tipo={ESTADO_BADGE[estadoMercadoPago.tipo] || 'neutro'} className="flex-shrink-0">
              {estadoMercadoPago.texto}
            </Badge>
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
