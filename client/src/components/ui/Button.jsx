export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size,
  icon = false,
  className = '',
  onClick,
  disabled = false,
  ...props
}) {
  const baseClass = `btn btn-${variant}${size ? ` btn-${size}` : ''}${icon ? ' btn-icon' : ''} ${className}`;

  return (
    <button
      type={type}
      className={baseClass}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
