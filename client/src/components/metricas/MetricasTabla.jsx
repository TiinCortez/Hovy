import { useState } from 'react';
import { Sheet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Button from '../ui/Button';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import { etiquetaMes } from '../cobros/cobrosUtils';
import { MESES_POR_PAGINA, armarCsv, formatearPorcentaje, formatearDiferencia } from './metricasUtils';

const descargarCsv = (detalle, nombreArchivo) => {
  // BOM para que Excel abra bien los acentos
  const blob = new Blob(['﻿', armarCsv(detalle)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
};

const Variacion = ({ variacion }) => {
  if (variacion.porcentaje === null && variacion.diferencia === 0) {
    return <span className="metricas-variacion is-neutra"><Minus size={16} aria-hidden="true" /> Sin variación</span>;
  }
  const baja = variacion.diferencia < 0;
  const Icono = baja ? TrendingDown : (variacion.diferencia > 0 ? TrendingUp : Minus);
  return (
    <span className={`metricas-variacion ${baja ? 'is-baja' : 'is-sube'}`}>
      <Icono size={16} aria-hidden="true" />
      {variacion.porcentaje === null ? '' : `${formatearPorcentaje(variacion.porcentaje, { conSigno: true })} `}
      ({formatearDiferencia(variacion.diferencia)})
    </span>
  );
};

// Desglose mensual: el más reciente primero, de a MESES_POR_PAGINA meses.
// El CSV siempre incluye todos los meses del período, no solo la página visible.
// El padre la remonta (key) al cambiar el período o el servicio para volver a la página inicial.
export default function MetricasTabla({ detalle, mesDestacado, mesActual, nombreArchivo }) {
  const filas = [...detalle].reverse();
  const totalPaginas = Math.max(1, Math.ceil(filas.length / MESES_POR_PAGINA));
  const paginaInicial = mesDestacado
    ? Math.floor(Math.max(0, filas.findIndex((fila) => fila.mes === mesDestacado)) / MESES_POR_PAGINA) + 1
    : 1;
  const [pagina, setPagina] = useState(paginaInicial);

  const paginaActiva = Math.min(pagina, totalPaginas);
  const desde = (paginaActiva - 1) * MESES_POR_PAGINA;
  const visibles = filas.slice(desde, desde + MESES_POR_PAGINA);

  return (
    <div className="metricas-panel">
      <div className="metricas-panel-cabecera">
        <h3 className="metricas-panel-titulo m-0">Desglose mensual de resultados</h3>
        <Button
          variant="light"
          size="sm"
          className="metricas-boton-csv"
          disabled={filas.length === 0}
          onClick={() => descargarCsv(detalle, nombreArchivo)}
        >
          <Sheet size={16} aria-hidden="true" /> Descargar CSV
        </Button>
      </div>

      <div className="metricas-tabla-scroll">
        <table className="metricas-tabla">
          <thead>
            <tr>
              <th scope="col">Período / Mes</th>
              <th scope="col">Dinero cobrado</th>
              <th scope="col">Por cobrar</th>
              <th scope="col">Total facturado</th>
              <th scope="col" className="text-end">Variación vs mes anterior</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => {
              const destacada = fila.mes === mesDestacado;
              return (
                <tr key={fila.mes} className={destacada ? 'is-destacada' : ''} aria-current={destacada ? 'true' : undefined}>
                  <th scope="row">
                    <span className="d-inline-flex align-items-center gap-2">
                      {destacada && <span className="metricas-punto" aria-hidden="true"></span>}
                      {etiquetaMes(fila.mes)}
                      {fila.mes === mesActual && <span className="metricas-etiqueta-curso">En curso</span>}
                    </span>
                  </th>
                  <td className="metricas-celda-cobrado">{formatearMontoARS(fila.cobrado)}</td>
                  <td className="metricas-celda-pendiente">{formatearMontoARS(fila.porCobrar)}</td>
                  <td className="metricas-celda-total">{formatearMontoARS(fila.facturado)}</td>
                  <td className="text-end"><Variacion variacion={fila.variacion} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="metricas-panel-pie flex-column flex-sm-row gap-3">
        <span className="text-secondary small">
          Mostrando <strong className="text-dark">{visibles.length === 0 ? 0 : desde + 1} - {desde + visibles.length}</strong> de <strong className="text-dark">{filas.length}</strong> meses
        </span>
        {totalPaginas > 1 && (
          <div className="d-flex align-items-center gap-1 flex-wrap justify-content-center">
            <Button variant="light" size="sm" disabled={paginaActiva === 1} onClick={() => setPagina(paginaActiva - 1)}>
              Anterior
            </Button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
              <Button
                key={numero}
                variant={numero === paginaActiva ? 'primary' : 'light'}
                size="sm"
                aria-current={numero === paginaActiva ? 'page' : undefined}
                onClick={() => setPagina(numero)}
              >
                {numero}
              </Button>
            ))}
            <Button variant="light" size="sm" disabled={paginaActiva === totalPaginas} onClick={() => setPagina(paginaActiva + 1)}>
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}