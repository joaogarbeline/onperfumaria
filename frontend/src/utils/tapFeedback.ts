// Retorno visual de toque para o site inteiro, sem precisar mexer em cada
// botao: um unico listener no documento faz
// - o "pulinho" do icone (classe .icon-pop) em qualquer botao ou link pequeno
//   que tenha um img/svg dentro;
// - a onda (.tap-ripple) a partir do ponto tocado nos botoes do Button.tsx
//   (classe .btn-fx).
// As animacoes vivem no index.css e respeitam o prefers-reduced-motion.

const MAX_ICON_SIZE = 72

function replayClass(element: Element, className: string) {
  element.classList.remove(className)
  // Forca o navegador a "esquecer" a animacao anterior para ela rodar de novo.
  void (element as HTMLElement).offsetWidth
  element.classList.add(className)
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true })
}

function spawnRipple(target: HTMLElement, event: PointerEvent) {
  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2
  const ripple = document.createElement('span')
  ripple.className = 'tap-ripple'
  ripple.style.width = `${size}px`
  ripple.style.height = `${size}px`
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`
  target.appendChild(ripple)
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
}

export function installTapFeedback() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>('button, a')
      if (!control || (control instanceof HTMLButtonElement && control.disabled)) return

      if (control.classList.contains('btn-fx')) spawnRipple(control, event)

      const icon = control.querySelector('img, svg')
      if (!icon) return
      const { width, height } = icon.getBoundingClientRect()
      // Fotos de produto e banners tambem sao <img> dentro de link: so os
      // icones pequenos ganham o pulinho.
      if (width > MAX_ICON_SIZE || height > MAX_ICON_SIZE) return
      replayClass(icon, 'icon-pop')
    },
    { passive: true },
  )
}
