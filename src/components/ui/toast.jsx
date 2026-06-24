'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toast as ToastPrimitive } from 'radix-ui';
import { cva } from 'class-variance-authority';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';

function ToastViewport({ className, position = 'bottom-right', ...props }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const positions = {
    'top-right': 'top-[152px] right-2 sm:top-44 sm:right-4 flex-col',
    'top-left': 'top-[152px] left-2 sm:top-44 sm:left-4 flex-col',
    'bottom-right': 'bottom-0 right-0 sm:bottom-4 sm:right-4 flex-col-reverse',
    'bottom-left': 'bottom-0 left-0 sm:bottom-4 sm:left-4 flex-col-reverse',
  };

  if (!mounted) return null;

  // Portal directo a document.body: Banner es fixed+z-50 y crea su propio
  // stacking context, así que un z-index alto dentro de <main> no basta.
  return createPortal(
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed z-[300] m-0 flex w-full max-w-[420px] list-none flex-col gap-2.5 p-4 outline-none sm:w-[380px]',
        positions[position] ?? positions['bottom-right'],
        className
      )}
      {...props}
    />,
    document.body
  );
}

const toastVariants = cva(
  'group/toast relative grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 overflow-hidden rounded-xl border p-3.5 pl-4 shadow-md transition-all before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""] data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[state=open]:animate-in data-[state=open]:slide-in-from-top-4 data-[state=open]:fade-in-0 data-[state=open]:duration-250 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-1/2 data-[state=closed]:fade-out-0 data-[state=closed]:duration-200 data-[swipe=end]:animate-out',
  {
    variants: {
      variant: {
        default: 'bg-white border-slate-200 text-slate-700 before:bg-[#621f32] dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
        success: 'bg-white border-slate-200 text-slate-700 before:bg-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
        error: 'bg-white border-slate-200 text-slate-700 before:bg-destructive dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
        warning: 'bg-white border-slate-200 text-slate-700 before:bg-amber-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
        info: 'bg-white border-slate-200 text-slate-700 before:bg-sky-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const iconWrapperVariants = cva('flex size-7 shrink-0 items-center justify-center rounded-full', {
  variants: {
    variant: {
      default: 'bg-[#621f32]/10 text-[#621f32] dark:bg-[#bc955c]/15 dark:text-[#bc955c]',
      success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400',
      error: 'bg-destructive/10 text-destructive',
      warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400',
      info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-400',
    },
  },
  defaultVariants: { variant: 'default' },
});

const defaultIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastRoot({ className, variant = 'default', icon, title, description, duration, onOpenChange, action, ...props }) {
  const Icon = icon ?? defaultIcons[variant];

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-variant={variant}
      duration={duration}
      onOpenChange={onOpenChange}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {Icon ? (
        <span className={iconWrapperVariants({ variant })}>
          <Icon className="size-4" />
        </span>
      ) : (
        <span />
      )}

      <div className="flex flex-col gap-0.5">
        {title && (
          <ToastPrimitive.Title
            data-slot="toast-title"
            className={cn(
              'text-sm font-semibold leading-snug',
              variant === 'default' && 'text-[#621f32] dark:text-[#bc955c]'
            )}
          >
            {title}
          </ToastPrimitive.Title>
        )}
        {description && (
          <ToastPrimitive.Description data-slot="toast-description" className="text-xs leading-relaxed opacity-80">
            {description}
          </ToastPrimitive.Description>
        )}
        {action}
      </div>

      <ToastPrimitive.Close
        data-slot="toast-close"
        className="rounded-full p-1 opacity-50 transition-opacity hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="size-3.5" />
        <span className="sr-only">Cerrar</span>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export { ToastViewport, ToastRoot };
