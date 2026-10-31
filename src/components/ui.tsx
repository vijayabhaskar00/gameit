import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaign } from '../config/campaign';
import { useAsset } from '../lib/assets';

export const pillWhite =
  'flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-ink disabled:bg-neutral-600 disabled:text-neutral-200';
export const pillOutline =
  'flex min-h-12 items-center justify-center rounded-full border border-white/70 px-6 font-semibold text-white';

/** Native dialog, so focus trap, Escape and backdrop come for free. */
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      className="sheet fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{props.title}</h2>
        <button
          aria-label={campaign.landing.close}
          className="flex size-11 items-center justify-center text-2xl"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      {props.children}
    </dialog>
  );
}

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: number;
    const show = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 2000);
    };
    window.addEventListener('toast', show);
    return () => window.removeEventListener('toast', show);
  }, []);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit rounded-full bg-white px-5 py-2 font-medium text-ink"
    >
      {message}
    </div>
  );
}

export function BackHeader({ title, trailing }: { title?: string; trailing?: ReactNode }) {
  const navigate = useNavigate();
  const goBack = () => {
    const bridge = (window as { HostBridge?: { back?: () => void } }).HostBridge;
    if (bridge?.back) bridge.back();
    else if (history.length > 1) history.back();
    else navigate('/');
  };
  return (
    <header className="relative z-10 flex min-h-14 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
      <button
        aria-label={campaign.landing.back}
        onClick={goBack}
        className="flex size-11 items-center justify-center text-2xl"
      >
        ←
      </button>
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      {trailing}
    </header>
  );
}

export function BowEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" fill="none">
      <path d="M30 14c52 8 76 32 76 76" stroke="#FFC83D" strokeWidth="6" strokeLinecap="round" />
      <path d="M30 14l76 76" stroke="#fff" strokeWidth="2" />
      <path d="M12 108L84 36" stroke="#FFD9A0" strokeWidth="4" strokeLinecap="round" />
      <path d="M92 28l-16 4 12 12z" fill="#FF7A1A" />
    </svg>
  );
}

export function HeroBow() {
  const art = useAsset('hero_bow');
  if (art) return <img src={art} alt="" width={240} height={240} className="size-56" />;
  return (
    <div className="hero-glow flex size-56 items-center justify-center">
      <BowEmblem className="size-40" />
    </div>
  );
}

export function ArcherSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 300" className={className} aria-hidden="true" fill="#000">
      <circle cx="96" cy="48" r="24" />
      <path d="M72 80h48l10 110H62z" />
      <path d="M66 190h30l-8 106H60zM102 190h30l8 106h-28z" />
      <path d="M118 86l62-6v14l-58 14zM76 88L20 112l6 12 58-18z" />
      <path d="M176 10c26 50 26 110 0 160" stroke="#000" strokeWidth="6" fill="none" />
    </svg>
  );
}
