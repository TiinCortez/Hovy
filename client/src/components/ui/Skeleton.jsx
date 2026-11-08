// Bloque gris con brillo animado para armar los esqueletos de carga
export default function Skeleton({ width = '100%', height = '1rem', radius = '0.5rem', className = '', style }) {
  return (
    <span
      className={`hovy-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
