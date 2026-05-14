/**
 * Lightweight toast notification system for admin dashboard.
 * Replaces browser alert() with non-blocking overlay notifications.
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#0f2918', border: '#22c55e', text: '#86efac', icon: '✓' },
  error: { bg: '#2d1215', border: '#ef4444', text: '#fca5a5', icon: '✕' },
  warning: { bg: '#2d2305', border: '#eab308', text: '#fde68a', icon: '⚠' },
  info: { bg: '#0c1a2e', border: '#3b82f6', text: '#93c5fd', icon: 'ℹ' },
};

let toastContainer: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.id = 'admin-toast-container';
  Object.assign(toastContainer.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
  });
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message: string, type: ToastType, options?: ToastOptions) {
  const container = ensureContainer();
  const colors = TOAST_COLORS[type];
  const duration = options?.duration ?? 4000;

  const el = document.createElement('div');
  Object.assign(el.style, {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '420px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    pointerEvents: 'auto',
    opacity: '0',
    transform: 'translateX(40px)',
    transition: 'opacity 0.3s, transform 0.3s',
  });

  const icon = document.createElement('span');
  icon.textContent = colors.icon;
  icon.style.fontWeight = 'bold';
  icon.style.fontSize = '16px';

  const text = document.createElement('span');
  text.textContent = message;
  text.style.flex = '1';

  el.appendChild(icon);
  el.appendChild(text);
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export const toast = {
  success: (message: string, options?: ToastOptions) => showToast(message, 'success', options),
  error: (message: string, options?: ToastOptions) => showToast(message, 'error', options),
  warning: (message: string, options?: ToastOptions) => showToast(message, 'warning', options),
  info: (message: string, options?: ToastOptions) => showToast(message, 'info', options),
};
