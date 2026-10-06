import { useEffect, useState } from 'react'
import { api } from '../../services/api'

// O client id vem da config publica da loja, nao do bundle: trocar a
// credencial e questao de reiniciar o backend, sem rebuild do frontend.
let clientIdPromise: Promise<string> | null = null

function fetchGoogleClientId(): Promise<string> {
  if (!clientIdPromise) {
    clientIdPromise = api
      .get<{ googleClientId?: string }>('/store/config')
      .then((config) => config.googleClientId ?? '')
      .catch(() => '')
  }
  return clientIdPromise
}

/**
 * Client id do Google configurado na loja.
 * `null` enquanto carrega, `''` quando a loja ainda nao configurou.
 * Com `''` a loja esconde o login social inteiro em vez de mostrar um botao
 * morto para o cliente.
 */
export function useGoogleClientId(): string | null {
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchGoogleClientId().then((value) => {
      if (!cancelled) setClientId(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return clientId
}
