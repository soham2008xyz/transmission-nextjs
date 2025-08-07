import { useCallback, useState } from "react";

export type ToastOptions = {
  id?: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

let toastListeners: ((toast: ToastOptions) => void)[] = [];

export function toast(options: ToastOptions) {
  toastListeners.forEach((listener) => listener(options));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const addToast = useCallback((toast: ToastOptions) => {
    setToasts((prev) => [
      ...prev,
      { ...toast, id: toast.id || Math.random().toString(36).slice(2) }
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
  }, []);

  // Register listener
  if (!toastListeners.includes(addToast)) {
    toastListeners.push(addToast);
  }

  return { toasts };
}
