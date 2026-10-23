import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import CombustibleService from '../../services/api/combustible.service';
import { getApiError } from '../visitas/visitaUtils';
import {
  antiguedadPrecio,
  consumoValido,
  costoEjemplo,
  formatearPesos,
  UNIDADES,
  TIPOS_COMBUSTIBLE,
} from './combustibleUtils';
import CiudadAutocomplete from './CiudadAutocomplete';

const VERDE = '#1B3006';
const KM_EJEMPLO = 10;

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
    return <Card><Aviso tipo="error" icono={AlertCircle}>{loadError}</Aviso></Card>;
  }

  return (
    <Card>
      <div className="d-flex flex-column gap-4">
        {error && <Aviso tipo="error" icono={AlertCircle}>{error}</Aviso>}
        {guardado && <Aviso tipo="ok" icono={CheckCircle2}>Configuración de combustible guardada.</Aviso>}

        <div>
          <span className="combustible-label" id="combustible-tipo-label">Tipo de combustible</span>
          <div className="combustible-tipos" role="radiogroup" aria-labelledby="combustible-tipo-label">
            {TIPOS_COMBUSTIBLE.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={form.tipo === t.valor}
                className={`combustible-tipo ${form.tipo === t.valor ? 'is-selected' : ''}`}
                onClick={() => handleTipo(t.valor)}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="combustible-label" htmlFor="combustible-ciudad">Ciudad</label>
            <CiudadAutocomplete
              id="combustible-ciudad"
              placeholder="Buscá tu ciudad"
              value={form.ciudad}
              opciones={ciudades}
              onChange={handleCiudad}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="combustible-label" htmlFor="combustible-consumo">Consumo cada 100 km</label>
            <div className="input-group">
              <input
                id="combustible-consumo"
                type="number"
                step="any"
                min="0"
                max="100"
                inputMode="decimal"
                className="form-control bg-light"
                placeholder="Ej: 8,5"
                value={form.consumo}
                onChange={(e) => cambiarCampo({ consumo: e.target.value })}
                required
              />
              <span className="input-group-text">{unidad.consumo}</span>
            </div>
            {!consumoOk && form.consumo !== '' && (
              <div className="text-danger small mt-1">Tiene que ser mayor a 0 y hasta 100.</div>
            )}
            <details className="combustible-ayuda mt-2">
              <summary>¿Cómo calculo mi consumo?</summary>
              <p>
                Cargá el tanque lleno, anotá los km que hacés hasta la próxima carga y dividí lo cargado
                ({form.tipo === 'gnc' ? 'm³' : 'litros'}) por esos km, multiplicado por 100.
              </p>
            </details>
          </div>
        </div>

        <div>
          <span className="combustible-label">Estación y producto</span>

          {isLoadingPrecios && <div className="combustible-vacio">Buscando precios...</div>}
          {!isLoadingPrecios && !precios && (
            <div className="combustible-vacio">Elegí tu ciudad para ver los precios disponibles.</div>
          )}
          {!isLoadingPrecios && precios && opciones.length === 0 && (
            <div className="combustible-vacio">No hay precios de {form.tipo} para {precios.ciudad}.</div>
          )}
          {!isLoadingPrecios && precios?.desactualizado && (
            <div className="mb-3">
              <Aviso tipo="aviso" icono={AlertTriangle}>
                No pudimos actualizar los precios: se muestran los últimos guardados.
              </Aviso>
            </div>
          )}

          {!isLoadingPrecios && empresas.map((empresa) => (
            <div key={empresa} className="mb-3">
              <p className="combustible-marca">{empresa}</p>
              {opciones.filter((p) => p.empresa === empresa).map((p) => {
                const elegido = form.empresa === p.empresa && form.producto === p.producto;
                return (
                  <label
                    key={`${p.empresa}-${p.producto}`}
                    className={`combustible-opcion ${elegido ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="combustible-producto"
                      checked={elegido}
                      onChange={() => cambiarCampo({ empresa: p.empresa, producto: p.producto })}
                    />
                    <span className="flex-grow-1 min-w-0">
                      <span className="fw-semibold text-dark d-block">
                        {p.producto}
                        {p.precio === masBarato && <span className="combustible-pill">Más barato</span>}
                      </span>
                      <span className="text-secondary small d-block">
                        {antiguedadPrecio(p.fecha_vigencia, ahora)}
                        {p.precio_de_referencia && p.desde_ciudad && ` · Precio de referencia de ${p.desde_ciudad}`}
                      </span>
                    </span>
                    <span className="combustible-precio">
                      ${p.precio.toLocaleString('es-AR')}<small>{unidad.precio}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        {seleccion && consumoOk && (
          <div className="combustible-ejemplo">
            Ejemplo: un traslado de <strong>{KM_EJEMPLO} km</strong> (solo ida) costaría aproximadamente{' '}
            <strong>{formatearPesos(costoEjemplo(KM_EJEMPLO, form.consumo, seleccion.precio))}</strong>.
          </div>
        )}

        <div>
          <Button
            variant="primary"
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            style={{ backgroundColor: VERDE, borderColor: VERDE }}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
