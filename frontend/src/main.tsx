import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { API_URL } from './services/api'
import { ORGANIZER_READY_EVENT } from './hooks/useOrganizerStore'

// Mantem a rodinha da aba girando ate o Organizador (itens, precos) chegar.
// O navegador so encerra o carregamento quando as imagens da pagina terminam,
// e um fetch comum nao conta: por isso uma "imagem" de GET /api/page-hold, que
// o servidor deixa pendente, e trocada por um pixel assim que os dados chegam.
const pageLoadHold = new Image()
pageLoadHold.src = `${API_URL}/page-hold`
window.addEventListener(
  ORGANIZER_READY_EVENT,
  () => {
    pageLoadHold.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
  },
  { once: true },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
