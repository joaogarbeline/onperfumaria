import { NavLink } from 'react-router-dom'
import pedidosIcon from '../../../assets/icons/catalogo_d_c.png'
import homeIcon from '../../../assets/icons/home_d_c.png'
import perfilIcon from '../../../assets/icons/perfil_d_c.png'
import sacolaIcon from '../../../assets/icons/sacola_d_c.png'
import { useAuth } from '../../../contexts/AuthContext'
import { useCart } from '../../../contexts/CartContext'

export function MobileBottomNav() {
  const { scope } = useAuth()
  const { items } = useCart()
  const isCustomer = scope === 'customer'
  const count = items.reduce((sum, item) => sum + item.quantity, 0)

  const itemClassName = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
      isActive ? 'text-[#fafaf8]' : 'text-[#fafaf8]/70'
    }`

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[#3a164f]/40 bg-[linear-gradient(160deg,#5b247f_0%,#3a164f_100%)]">
      <NavLink to="/" end className={itemClassName}>
        <img src={homeIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        Home
      </NavLink>
      <NavLink to="/pedidos" className={itemClassName}>
        <img src={pedidosIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        Pedidos
      </NavLink>
      <NavLink to="/checkout" className={itemClassName}>
        <span className="relative flex items-center justify-center">
          <img src={sacolaIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#d89a28] text-[8px] font-bold text-[#3a164f]">
            {count}
          </span>
        </span>
        Sacola
      </NavLink>
      <NavLink to={isCustomer ? '/conta' : '/login'} className={itemClassName}>
        <img src={perfilIcon} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        Minha conta
      </NavLink>
    </nav>
  )
}
