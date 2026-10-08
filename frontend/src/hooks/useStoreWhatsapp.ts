import { useEffect, useState } from 'react'
import { api } from '../services/api'

// Numero fixo usado antes de existir configuracao: garante que o botao de
// atendimento continua funcionando enquanto o admin nao preenche o campo
// em Configuracoes > API.
const FALLBACK_WHATSAPP = '5567991194532'

let whatsappPromise: Promise<string> | null = null

function fetchStoreWhatsapp(): Promise<string> {
  if (!whatsappPromise) {
    whatsappPromise = api
      .get<{ storeWhatsapp?: string }>('/store/config')
      .then((config) => config.storeWhatsapp || FALLBACK_WHATSAPP)
      .catch(() => FALLBACK_WHATSAPP)
  }
  return whatsappPromise
}

/** Numero de WhatsApp da loja configurado no admin, para os links de atendimento. */
export function useStoreWhatsapp(): string {
  const [whatsapp, setWhatsapp] = useState(FALLBACK_WHATSAPP)

  useEffect(() => {
    let cancelled = false
    fetchStoreWhatsapp().then((value) => {
      if (!cancelled) setWhatsapp(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return whatsapp
}
