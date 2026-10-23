import Card from '../components/ui/Card';
import MercadoPagoConexionCard from '../components/mercadopago/MercadoPagoConexionCard';

export default function SettingsPage() {
  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <h2 className="fw-bold fs-2 text-dark mb-1">Configuración</h2>

      <section className="d-flex flex-column gap-2">
        <h5 className="fw-bold text-dark m-0">Métodos de pago</h5>
        <MercadoPagoConexionCard />
      </section>

      <section className="d-flex flex-column gap-2">
        <h5 className="fw-bold text-dark m-0">Ajuste de combustible</h5>
        <Card>
          <p className="text-secondary mb-0">
            Próximamente vas a poder elegir tu combustible y cargar el consumo de tu vehículo para calcular el traslado en los presupuestos.
          </p>
        </Card>
      </section>
    </div>
  );
}
