import { LayoutDashboard, Menu, ShieldCheck, ShoppingBag, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { Badge } from './Badge'
import { Button } from './Button'
import { Drawer } from './Drawer'

export function Header() {
  const { items } = useCart()
  const { scope, logout } = useAuth()
  const isCustomer = scope === 'customer'
  const isAdmin = scope === 'admin'
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'relative text-sm font-medium text-[#6b665f] after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[#d89a28] after:transition-transform hover:text-[#171412] hover:after:scale-x-100',
      isActive ? 'text-[#171412] after:scale-x-100' : '',
    ]
      .filter(Boolean)
      .join(' ')

  const customerLinks = (
    <>
      <NavLink to="/" className={linkClassName} onClick={() => setOpen(false)}>
        Inicio
      </NavLink>
      <NavLink to="/catalogo" className={linkClassName} onClick={() => setOpen(false)}>
        Catalogo
      </NavLink>
    </>
  )

  const adminLinks = (
    <>
      <NavLink to="/admin" className={linkClassName} onClick={() => setOpen(false)} end>
        Dashboard
      </NavLink>
      <span className="hidden text-stone-300 md:inline">|</span>
      <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-[#b77717] md:inline">Painel administrativo</span>
    </>
  )

  return (
    <>
      <header
        className={[
          'sticky top-0 z-30 border-b transition duration-300',
          scrolled
            ? 'border-stone-200/80 bg-white/78 shadow-[0_18px_40px_-30px_rgba(10,26,51,0.35)] backdrop-blur-xl'
            : 'border-transparent bg-white/40 backdrop-blur-md',
        ].join(' ')}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.42em] text-[#b77717]">Loja Premium</span>
            <span className="block text-sm font-semibold tracking-[0.38em] text-[#171412] sm:text-base">
              ON PERFUMARIA
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {isAdmin ? adminLinks : customerLinks}
          </nav>

          {!isAdmin ? (
            <div className="hidden items-center gap-2 rounded-full border border-[#c3d2ea] bg-[#e7edf7] px-3.5 py-1.5 lg:flex">
              <ShieldCheck size={14} className="text-[#142d52]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#142d52]">
                Compra 100% segura
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin ? (
              <>
                <Link to="/admin" aria-label="Painel admin" className="hidden sm:inline-flex">
                  <Button variant="secondary" size="sm">
                    <LayoutDashboard size={16} />
                    <span>Painel</span>
                  </Button>
                </Link>
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="hidden text-xs font-medium text-[#6b665f] hover:text-[#171412] sm:inline"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                {isCustomer ? (
                  <Link to="/conta" aria-label="Minha conta" className="hidden sm:inline-flex">
                    <Button variant="secondary" size="sm">
                      <User size={16} />
                      <span>Minha conta</span>
                    </Button>
                  </Link>
                ) : (
                  <Link to="/login" aria-label="Entrar" className="hidden sm:inline-flex">
                    <Button variant="secondary" size="sm">
                      Entrar
                    </Button>
                  </Link>
                )}
                <Link to="/checkout" aria-label="Carrinho" className="relative inline-flex">
                  <Button variant="primary" size="sm" className="pr-11">
                    <ShoppingBag size={16} />
                    <span className="hidden sm:inline">Carrinho</span>
                  </Button>
                  <Badge tone={count > 0 ? 'amber' : 'neutral'} className="absolute -right-1 -top-2 px-2.5 py-1 tracking-normal">
                    {count}
                  </Badge>
                </Link>
              </>
            )}
            <button
              aria-label="Abrir menu"
              onClick={() => setOpen(true)}
              className="inline-flex rounded-full border border-stone-200 bg-white/80 p-2.5 text-stone-700 md:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <p className="eyebrow">{isAdmin ? 'Administracao' : 'Navegacao'}</p>
            <nav className="grid gap-4 text-base text-[#171412]">
              {isAdmin ? adminLinks : customerLinks}
            </nav>
          </div>
          <div className="surface-soft space-y-3 p-5">
            <p className="eyebrow">Atalhos</p>
            {isAdmin ? (
              <>
                <Link to="/admin" onClick={() => setOpen(false)}>
                  <Button variant="primary" fullWidth>
                    <LayoutDashboard size={16} />
                    Painel completo
                  </Button>
                </Link>
                <button
                  onClick={() => { logout(); setOpen(false); navigate('/') }}
                  className="w-full"
                >
                  <Button variant="secondary" fullWidth>
                    Sair do admin
                  </Button>
                </button>
              </>
            ) : (
              <>
                <Link to="/checkout" onClick={() => setOpen(false)}>
                  <Button variant="primary" fullWidth>
                    Ver carrinho
                  </Button>
                </Link>
                {isCustomer ? (
                  <Link to="/conta" onClick={() => setOpen(false)}>
                    <Button variant="secondary" fullWidth>
                      Minha conta
                    </Button>
                  </Link>
                ) : (
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <Button variant="secondary" fullWidth>
                      Entrar
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </Drawer>
    </>
  )
}
