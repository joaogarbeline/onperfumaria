import { Search, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import atendimentoIcon from '../../../assets/icons/atendente_d_c.png'
import favoritoIcon from '../../../assets/icons/coracoes_d_c.png'
import sacolaIcon from '../../../assets/icons/sacola_d_c.png'
import { useAuth } from '../../../contexts/AuthContext'
import { useCart } from '../../../contexts/CartContext'
import { useOrganizerStore } from '../../../hooks/useOrganizerStore'
import {
  isOrganizerNodeAvailable,
  isOrganizerPreviewMode,
  withOrganizerPreview,
} from '../../../types/organizer'
import { Button } from '../../../components/Button'
import { Carousel } from '../../../components/Carousel'

export function DesktopHeader() {
  const { items } = useCart()
  const { scope, openAuth, requireAuth } = useAuth()
  const { store } = useOrganizerStore()
  const isCustomer = scope === 'customer'
  const [scrolled, setScrolled] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const navigate = useNavigate()
  const location = useLocation()
  const previewMode = isOrganizerPreviewMode(location.search)
  const homePath = withOrganizerPreview('/', previewMode)
  const currentPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm('')
    navigate(homePath)
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'relative text-sm font-medium after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[#d89a28] after:transition-transform hover:after:scale-x-100',
      `text-[#FAF6EF]/70 hover:text-[#FAF6EF] ${isActive ? 'text-[#FAF6EF] after:scale-x-100' : ''}`,
    ].join(' ')

  const customerLinks = store.nodes
    .filter((node) => {
      if (node.type !== 'page' || !node.route || !isOrganizerNodeAvailable(node, previewMode)) return false
      const nodePath = node.route.length > 1 ? node.route.replace(/\/+$/, '') : '/'
      return nodePath !== currentPath
    })
    .map((node) => ({
      id: node.id,
      label: node.id === 'home' ? 'Início' : node.name,
      path: withOrganizerPreview(node.route as string, previewMode),
    }))

  return (
    <header
      className={[
        'sticky top-0 z-30 overflow-hidden border-b bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)] transition duration-300',
        scrolled
          ? 'border-[#5b247f]/40 shadow-[0_18px_40px_-30px_rgba(58,22,79,0.45)]'
          : 'border-[#3a164f]/40',
      ].join(' ')}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 130 100"
        className="pointer-events-none absolute -right-4 -top-6 z-0 h-[160px] w-[208px] opacity-10"
      >
        <path
          d="M55 10 h20 v14 l10 10 v56 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-56 l10 -10 z"
          fill="none"
          stroke="#d89a28"
          strokeWidth={2.5}
        />
      </svg>

      <div className="relative z-10 px-6 py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,38vw)_minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)_minmax(0,1fr)] xl:gap-6">
          <Link
            to={homePath}
            className="flex flex-col justify-center space-y-1.5 self-center justify-self-start rounded-[20px] lg:px-1 xl:px-5"
          >
            <span className="block whitespace-nowrap text-base font-semibold tracking-[0.28em] text-[#FAF6EF] lg:text-lg lg:tracking-[0.38em]">
              <span className="text-[#d89a28]">ON</span> PERFUMARIA
            </span>
          </Link>

          <div className="flex min-w-0 w-full flex-col gap-2">
            <form
              onSubmit={handleSearchSubmit}
              className="flex w-full items-center gap-2 rounded-[20px] bg-[#FAF6EF] py-1.5 pl-4 pr-1.5"
            >
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar perfumes, marcas..."
                className="w-full bg-transparent text-sm text-[#2a0f3d] outline-none placeholder:text-[#6b665f]"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[20px] bg-[#FAF6EF] text-[#2a0f3d] ring-1 ring-inset ring-[#2a0f3d]/10 transition hover:bg-white"
              >
                <Search size={16} />
              </button>
            </form>

            <div
              className={[
                'flex items-center justify-center overflow-hidden rounded-[20px] transition-all duration-300 ease-in-out',
                scrolled ? 'max-h-0 py-0 opacity-0' : 'max-h-16 py-2 opacity-100',
              ].join(' ')}
            >
              <nav aria-label="Páginas do site" className="w-full overflow-hidden">
                <Carousel
                  ariaLabel="Páginas do site"
                  items={customerLinks}
                  getItemKey={(item) => item.id}
                  fullBleed={false}
                  itemClassName="min-w-[88px] shrink-0 text-center"
                  className="gap-6 px-1 whitespace-nowrap"
                  renderItem={(item) => (
                    <NavLink to={item.path} className={navLinkClassName}>
                      {item.label}
                    </NavLink>
                  )}
                />
              </nav>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-self-end gap-1 lg:gap-2 xl:gap-3">
            <div className="flex items-center rounded-[20px] lg:px-1 xl:px-4">
              {isCustomer ? (
                <Link to="/conta" aria-label="Minha conta" className="inline-flex">
                  <Button variant="secondary" size="sm">
                    <User size={16} />
                    <span>Minha conta</span>
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Entrar"
                  onClick={() => openAuth({ reason: 'Entre ou cadastre-se para acompanhar seus pedidos.' })}
                >
                  Entrar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-[20px] lg:gap-2 lg:px-1 xl:gap-3 xl:px-3">
              <a
                href="https://wa.me/5567999999999"
                target="_blank"
                rel="noreferrer"
                aria-label="Atendimento via WhatsApp"
                className="group relative flex shrink-0 items-center"
              >
                <img
                  src={atendimentoIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Atendimento
                </span>
              </a>
              <button
                type="button"
                aria-label="Favoritos"
                onClick={() =>
                  requireAuth(() => navigate('/conta'), 'Entre ou cadastre-se para salvar seus favoritos.')
                }
                className="group relative inline-flex shrink-0 items-center"
              >
                <img
                  src={favoritoIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 object-contain lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Favoritos
                </span>
              </button>
              <Link
                to="/checkout"
                aria-label="Carrinho"
                className="group relative inline-flex shrink-0 items-center"
              >
                <img
                  src={sacolaIcon}
                  alt=""
                  className="h-9 w-9 shrink-0 lg:h-11 lg:w-11 xl:h-[50px] xl:w-[50px]"
                />
                <span className="pointer-events-none absolute -right-1 -top-1 text-xs font-bold text-white">
                  {count}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#2a0f3d] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                  Carrinho
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
