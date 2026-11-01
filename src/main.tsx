import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { keepAudioUnlocked } from './lib/audio';
import { startMonitoring } from './lib/track';

startMonitoring();
keepAudioUnlocked();
createRoot(document.getElementById('root')!).render(<App />);
