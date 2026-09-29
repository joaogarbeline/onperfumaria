import { Search, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import atendimentoIcon from '../../assets/icons/atendimento_white.png'
import sacolaIcon from '../../assets/icons/sacola_white.png'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useOrganizerStore } from '../../hooks/useOrganizerStore'
import { isOrganizerNodeVisible } from '../../types/organizer'
import { Button } from '../Button'
import { Carousel } from '../Carousel'

export function DesktopHeader() {
  const { items } = useCart()
  const { scope } = useAuth()
  const { store } = useOrganizerStore()
  const isCustomer = scope === 'customer'
  const [scrolled, setScrolled] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm('')
    navigate('/')
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'relative text-sm font-medium after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[#d89a28] after:transition-transform hover:after:scale-x-100',
      `text-[#FAF6EF]/70 hover:text-[#FAF6EF] ${isActive ? 'text-[#FAF6EF] after:scale-x-100' : ''}`,
    ].join(' ')

  const customerLinks = store.nodes
    .filter((node) => node.type === 'page' && node.route && isOrganizerNodeVisible(node))
    .map((node) => ({
      id: node.id,
      label: node.id === 'home' ? 'Início' : node.name,
      path: node.route as string,
    }))

  return (
    <header
      className={[
        'sticky top-0 z-30 overflow-hidden border-b bg-[#142d52] transition duration-300',
        scrolled ? 'border-[#2a4d82] shadow-[0_18px_40px_-30px_rgba(10,26,51,0.55)]' : 'border-[#0a1a33]/40',
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

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-stretch gap-8">
          <Link to="/" className="flex shrink-0 flex-col justify-center space-y-1.5 rounded-[20px] px-5">
            <span className="block text-xs font-bold uppercase tracking-[0.42em] text-[#d89a28]">
              Loja Premium
            </span>
            <span className="block text-lg font-semibold tracking-[0.38em] text-[#FAF6EF]">
              ON PERFUMARIA
            </span>
          </Link>

          <div className="flex flex-1 flex-col gap-2">
            <div className="ml-auto flex w-fit items-start gap-3">
              <div className="flex flex-col gap-2">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center gap-2 rounded-[20px] bg-[#FAF6EF] py-1.5 pl-4 pr-1.5 lg:w-[350px] xl:w-[480px]"
                >
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar perfumes, marcas..."
                    className="w-full bg-transparent text-sm text-[#171412] outline-none placeholder:text-[#6b665f]"
                  />
                  <button
                    type="submit"
                    aria-label="Buscar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[20px] bg-[#FAF6EF] text-[#171412] ring-1 ring-inset ring-[#171412]/10 transition hover:bg-white"
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

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-[20px] px-4">
                  {isCustomer ? (
                    <Link to="/conta" aria-label="Minha conta" className="inline-flex">
                      <Button variant="secondary" size="sm">
                        <User size={16} />
                        <span>Minha conta</span>
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/login" aria-label="Entrar" className="inline-flex">
                      <Button variant="secondary" size="sm">
                        Entrar
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-[20px] px-3">
                  <>
                    <a
                      href="https://wa.me/5567999999999"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Atendimento via WhatsApp"
                      className="group relative flex shrink-0 items-center"
                    >
                      <img src={atendimentoIcon} alt="" className="h-[50px] w-[50px] shrink-0" />
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#171412] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                        Atendimento
                      </span>
                    </a>
                    <Link
                      to="/checkout"
                      aria-label="Carrinho"
                      className="group relative inline-flex shrink-0 items-center"
                    >
                      <img src={sacolaIcon} alt="" className="h-[50px] w-[50px] shrink-0" />
                      <span className="pointer-events-none absolute -right-1 -top-1 text-xs font-bold text-white">
                        {count}
                      </span>
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#171412] px-2.5 py-1.5 text-xs font-medium text-[#fafaf8] opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
                        Carrinho
                      </span>
                    </Link>
                  </>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
