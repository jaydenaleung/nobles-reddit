import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------- Loading, empty and error states. Every list has all three. ---------- */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <p>{label}…</p>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function ErrorState({
  title = 'That did not load',
  onRetry,
  children,
}: {
  title?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="state state--error" role="alert">
      <h2>{title}</h2>
      <p>{children ?? 'Check your connection and try again.'}</p>
      {onRetry && (
        <button className="nb-btn" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ---------- A small message at the bottom of the screen ---------- */

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {message && <div className="toast">{message}</div>}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ---------- A modal dialog built on <dialog>: focus is trapped and Escape closes it ---------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dlg nb"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dlg__body">
          <h2>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** A character counter that turns into a warning when over the limit. */
export function Count({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span className={`count${over ? ' count--over' : ''}`} aria-live={over ? 'polite' : undefined}>
      {over ? `${value - max} over the limit` : `${value} / ${max}`}
    </span>
  );
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
