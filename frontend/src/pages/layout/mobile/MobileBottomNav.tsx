import { LayoutDashboard, LogOut, Package, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import pedidosIcon from '../../../assets/icons/catalogo_d_c.png'
import homeIcon from '../../../assets/icons/home_d_c.png'
import perfilIcon from '../../../assets/icons/perfil_d_c.png'
import sacolaIcon from '../../../assets/icons/sacola_d_c.png'
import { useAuth } from '../../../contexts/AuthContext'
import { useCart } from '../../../contexts/CartContext'
import { useFixedHeightVar } from '../useFixedHeightVar'

export function MobileBottomNav() {
  const { scope, requireAuth, isAdmin, logout } = useAuth()
  const { items } = useCart()
  const navigate = useNavigate()
  const isCustomer = scope === 'customer'
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  // Barras fixas da pagina (ex.: "Adicionar ao carrinho" do produto) ficam
  // logo acima do menu usando --mobile-nav-height.
  const navRef = useFixedHeightVar('--mobile-nav-height')

  const itemClassName = ({ isActive }: { isActive: boolean }) =>
    `relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-300 ${
      isActive ? 'text-[#fafaf8]' : 'text-[#fafaf8]/70'
    }`

  // Pilula dourada em cima do item ativo: cresce com mola ao trocar de aba.
  const activeIndicator = (isActive: boolean) => (
    <span
      aria-hidden="true"
      className={`absolute top-0 h-1 rounded-b-full bg-[image:var(--grad-gold)] transition-all duration-500 [transition-timing-function:var(--ease-spring)] ${
        isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'
      }`}
    />
  )

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/10 bg-[image:var(--grad-brand)] shadow-[0_-12px_30px_-18px_rgba(58,22,79,0.6)]"
    >
      <NavLink to="/" end className={itemClassName}>
        {({ isActive }) => (
          <>
            {activeIndicator(isActive)}
            <img src={homeIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            Home
          </>
        )}
      </NavLink>
      <NavLink to="/pedidos" className={itemClassName}>
        {({ isActive }) => (
          <>
            {activeIndicator(isActive)}
            <img src={pedidosIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            Pedidos
          </>
        )}
      </NavLink>
      <NavLink to="/checkout" className={itemClassName}>
        {({ isActive }) => (
          <>
            {activeIndicator(isActive)}
            <span className="relative flex items-center justify-center">
              <img src={sacolaIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
              <span
                key={count}
                className="badge-bump absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[image:var(--grad-gold)] px-0.5 text-[9px] font-extrabold text-[#3a164f] shadow-[var(--glow-gold)]"
              >
                {count}
              </span>
            </span>
            Sacola
          </>
        )}
      </NavLink>
      {isCustomer ? (
        <div className="relative flex flex-1">
          <button
            type="button"
            aria-label={accountMenuOpen ? 'Fechar menu da conta' : 'Abrir menu da conta'}
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((value) => !value)}
            className={itemClassName({ isActive: accountMenuOpen })}
          >
            {activeIndicator(accountMenuOpen)}
            <img src={perfilIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            Minha conta
          </button>

          {/* Sempre no DOM: a transicao de escala (origin no topo, "de cima para
              baixo") so anima trocando classe, nao montando/desmontando. */}
          <div
            role="menu"
            aria-label="Menu da conta"
            className={`absolute bottom-full right-0 z-40 mb-2 w-52 origin-top overflow-hidden rounded-[18px] border border-[#3a164f]/40 bg-brand-live shadow-[0_20px_50px_-15px_rgba(42,15,61,0.6)] transition-[transform,opacity] duration-200 ease-out ${
              accountMenuOpen ? 'scale-y-100 opacity-100' : 'pointer-events-none scale-y-0 opacity-0'
            }`}
          >
            <AccountMenuItem
              icon={<UserRound size={16} />}
              label="Minha conta"
              onClick={() => {
                setAccountMenuOpen(false)
                navigate('/conta')
              }}
            />
            <AccountMenuItem
              icon={<Package size={16} />}
              label="Meus pedidos"
              onClick={() => {
                setAccountMenuOpen(false)
                navigate('/pedidos')
              }}
            />
            {isAdmin ? (
              <AccountMenuItem
                icon={<LayoutDashboard size={16} />}
                label="Editor"
                onClick={() => {
                  setAccountMenuOpen(false)
                  navigate('/admin')
                }}
              />
            ) : null}
            <div className="h-px bg-[#fafaf8]/15" />
            <AccountMenuItem
              icon={<LogOut size={16} />}
              label="Sair"
              onClick={() => {
                setAccountMenuOpen(false)
                logout()
                navigate('/')
              }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            requireAuth(() => navigate('/conta'), 'Entre ou cadastre-se para acessar sua conta.')
          }
          className={itemClassName({ isActive: false })}
        >
          <img src={perfilIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
          Minha conta
        </button>
      )}

      {accountMenuOpen ? (
        <div aria-hidden="true" onClick={() => setAccountMenuOpen(false)} className="fixed inset-0 z-30" />
      ) : null}
    </nav>
  )
}

function AccountMenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-[#fafaf8] transition hover:bg-white/10"
    >
      {icon}
      {label}
    </button>
  )
}
