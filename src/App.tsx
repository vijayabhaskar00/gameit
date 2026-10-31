import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui';
import { campaign } from './config/campaign';
import { DEMO_MODE } from './lib/api';
import { SessionProvider } from './lib/session';
import { Landing } from './pages/Landing';

// Phaser and the rest stay out of the landing bundle.
const Play = lazy(() => import('./pages/Play'));
const Legal = lazy(() => import('./pages/Legal'));
const Result = lazy(() => import('./pages/Result').then((m) => ({ default: m.Result })));
const Win = lazy(() => import('./pages/Win').then((m) => ({ default: m.Win })));

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        {DEMO_MODE && (
          <p className="bg-gold py-1 text-center text-xs font-semibold text-ink">
            {campaign.demoNotice}
          </p>
        )}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/play" element={<Play />} />
            <Route path="/result/:roundId" element={<Result />} />
            <Route path="/win" element={<Win />} />
            <Route path="/terms" element={<Legal page="terms" />} />
            <Route path="/privacy" element={<Legal page="privacy" />} />
          </Routes>
        </Suspense>
        <Toaster />
      </SessionProvider>
      <div className="rotate-overlay fixed inset-0 z-50 items-center justify-center bg-ink text-xl">
        {campaign.game.rotate}
      </div>
    </BrowserRouter>
  );
}
