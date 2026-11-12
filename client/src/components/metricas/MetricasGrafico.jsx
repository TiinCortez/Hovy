import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatearMontoARS, obtenerAhoraTurnos } from '../turnos/agendaTurnos';
import { etiquetaMes } from '../cobros/cobrosUtils';
import { calcularEscala, nombreMes, formatearPorcentaje, formatearKm } from './metricasUtils';

// Duración de la animación de entrada (debe coincidir con metricas.scss)
const DURACION_ANIMACION_MS = 900;
const RETRASO_POR_MES_MS = 40;
const RETRASO_MAXIMO_MS = 400;

const altura = (valor, tope) => `${tope > 0 ? Math.min((valor / tope) * 100, 100) : 0}%`;

const IconoVariacion = ({ valor, size = 16 }) => {
  if (valor > 0) return <TrendingUp size={size} aria-hidden="true" />;
  if (valor < 0) return <TrendingDown size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
};

// Gráfico de barras agrupadas (cobrado / por cobrar / traslado) por mes del período.
// Las barras crecen desde $0 solo al montar la vista: los cambios de filtro
// después de eso se aplican sin transición.
export default function MetricasGrafico({
  detalle, servicio, servicios, onServicioChange, mesDestacado, totalFacturado, etiquetaPeriodo,
  traslado, trasladoKm, variacionTraslado, etiquetaAnterior, trasladoAnterior,
}) {
  const [crecidas, setCrecidas] = useState(false);
  const [animando, setAnimando] = useState(true);
  const [activo, setActivo] = useState(null);
  const scrollRef = useRef(null);

  // When the chart is wider than the screen (mobile), start scrolled to the month
  // that matters: the highlighted one, else the current one, else the last one.
  // Only the chart's own scroll moves, never the page.
  useEffect(() => {
    const contenedor = scrollRef.current;
    if (!contenedor || contenedor.scrollWidth <= contenedor.clientWidth) return;
    const mesActual = obtenerAhoraTurnos().fecha.slice(0, 7);
    const meses = detalle.map((fila) => fila.mes);
    const objetivo = [mesDestacado, mesActual].find((mes) => mes && meses.includes(mes)) ?? meses[meses.length - 1];
    const columna = objetivo && contenedor.querySelector(`[data-mes="${objetivo}"]`);
    if (!columna) return;
    const desplazamiento = columna.getBoundingClientRect().left - contenedor.getBoundingClientRect().left;
    // Leave the target column close to the right edge so the previous months are visible too.
    contenedor.scrollLeft += desplazamiento - (contenedor.clientWidth - columna.offsetWidth) + 16;
  }, [detalle, mesDestacado]);

  useEffect(() => {
    let segundoFrame;
    // Doble frame: el navegador pinta primero las barras en 0 y recién después cambia la altura.
    const primerFrame = requestAnimationFrame(() => {
      segundoFrame = requestAnimationFrame(() => setCrecidas(true));
    });
    const fin = setTimeout(() => setAnimando(false), DURACION_ANIMACION_MS + RETRASO_MAXIMO_MS + 100);
    return () => {
      cancelAnimationFrame(primerFrame);
      cancelAnimationFrame(segundoFrame);
      clearTimeout(fin);
    };
  }, []);

  const escala = useMemo(
    () => calcularEscala(Math.max(0, ...detalle.map((fila) => Math.max(fila.cobrado, fila.porCobrar, fila.traslado)))),
    [detalle],
  );

  const marcasDescendentes = [...escala.marcas].reverse();
  const anchoMinimo = Math.max(detalle.length * 96, 320);
  // El traslado es un gasto: que suba es una mala noticia (terracota), que baje, buena (verde).
  const trasladoSube = variacionTraslado.diferencia > 0;
  const variosAnios = new Set(detalle.map((fila) => fila.mes.slice(0, 4))).size > 1;

  return (
    <div className="metricas-panel">
      <div className="metricas-panel-cabecera">
        <h3 className="metricas-panel-titulo m-0">Evolución de ingresos y cobranzas</h3>

        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3">
          <div className="metricas-select">
            <select
              id="metricasServicio"
              aria-label="Filtrar por servicio"
              className="form-select form-select-sm"
              value={servicio}
              onChange={(e) => onServicioChange(e.target.value)}
            >
              <option value="">Todos los servicios</option>
              {servicios.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
            <ChevronDown size={16} className="metricas-select-icono" aria-hidden="true" />
          </div>

          <div className="metricas-leyenda">
            <span><i className="metricas-leyenda-color metricas-leyenda-color--cobrado" aria-hidden="true"></i>Dinero cobrado</span>
            <span><i className="metricas-leyenda-color metricas-leyenda-color--pendiente" aria-hidden="true"></i>Por cobrar (pendiente)</span>
            <span><i className="metricas-leyenda-color metricas-leyenda-color--traslado" aria-hidden="true"></i>Traslado (logística)</span>
          </div>
        </div>
      </div>

      <div className="metricas-grafico-scroll" ref={scrollRef}>
        <div className={`metricas-grafico ${animando ? 'is-animando' : ''}`} style={{ minWidth: `${anchoMinimo}px` }}>
          {/* Eje Y: etiquetas y líneas comparten la misma base que las barras */}
          <div className="metricas-grafico-eje" aria-hidden="true">
            {marcasDescendentes.map((marca) => (
              <span key={marca} style={{ bottom: altura(marca, escala.tope) }}>{formatearMontoARS(marca)}</span>
            ))}
          </div>

          <div className="metricas-grafico-area">
            {marcasDescendentes.map((marca) => (
              <div
                key={marca}
                className={`metricas-grafico-linea ${marca === 0 ? 'is-base' : ''}`}
                style={{ bottom: altura(marca, escala.tope) }}
                aria-hidden="true"
              ></div>
            ))}

            <div className="metricas-grafico-columnas">
              {detalle.map((fila, index) => {
                const retraso = `${Math.min(index * RETRASO_POR_MES_MS, RETRASO_MAXIMO_MS)}ms`;
                const alineacion = index < 1 ? 'is-izquierda' : (index >= detalle.length - 1 ? 'is-derecha' : '');
                return (
                  <div
                    key={fila.mes}
                    data-mes={fila.mes}
                    className={`metricas-grafico-columna ${activo === fila.mes ? 'is-activa' : ''} ${mesDestacado === fila.mes ? 'is-destacada' : ''}`}
                    tabIndex={0}
                    role="img"
                    aria-label={`${etiquetaMes(fila.mes)}: cobrado ${formatearMontoARS(fila.cobrado)}, por cobrar ${formatearMontoARS(fila.porCobrar)}, traslado ${formatearMontoARS(fila.traslado)}`}
                    onMouseEnter={() => setActivo(fila.mes)}
                    onMouseLeave={() => setActivo(null)}
                    onFocus={() => setActivo(fila.mes)}
                    onBlur={() => setActivo(null)}
                  >
                    <div className="metricas-grafico-barras">
                      <span
                        className="metricas-barra metricas-barra--cobrado"
                        style={{ height: crecidas ? altura(fila.cobrado, escala.tope) : 0, transitionDelay: retraso }}
                      ></span>
                      <span
                        className="metricas-barra metricas-barra--pendiente"
                        style={{ height: crecidas ? altura(fila.porCobrar, escala.tope) : 0, transitionDelay: retraso }}
                      ></span>
                      <span
                        className="metricas-barra metricas-barra--traslado"
                        style={{ height: crecidas ? altura(fila.traslado, escala.tope) : 0, transitionDelay: retraso }}
                      ></span>
                    </div>

                    {activo === fila.mes && (
                      <div className={`metricas-tooltip ${alineacion}`} role="presentation">
                        <div className="metricas-tooltip-titulo">{etiquetaMes(fila.mes)}</div>
                        <div className="metricas-tooltip-fila metricas-tooltip-fila--cobrado">
                          <span><i aria-hidden="true"></i>Cobrado:</span>
                          <strong>{formatearMontoARS(fila.cobrado)}</strong>
                        </div>
                        <div className="metricas-tooltip-fila metricas-tooltip-fila--pendiente">
                          <span><i aria-hidden="true"></i>Por cobrar:</span>
                          <strong>{formatearMontoARS(fila.porCobrar)}</strong>
                        </div>
                        <div className="metricas-tooltip-fila metricas-tooltip-fila--traslado">
                          <span><i aria-hidden="true"></i>Traslado:</span>
                          <strong>{formatearMontoARS(fila.traslado)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meses debajo del eje $0 */}
          <div className="metricas-grafico-etiquetas" aria-hidden="true">
            {detalle.map((fila) => (
              <span
                key={fila.mes}
                className={`${activo === fila.mes ? 'is-activa' : ''} ${mesDestacado === fila.mes ? 'is-destacada' : ''}`}
              >
                {nombreMes(fila.mes)}
                {variosAnios && <small>{fila.mes.slice(0, 4)}</small>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="metricas-panel-pie flex-column flex-md-row align-items-start align-items-md-center">
        <div className="metricas-pie-traslado">
          <span className="d-inline-flex align-items-center gap-2">
            <i className="metricas-leyenda-color metricas-leyenda-color--traslado" aria-hidden="true"></i>
            Traslado · {etiquetaPeriodo}
          </span>
          <strong>{formatearMontoARS(traslado)}</strong>
          <span
            className={`metricas-chip metricas-chip--${trasladoSube ? 'terracota' : 'verde'}`}
            title={`${etiquetaAnterior}: ${formatearMontoARS(trasladoAnterior)}`}
          >
            <IconoVariacion valor={variacionTraslado.diferencia} />
            <strong>{variacionTraslado.porcentaje === null ? 'Sin datos' : formatearPorcentaje(variacionTraslado.porcentaje, { conSigno: true })}</strong>
            <span className="text-secondary fw-normal">vs período anterior</span>
          </span>
          <span className="metricas-pie-km">{formatearKm(trasladoKm)} recorridos</span>
        </div>

        <div className="metricas-pie-total">
          <span>Total facturado · {etiquetaPeriodo}</span>
          <strong>{formatearMontoARS(totalFacturado)}</strong>
        </div>
      </div>
    </div>
  );
}