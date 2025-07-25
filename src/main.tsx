import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('=== DEBUG: Main.tsx is loading ===');
console.log('Supabase URL check:', 'https://bgppdlqgiuvrdydrvbko.supabase.co');
console.log('Environment check:', typeof window !== 'undefined' ? 'browser' : 'server');

const rootElement = document.getElementById("root");
console.log('Root element found:', !!rootElement);

if (rootElement) {
  console.log('=== DEBUG: Creating React root ===');
  createRoot(rootElement).render(<App />);
} else {
  console.error('CRITICAL: Root element not found!');
}
