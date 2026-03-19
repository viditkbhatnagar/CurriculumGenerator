'use client';

import { useToastStore, Toast, ToastType } from '@/stores/toastStore';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const toastConfig: Record<
  ToastType,
  { icon: typeof CheckCircle; bg: string; border: string; text: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success-muted',
    border: 'border-success/20',
    text: 'text-success',
    iconColor: 'text-success',
  },
  error: {
    icon: XCircle,
    bg: 'bg-error-muted',
    border: 'border-error/20',
    text: 'text-error',
    iconColor: 'text-error',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning-muted',
    border: 'border-warning/20',
    text: 'text-warning',
    iconColor: 'text-warning',
  },
  info: {
    icon: Info,
    bg: 'bg-info-muted',
    border: 'border-info/20',
    text: 'text-info',
    iconColor: 'text-info',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        'transform transition-all duration-300 ease-out',
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-4 opacity-0 scale-95'
      )}
    >
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border shadow-elevated',
          'min-w-[340px] max-w-[420px]',
          'bg-card backdrop-blur-xl',
          config.border
        )}
      >
        <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">{toast.message}</p>
          )}
        </div>
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
