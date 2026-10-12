import { componerQrEnPlantilla } from './qrPlantillaService.js';
import { responderErrorServicio } from '../../utils/solicitudesVisita.js';

// POST /api/qr/previsualizar - body { contenido } -> image/png
export const previsualizarQr = async (req, res) => {
  try {
    const resultado = await componerQrEnPlantilla(req.body?.contenido);
    if (resultado.error) return responderErrorServicio(res, resultado.error);

    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    return res.status(200).send(resultado);
  } catch (error) {
    console.error('Error generando la imagen QR:', error.message);
    return res.status(500).json({ ok: false, error: 'No se pudo generar la imagen del QR.' });
  }
};
