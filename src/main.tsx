import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { startMonitoring } from './lib/track';

startMonitoring();
createRoot(document.getElementById('root')!).render(<App />);
