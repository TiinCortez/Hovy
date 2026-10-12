import fs from 'fs/promises';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { falla } from '../../utils/solicitudesVisita.js';
import {
  RUTA_PLANTILLA,
  PLANTILLA_ANCHO,
  PLANTILLA_ALTO,
  AREA_QR,
  ESCALA_SALIDA,
  MARGEN_MODULOS,
  NIVEL_CORRECCION,
  MAX_LARGO_CONTENIDO,
} from './qrPlantillaConstants.js';

const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };

// The template (already upscaled) is read once and kept in memory.
let plantillaEnCache = null;

const cargarPlantilla = async () => {
  if (plantillaEnCache) return plantillaEnCache;
  const original = await fs.readFile(RUTA_PLANTILLA);
  const { width, height } = await sharp(original).metadata();
  if (width !== PLANTILLA_ANCHO || height !== PLANTILLA_ALTO) {
    throw new Error(
      `QR template is ${width}x${height}, expected ${PLANTILLA_ANCHO}x${PLANTILLA_ALTO}: update qrPlantillaConstants.js`
    );
  }
  plantillaEnCache = await sharp(original)
    .resize(PLANTILLA_ANCHO * ESCALA_SALIDA, PLANTILLA_ALTO * ESCALA_SALIDA, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  return plantillaEnCache;
};

// Returns the QR (quiet zone included) as a PNG of exactly the QR area size:
// 1px-per-module PNG -> nearest-neighbour upscale by an integer factor ->
// centered on a white square that also hides the template's placeholder icon.
const generarQrEnArea = async (contenido, ladoArea) => {
  const base = await QRCode.toBuffer(contenido, {
    type: 'png',
    errorCorrectionLevel: NIVEL_CORRECCION,
    margin: MARGEN_MODULOS,
    scale: 1,
  });
  const { width: modulos } = await sharp(base).metadata();
  const pxPorModulo = Math.floor(ladoArea / modulos);
  if (pxPorModulo < 1) return null;

  const lado = modulos * pxPorModulo;
  const sobrante = ladoArea - lado;
  const antes = Math.floor(sobrante / 2);
  return sharp(base)
    .resize(lado, lado, { kernel: 'nearest' })
    .extend({
      top: antes,
      left: antes,
      bottom: sobrante - antes,
      right: sobrante - antes,
      background: BLANCO,
    })
    .png()
    .toBuffer();
};

// Composes `contenido` (e.g. the qr_data of a Mercado Pago order) as a QR on
// the branded template. Resolves to a PNG Buffer or { error: { status, message } }.
export const componerQrEnPlantilla = async (contenido) => {
  if (typeof contenido !== 'string' || contenido.trim() === '') {
    return falla(400, 'El contenido del QR es obligatorio y tiene que ser texto.');
  }
  if (contenido.length > MAX_LARGO_CONTENIDO) {
    return falla(400, `El contenido del QR no puede superar los ${MAX_LARGO_CONTENIDO} caracteres.`);
  }

  const ladoArea = AREA_QR.size * ESCALA_SALIDA;
  let qr;
  try {
    qr = await generarQrEnArea(contenido, ladoArea);
  } catch {
    return falla(422, 'No se pudo generar un código QR con ese contenido.');
  }
  if (!qr) return falla(422, 'El contenido es demasiado largo para entrar en el código QR.');

  const plantilla = await cargarPlantilla();
  return sharp(plantilla)
    .composite([{
      input: qr,
      left: AREA_QR.left * ESCALA_SALIDA,
      top: AREA_QR.top * ESCALA_SALIDA,
    }])
    .png()
    .toBuffer();
};
