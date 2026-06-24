'use client';

import { Toast as ToastPrimitive } from 'radix-ui';

import { useToast } from '@/hooks/useToast';
import { ToastViewport, ToastRoot } from '@/components/ui/toast';

/**
 * Renderiza los toasts disparados con useToast() en el punto del árbol donde se monte.
 * Cada componente decide dónde llamar <Toaster /> y con qué `position` / `viewportId`.
 */
export default function Toaster({ position = 'bottom-right', viewportId = 'default', className }) {
  const { toasts, dismiss, remove } = useToast();
  const visible = toasts.filter((t) => t.viewportId === viewportId);

  const handleOpenChange = (id) => (open) => {
    if (!open) {
      dismiss(id);
      setTimeout(() => remove(id), 200);
    }
  };

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {visible.map(({ id, open, duration, viewportId: _viewportId, layout: _layout, bannerPosition: _bannerPosition, ...toastProps }) => (
        <ToastRoot key={id} open={open} duration={duration} onOpenChange={handleOpenChange(id)} {...toastProps} />
      ))}
      <ToastViewport position={position} className={className} />
    </ToastPrimitive.Provider>
  );
}
