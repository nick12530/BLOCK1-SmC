import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Remove service workers left behind by older installations.
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.error('Could not remove old service worker registrations:', error));
}
