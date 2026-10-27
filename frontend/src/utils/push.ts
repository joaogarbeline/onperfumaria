import { api } from '../services/api'

// Notificacao de venda no celular do admin (Web Push). O fluxo:
// 1. o service worker (public/sw.js) e registrado no carregamento do site;
// 2. no painel de pedidos o admin toca em "Ativar notificacoes": o navegador
//    pede permissao e devolve uma inscricao, que vai para o servidor;
// 3. a cada venda paga o servidor manda o aviso para todas as inscricoes.

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

export function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad com iPadOS se apresenta como Mac, mas tem tela de toque.
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

export function isInstalledApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) {
    // No iPhone/iPad o Safari so libera notificacao para o app instalado.
    return isIOS() && !isInstalledApp() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const subscription = await currentSubscription()
  return subscription ? 'on' : 'off'
}

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export async function enablePush(token: string): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const { publicKey } = await api.get<{ publicKey: string }>('/admin/push/key', token)
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }))
  await api.post('/admin/push/subscribe', subscription.toJSON(), token)
  return 'on'
}

export async function disablePush(token: string): Promise<PushState> {
  const subscription = await currentSubscription()
  if (subscription) {
    await api
      .post('/admin/push/unsubscribe', { endpoint: subscription.endpoint }, token)
      .catch(() => undefined)
    await subscription.unsubscribe()
  }
  return 'off'
}

export function sendTestPush(token: string) {
  return api.post<{ sent: number }>('/admin/push/test', {}, token)
}
