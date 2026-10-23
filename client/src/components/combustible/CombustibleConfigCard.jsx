import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import CombustibleService from '../../services/api/combustible.service';
import { getApiError } from '../visitas/visitaUtils';
import { antiguedadPrecio, consumoValido, UNIDADES, TIPOS_COMBUSTIBLE } from './combustibleUtils';

const VERDE = '#1B3006';

const FORM_VACIO = { ciudad: '', tipo: 'nafta', empresa: '', producto: '', consumo: '' };

// Fuel settings: type, station and product (with live prices) and the vehicle's
// consumption per 100 km, which the budget uses to price the trip.
export default function CombustibleConfigCard() {
  const [ahora] = useState(() => Date.now());
  const [form, setForm] = useState(FORM_VACIO);
  const [ciudades, setCiudades] = useState([]);
  const [precios, setPrecios] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrecios, setIsLoadingPrecios] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  const cargarPrecios = useCallback(async (ciudad) => {
    setIsLoadingPrecios(true);
    setError(null);
    try {
      const res = await CombustibleService.getPrecios(ciudad);
      setPrecios(res.data);
    } catch (err) {
      setPrecios(null);
      setError(getApiError(err, 'No se pudieron obtener los precios de combustible.'));
    } finally {
      setIsLoadingPrecios(false);
    }
  }, []);

  // First load: saved settings + list of cities, then the prices of the saved city.
  useEffect(() => {
    let cancelled = false;
    Promise.all([CombustibleService.getConfig(), CombustibleService.getCiudades().catch(() => null)])
      .then(([config, listado]) => {
        if (cancelled) return;
        setCiudades(listado?.data ?? []);
        const c = config.data;
        setForm({
          ciudad: c.ciudad ?? '',
          tipo: c.tipo ?? 'nafta',
          empresa: c.empresa ?? '',
          producto: c.producto ?? '',
          consumo: c.consumo_100km != null ? String(c.consumo_100km) : '',
        });
        if (c.ciudad) {
          return CombustibleService.getPrecios(c.ciudad)
            .then((res) => { if (!cancelled) setPrecios(res.data); })
            .catch((err) => { if (!cancelled) setError(getApiError(err, 'No se pudieron obtener los precios de combustible.')); });
        }
        return undefined;
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiError(err, 'No se pudo cargar la configuración de combustible.'));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cambiarCampo = (cambios) => {
    setForm((prev) => ({ ...prev, ...cambios }));
    setGuardado(false);
    setError(null);
  };

  const handleCiudad = (valor) => {
    const enLista = ciudades.includes(valor.toUpperCase());
    const ciudad = enLista ? valor.toUpperCase() : valor;
    cambiarCampo({ ciudad, empresa: '', producto: '' });
    // Prices are only requested for a city taken from the list; while typing,
    // the previous city's prices are hidden so they are not mistaken for these.
    if (enLista) {
      cargarPrecios(ciudad);
    } else {
      setPrecios(null);
    }
  };

  // The consumption unit changes with the type (L vs m3): the old value would be meaningless.
  const handleTipo = (tipo) => cambiarCampo({ tipo, empresa: '', producto: '', consumo: '' });

  const opciones = (precios?.precios ?? []).filter((p) => p.tipo === form.tipo);
  const masBarato = opciones.length > 0 ? Math.min(...opciones.map((p) => p.precio)) : null;
  const empresas = [...new Set(opciones.map((p) => p.empresa))];
  const unidad = UNIDADES[form.tipo];
  const seleccion = opciones.find((p) => p.empresa === form.empresa && p.producto === form.producto);

  const consumoOk = consumoValido(form.consumo);
  const puedeGuardar = Boolean(seleccion) && consumoOk && !isSaving;

  const handleGuardar = async () => {
    setIsSaving(true);
    setError(null);
    setGuardado(false);
    try {
      await CombustibleService.guardarConfig({
        ciudad: form.ciudad,
        tipo: form.tipo,
        empresa: form.empresa,
        producto: form.producto,
        consumo_100km: Number(String(form.consumo).replace(',', '.')),
      });
      setGuardado(true);
    } catch (err) {
      setError(getApiError(err, 'No se pudo guardar la configuración de combustible.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Card><p className="text-secondary mb-0">Cargando configuración de combustible...</p></Card>;
  }

  if (loadError) {
    return <Card><p className="text-danger small fw-medium mb-0" role="alert">{loadError}</p></Card>;
  }

  return (
    <Card>
      <div className="d-flex flex-column gap-4">
        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-0" role="alert">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="small fw-medium">{error}</span>
          </div>
        )}
        {guardado && (
          <div className="alert alert-success d-flex align-items-center gap-2 rounded-3 mb-0" role="status">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span className="small fw-medium">Configuración de combustible guardada.</span>
          </div>
        )}

        <div>
          <span className="form-label small fw-bold text-secondary d-block">Tipo de combustible</span>
          <div className="d-flex gap-3 flex-wrap">
            {TIPOS_COMBUSTIBLE.map((t) => (
              <div className="form-check" key={t.valor}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="combustible-tipo"
                  id={`combustible-tipo-${t.valor}`}
                  checked={form.tipo === t.valor}
                  onChange={() => handleTipo(t.valor)}
                />
                <label className="form-check-label" htmlFor={`combustible-tipo-${t.valor}`}>{t.etiqueta}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-bold text-secondary" htmlFor="combustible-ciudad">Ciudad</label>
            <input
              id="combustible-ciudad"
              list="combustible-ciudades"
              className="form-control bg-light rounded-3"
              placeholder="Buscá tu ciudad"
              autoComplete="off"
              value={form.ciudad}
              onChange={(e) => handleCiudad(e.target.value)}
            />
            <datalist id="combustible-ciudades">
              {ciudades.map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="form-text">Elegí una ciudad de la lista para ver los precios.</div>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-bold text-secondary" htmlFor="combustible-consumo">
              Consumo cada 100 km ({unidad.consumo})
            </label>
            <input
              id="combustible-consumo"
              type="number"
              step="any"
              min="0"
              max="100"
              inputMode="decimal"
              className="form-control bg-light rounded-3"
              value={form.consumo}
              onChange={(e) => cambiarCampo({ consumo: e.target.value })}
              required
            />
            <div className="form-text">
              Obligatorio para calcular el traslado. Para conocerlo: cargá el tanque, anotá los km hasta la
              próxima carga y dividí lo cargado por esos km × 100.
            </div>
          </div>
        </div>

        <div>
          <span className="form-label small fw-bold text-secondary d-block">Estación y producto</span>
          {isLoadingPrecios && <p className="text-secondary small mb-0">Buscando precios...</p>}
          {!isLoadingPrecios && !precios && (
            <p className="text-secondary small mb-0">Elegí una ciudad para ver los precios.</p>
          )}
          {!isLoadingPrecios && precios && opciones.length === 0 && (
            <p className="text-secondary small mb-0">No hay precios de {form.tipo} para {precios.ciudad}.</p>
          )}
          {!isLoadingPrecios && precios?.desactualizado && (
            <div className="alert alert-warning d-flex align-items-center gap-2 rounded-3 py-2 small">
              <AlertTriangle size={16} className="flex-shrink-0" />
              No pudimos actualizar los precios: se muestran los últimos guardados.
            </div>
          )}
          {!isLoadingPrecios && empresas.map((empresa) => (
            <div key={empresa} className="mb-3">
              <div className="fw-bold small mb-1" style={{ color: VERDE }}>{empresa}</div>
              <div className="list-group">
                {opciones.filter((p) => p.empresa === empresa).map((p) => {
                  const elegido = form.empresa === p.empresa && form.producto === p.producto;
                  return (
                    <label
                      key={`${p.empresa}-${p.producto}`}
                      className={`list-group-item d-flex align-items-center gap-3 ${elegido ? 'border-success' : ''}`}
                      style={{ cursor: 'pointer', ...(elegido ? { borderColor: VERDE, backgroundColor: '#f4f7ef' } : {}) }}
                    >
                      <input
                        className="form-check-input m-0"
                        type="radio"
                        name="combustible-producto"
                        checked={elegido}
                        onChange={() => cambiarCampo({ empresa: p.empresa, producto: p.producto })}
                      />
                      <span className="flex-grow-1">
                        <span className="fw-semibold d-block">
                          {p.producto}
                          {p.precio === masBarato && (
                            <span className="badge rounded-pill text-bg-success ms-2">Más barato</span>
                          )}
                        </span>
                        <span className="text-secondary small d-block">
                          {antiguedadPrecio(p.fecha_vigencia, ahora)}
                          {p.precio_de_referencia && p.desde_ciudad && ` · Precio de referencia de ${p.desde_ciudad}`}
                        </span>
                      </span>
                      <span className="fw-bold text-dark text-nowrap">
                        ${p.precio.toLocaleString('es-AR')} {unidad.precio}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Button
            variant="primary"
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            style={{ backgroundColor: VERDE, borderColor: VERDE }}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
          {!consumoOk && form.consumo !== '' && (
            <span className="text-danger small">El consumo tiene que ser mayor a 0 y hasta 100.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
