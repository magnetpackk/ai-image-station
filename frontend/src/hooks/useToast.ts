import { create } from 'zustand';
import type { Toast, ToastType } from '../types';
import { generateUUID } from '../lib/crypto';

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const toast: Toast = { id: generateUUID(), message, type };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    // Auto-remove after 3.5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== toast.id) }));
    }, 3500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function showToast(message: string, type?: ToastType) {
  useToastStore.getState().addToast(message, type);
}
