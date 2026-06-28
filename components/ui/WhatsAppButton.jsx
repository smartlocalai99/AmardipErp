export function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.02 3.2A12.67 12.67 0 0 0 5.1 22.32L3.2 29l6.86-1.8A12.65 12.65 0 1 0 16.02 3.2Zm0 22.98c-2.02 0-3.9-.58-5.5-1.6l-.4-.25-4.07 1.07 1.08-3.96-.26-.41a10.24 10.24 0 1 1 9.15 5.15Zm5.62-7.67c-.3-.15-1.8-.9-2.08-1-.28-.1-.48-.15-.68.15-.2.3-.78 1-.96 1.2-.18.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.48-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.24-.58-.5-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.23 5.13 4.53.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.58-.08 1.8-.73 2.05-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z" />
    </svg>
  );
}

export default function WhatsAppButton({ children = "WhatsApp", className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2 text-xs font-black text-white shadow-sm transition active:scale-95 hover:bg-[#1fb855] ${className}`}
      {...props}
    >
      <WhatsAppIcon />
      {children}
    </button>
  );
}
