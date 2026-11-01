import { useState, useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PeriodoSelector from '../components/metricas/PeriodoSelector';
import MetricasResumen from '../components/metricas/MetricasResumen';
import MetricasGrafico from '../components/metricas/MetricasGrafico';
import MetricasTabla from '../components/metricas/MetricasTabla';
import TurnoService from '../services/api/turno.service';
import ServicioService from '../services/api/servicio.service';
import { obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import {
  periodoPorDefecto, resolverPeriodo, aniosDisponibles, opcionesDeServicio,
  filtrarRealizados, resumirPeriodo, armarDetalleMensual, calcularVariacion,
} from '../components/metricas/metricasUtils';
import '../components/metricas/metricas.scss';

export default function MetricasPage() {
  const hoy = obtenerAhoraTurnos().fecha;
  const mesActual = hoy.slice(0, 7);

  const [turnos, setTurnos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [periodo, setPeriodo] = useState(() => periodoPorDefecto(mesActual));
  const [servicio, setServicio] = useState('');

  // Igual que Cobros: se traen todos los turnos una vez y todo se calcula en memoria.
  // El catálogo solo alimenta el filtro de servicios, así que si falla no bloquea la vista.
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      TurnoService.getAll(),
      ServicioService.getMios().catch(() => ({ data: [] })),
    ])
      .then(([resTurnos, resCatalogo]) => {
        if (!isMounted) return;
        setTurnos(resTurnos.data || []);
        setCatalogo(resCatalogo.data || []);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (isMounted) setErrorMessage(error.response?.data?.error || 'No se pudieron cargar las métricas.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [reloadKey]);

  const rango = useMemo(() => resolverPeriodo(periodo), [periodo]);
  const anios = useMemo(() => aniosDisponibles(turnos, mesActual.slice(0, 4), periodo.anio), [turnos, mesActual, periodo.anio]);
  const servicios = useMemo(() => opcionesDeServicio(catalogo, turnos), [catalogo, turnos]);
  const realizados = useMemo(() => filtrarRealizados(turnos, servicio), [turnos, servicio]);

  const resumen = useMemo(() => resumirPeriodo(realizados, rango.meses, hoy), [realizados, rango, hoy]);
  const anterior = useMemo(() => resumirPeriodo(realizados, rango.mesesAnteriores, hoy), [realizados, rango, hoy]);
  const variacion = calcularVariacion(resumen.cobrado, anterior.cobrado);
  const variacionTraslado = calcularVariacion(resumen.traslado, anterior.traslado);
  const detalle = useMemo(() => armarDetalleMensual(realizados, rango.mesesDetalle), [realizados, rango]);

  const claveTabla = `${rango.mesesDetalle[0]}-${rango.mesesDetalle.length}-${rango.mesDestacado || ''}-${servicio}`;
  const nombreArchivo = `metricas-${rango.mesesDetalle[0]}_${rango.mesesDetalle[rango.mesesDetalle.length - 1]}.csv`;

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <h2 className="fw-bold fs-2 text-dark m-0">Métricas</h2>
        <PeriodoSelector periodo={periodo} etiqueta={rango.etiqueta} anios={anios} onChange={setPeriodo} />
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div></div>
      ) : errorMessage ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <div className="d-flex align-items-center justify-content-center gap-2 text-danger mb-3" role="alert">
            <AlertCircle size={18} />
            <span className="small fw-medium">{errorMessage}</span>
          </div>
          <div><Button variant="light" onClick={handleRetry}>Reintentar</Button></div>
        </Card>
      ) : (
        <>
          <MetricasResumen
            resumen={resumen}
            anterior={anterior}
            variacion={variacion}
            etiquetaAnterior={rango.etiquetaAnterior}
          />

          <MetricasGrafico
            detalle={detalle}
            servicio={servicio}
            servicios={servicios}
            onServicioChange={setServicio}
            mesDestacado={rango.mesDestacado}
            totalFacturado={resumen.facturado}
            etiquetaPeriodo={rango.etiqueta}
            traslado={resumen.traslado}
            trasladoKm={resumen.trasladoKm}
            variacionTraslado={variacionTraslado}
            trasladoAnterior={anterior.traslado}
            etiquetaAnterior={rango.etiquetaAnterior}
          />

          <MetricasTabla
            key={claveTabla}
            detalle={detalle}
            mesDestacado={rango.mesDestacado}
            mesActual={mesActual}
            nombreArchivo={nombreArchivo}
          />
        </>
      )}
    </div>
  );
}