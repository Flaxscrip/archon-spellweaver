// bip39 and cipher use Buffer as a global — polyfill before any @didcid import
import { Buffer } from 'buffer';
(globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { KeymasterProvider } from './contexts/KeymasterContext'
import RegistryApp from './components/RegistryApp'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeymasterProvider>
      <RegistryApp />
    </KeymasterProvider>
  </StrictMode>,
)
