import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RegistryApp from './components/RegistryApp'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistryApp />
  </StrictMode>,
)
