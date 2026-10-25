import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'gold' | 'red';
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Fill most of the screen height, e.g. for the notebook. */
  tall?: boolean;
  /** Extra classes for the scrolling body. */
  bodyClassName?: string;
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({ title, subtitle, icon, tone = 'gold', onClose, children, footer, wide, tall, bodyClassName = '' }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const red = tone === 'red';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`panel relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} ${
          tall ? 'h-[92dvh] sm:h-[88dvh]' : 'max-h-[92dvh]'
        } flex flex-col rounded-t-3xl sm:rounded-2xl border-2 ${red ? 'border-[var(--crimson-light)]' : 'border-[var(--gold)]'} animate-sheet-up sm:animate-fade-in`}
      >
        {/* Grab handle, so the sheet reads as one on a phone. */}
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--gold)]/40" aria-hidden="true" />
        <header className="flex items-center gap-3 px-4 sm:px-6 pt-3 sm:pt-4 pb-3">
          {icon && (
            <div
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 ${
                red ? 'bg-[var(--crimson)]/25 border-[var(--crimson-light)] text-red-200' : 'bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold-light)]'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-deco font-bold text-base sm:text-lg uppercase tracking-[0.12em] leading-tight text-gold-gradient">{title}</h2>
            {subtitle && <div className="text-sm text-[var(--muted)] font-serif-vintage italic mt-0.5 leading-snug">{subtitle}</div>}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-full text-[var(--muted)] hover:text-[var(--parchment)] hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>
        <div className="deco-rule mx-4 sm:mx-6" />
        <div className={`flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 ${bodyClassName}`}>{children}</div>
        {footer && (
          <footer className="px-4 sm:px-6 pt-3 border-t border-[var(--gold)]/25 flex flex-wrap gap-2 justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  id,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
  id?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary:
      'bg-[linear-gradient(180deg,#f6dd8a,#d4af37_55%,#a8822a)] text-[#1f120a] border border-[#fff2b2]/60 shadow-[0_4px_14px_rgba(212,175,55,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-110',
    secondary: 'bg-[var(--mahogany)] text-[var(--parchment)] border border-[var(--gold)]/45 hover:bg-[var(--mahogany-3)]',
    danger:
      'bg-[linear-gradient(180deg,#c8102e,#8a0c1a)] text-white border border-[var(--gold)]/50 shadow-[0_4px_14px_rgba(200,16,46,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110',
    ghost: 'text-[var(--muted)] hover:text-[var(--parchment)] hover:bg-white/5',
  };
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-4 py-2.5 rounded-xl font-deco font-bold text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** A small uppercase heading with gold rules either side. */
export function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`flex items-center gap-3 text-[11px] font-deco font-bold uppercase tracking-[0.22em] text-[var(--gold)] ${className}`}>
      <span className="deco-rule flex-1" />
      <span className="shrink-0">{children}</span>
      <span className="deco-rule flex-1" />
    </h2>
  );
}
