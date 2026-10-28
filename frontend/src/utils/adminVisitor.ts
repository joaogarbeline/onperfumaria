// Admin logado so ve o painel. Para navegar pela loja como um cliente ele
// entra no "modo visitante", que vale so para esta aba (sessionStorage) e
// sai pelo botao "Voltar ao admin".
const KEY = 'onp:admin-visitor'
export const VISITOR_PARAM = 'visitante'

export function isAdminVisitorMode() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setAdminVisitorMode(active: boolean) {
  try {
    if (active) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    // Sem armazenamento: o link com ?visitante=1 ainda funciona pagina a pagina.
  }
}

/** Link da loja que ja abre em modo visitante (inclusive numa aba nova). */
export function visitorUrl(path: string) {
  const url = new URL(path, window.location.origin)
  url.searchParams.set(VISITOR_PARAM, '1')
  return `${url.pathname}${url.search}`
}
