import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css'  <-- REMOVED THIS LINE TO PREVENT STYLE CONFLICTS
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)