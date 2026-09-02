import vision from '@google-cloud/vision';

// El cliente detecta automáticamente la variable GOOGLE_APPLICATION_CREDENTIALS
const client = new vision.ImageAnnotatorClient();

export const clasificarImagen = async (rutaOBufferImagen) => {
  // Realiza detección de etiquetas (Labels) y propiedades de la imagen
  const [result] = await client.labelDetection(rutaOBufferImagen);
  const labels = result.labelAnnotations;

  console.log('Etiquetas detectadas:');
  labels.forEach(label => console.log(`- ${label.description} (Confianza: ${(label.score * 100).toFixed(2)}%)`));

  return labels;
};