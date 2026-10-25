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
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({ title, subtitle, icon, tone = 'gold', onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const border = tone === 'red' ? 'border-[#9b111e]' : 'border-[#d4af37]';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#251610] border-2 ${border} shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc]`}
      >
        <header className="flex items-center gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-[#d4af37]/25">
          {icon && (
            <div
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border ${
                tone === 'red' ? 'bg-[#9b111e]/20 border-[#9b111e] text-red-300' : 'bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37]'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-deco font-bold text-base sm:text-lg uppercase tracking-wider leading-tight">{title}</h2>
            {subtitle && <div className="text-xs text-[#baa479] font-serif-vintage italic mt-0.5">{subtitle}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#baa479] hover:text-[#f4e4bc] hover:bg-[#3d2013]" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">{children}</div>
        {footer && (
          <footer className="px-4 sm:px-6 py-3 border-t border-[#d4af37]/25 flex flex-wrap gap-2 justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const styles = {
    primary: 'bg-[#d4af37] hover:bg-[#e6c24d] text-[#1a0f0d] shadow-lg shadow-[#d4af37]/20',
    secondary: 'bg-[#1a0f0d] hover:bg-[#3d2013] text-[#f4e4bc] border border-[#d4af37]/40',
    danger: 'bg-[#9b111e] hover:bg-[#b81424] text-white border border-[#d4af37]/40',
  };
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-4 py-2.5 rounded-lg font-deco font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
