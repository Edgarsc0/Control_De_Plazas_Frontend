'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

function buildToast(options) {
  const {
    variant = 'default',
    duration = 5000,
    viewportId = 'default',
    layout = 'toast', // 'toast' (flotante, usa `position`) | 'banner' (línea horizontal, usa `bannerPosition`)
    bannerPosition = 'top', // 'top' (debajo del Navbar) | 'bottom'
    ...rest
  } = options;
  return {
    id: ++toastIdCounter,
    variant,
    duration,
    viewportId,
    layout,
    bannerPosition,
    open: true,
    ...rest,
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options) => {
    const next = buildToast(options);
    setToasts((current) => [...current, next]);
    return next.id;
  }, []);

  toast.success = useCallback((title, options = {}) => toast({ title, variant: 'success', ...options }), [toast]);
  toast.error = useCallback((title, options = {}) => toast({ title, variant: 'error', ...options }), [toast]);
  toast.warning = useCallback((title, options = {}) => toast({ title, variant: 'warning', ...options }), [toast]);
  toast.info = useCallback((title, options = {}) => toast({ title, variant: 'info', ...options }), [toast]);

  const value = useMemo(
    () => ({ toasts, toast, dismiss, remove }),
    [toasts, toast, dismiss, remove]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return ctx;
}
