import { useEffect } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AuthModal } from '../../components/auth/AuthModal'
import { Footer } from '../../components/Footer'
import { useAuth } from '../../contexts/AuthContext'
import { Header } from './Header'
import { MobileBottomNav } from './mobile/MobileBottomNav'
import { useIsMobile } from './useIsMobile'
import { isOrganizerPreviewMode } from '../../types/organizer'
import { isAdminVisitorMode, setAdminVisitorMode, VISITOR_PARAM } from '../../utils/adminVisitor'

export function MainLayout() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { modal, isAdmin } = useAuth()
  const isStandaloneProductPage = location.pathname === '/admin'
  const visitorParam = new URLSearchParams(location.search).get(VISITOR_PARAM) === '1'
  // A previa do editor avancado abre a loja num iframe: la nao redireciona
  // nem mostra o botao de voltar (o editor ja tem o seu).
  const embedded = window.self !== window.top || isOrganizerPreviewMode(location.search)
  const visitorMode = visitorParam || isAdminVisitorMode()

  useEffect(() => {
    if (visitorParam) setAdminVisitorMode(true)
  }, [visitorParam])

  // Admin logado fica no painel; a loja so no modo visitante.
  if (isAdmin && !visitorMode && !embedded) return <Navigate to="/admin" replace />

  return (
    <div
      className="flex min-h-screen flex-col overflow-x-clip text-stone-900"
      // No celular o menu de baixo (e a barra fixa do produto, quando existe)
      // ficam por cima do fim da pagina: reserva esse espaco abaixo do rodape.
      style={
        isMobile && !isStandaloneProductPage
          ? {
              paddingBottom: 'calc(var(--mobile-nav-height, 64px) + var(--mobile-action-bar-height, 0px))',
            }
          : undefined
      }
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,_rgba(165,77,230,0.18),_transparent_35%),radial-gradient(circle_at_90%_10%,_rgba(242,179,61,0.18),_transparent_32%),linear-gradient(180deg,_#fbf6fe_0%,_#f0e1f8_50%,_#fbf6fe_100%)]" />
      <div
        aria-hidden="true"
        className="mesh-field pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_18%_18%,_rgba(242,179,61,0.22),_transparent_30%),radial-gradient(circle_at_82%_0%,_rgba(165,77,230,0.2),_transparent_32%)]"
      />
      {isStandaloneProductPage ? null : <Header />}
      <div
        className={
          isStandaloneProductPage
            ? 'w-full flex-1'
            : `w-full flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:px-8 xl:px-6 ${isMobile ? 'pb-24' : ''}`
        }
      >
        <main key={location.pathname} className={isStandaloneProductPage ? '' : 'page-enter'}>
          <Outlet />
        </main>
      </div>
      {isStandaloneProductPage ? null : <Footer />}
      {isMobile && !isStandaloneProductPage ? <MobileBottomNav /> : null}
      {isAdmin && !embedded ? (
        <button
          type="button"
          onClick={() => {
            setAdminVisitorMode(false)
            navigate('/admin')
          }}
          className="btn-fx fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#2a0f3d]/90 py-2 pl-2 pr-4 text-xs font-bold text-white shadow-[0_18px_40px_-18px_rgba(42,15,61,0.8)] ring-1 ring-white/15 backdrop-blur"
          style={{
            bottom: isMobile
              ? 'calc(var(--mobile-nav-height, 64px) + var(--mobile-action-bar-height, 0px) + 10px)'
              : '24px',
          }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[image:var(--grad-gold)] text-[#3a164f]">
            <LayoutDashboard size={15} />
          </span>
          Modo visitante · Voltar ao admin
        </button>
      ) : null}
      {/* A chave remonta a janela zerada a cada nova abertura. */}
      {modal ? <AuthModal key={modal.id} /> : null}
    </div>
  )
}
