import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const RUTA_PLANTILLA = path.resolve(dirname, '../../assets/plantilla_qr_hovy.png');

// Template size the measurements below were taken on. It is asserted at load
// time, so replacing the PNG with a different size fails loudly instead of
// pasting the QR in the wrong place.
export const PLANTILLA_ANCHO = 445;
export const PLANTILLA_ALTO = 673;

// Position of the QR area, in template pixels. Measured with a throwaway
// sharp raw-pixel script: the white rounded square (inside the four dark-green
// corner brackets) is pure white (255,255,255) from x=110..332 and y=258..495
// (223x238 px, centre = 221, 376.5). The QR area is a square centered on it
// and sized to hide the faint center icon (y 346-390) and the small green pill
// near the bottom (y 471-479) while staying clear of the rounded border/shadow.
// To adapt to a new template, edit only this object (and the size above).
export const AREA_QR = { left: 116, top: 272, size: 210 };

// The template is only 445px wide: the output is upscaled by this integer
// factor (lanczos) so a dense, realistic payload still gets >= 3px modules.
// The QR itself is never resampled smoothly (nearest-neighbour only).
export const ESCALA_SALIDA = 2;

// Quiet zone in modules (QR spec recommends 4). The area is white, so the
// real clear space is even larger.
export const MARGEN_MODULOS = 4;

// M recovers ~15% of damage: good balance between density and robustness.
export const NIVEL_CORRECCION = 'M';

export const MAX_LARGO_CONTENIDO = 1024;
