import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('art')) {
  // Development-only artwork gallery; removed from production builds.
  import('./dev/ArtPreview').then(({ default: ArtPreview }) => root.render(<ArtPreview />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
