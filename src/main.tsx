import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Optional startup logging for runtime detection. Enable with VITE_ENABLE_RUNTIME_LOGS=true
const enableRuntimeLogs = (import.meta.env.VITE_ENABLE_RUNTIME_LOGS === 'true') || !!import.meta.env.DEV;
if (enableRuntimeLogs) {
  console.info('FinFlow startup:', { mode: import.meta.env.MODE, runtimeLogs: true });
}
