import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './contexts/toast/ToastProvider'
import { PetOptionsProvider } from './pets/PetOptionsProvider'
import { SocketProvider } from './socket/SocketProvider'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <PetOptionsProvider>
            <App />
          </PetOptionsProvider>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
)
