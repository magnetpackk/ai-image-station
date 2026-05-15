import { useToastStore } from '../hooks/useToast';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  const bgMap = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };
  const iconMap = { success: '✅', error: '❌', info: 'ℹ️' };

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${bgMap[toast.type]}`}
          onClick={() => removeToast(toast.id)}
        >
          <span>{iconMap[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
