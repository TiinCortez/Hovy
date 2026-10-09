import { X } from 'lucide-react';
import Button from './Button';

export default function CloseButton({ onClick, disabled = false, label = 'Cerrar', className = '' }) {
  return (
    <Button variant="light" icon className={`hovy-close-button ${className}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <X size={20} aria-hidden="true" />
    </Button>
  );
}
