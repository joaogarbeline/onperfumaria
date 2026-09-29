import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { MobileBottomNav } from '../components/mobile/MobileBottomNav'
import { useIsMobile } from '../hooks/useIsMobile'

export function MainLayout() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const isStandaloneProductPage =
    location.pathname === '/produto-modelo' || location.pathname === '/organizador'

  return (
    <div className="min-h-screen overflow-x-clip text-stone-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(216,154,40,0.14),_transparent_30%),linear-gradient(180deg,_#fafaf8_0%,_#f7f2eb_45%,_#fafaf8_100%)]" />
      <div
        aria-hidden="true"
        className="mesh-field pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_18%_18%,_rgba(216,154,40,0.15),_transparent_28%),radial-gradient(circle_at_82%_0%,_rgba(20,45,82,0.08),_transparent_30%)]"
      />
      {isStandaloneProductPage ? null : <Header />}
      <div
        className={
          isStandaloneProductPage
            ? 'w-full'
            : `mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:px-8 xl:px-6 ${isMobile ? 'pb-24' : ''}`
        }
      >
        <main key={location.pathname} className={isStandaloneProductPage ? '' : 'page-enter'}>
          <Outlet />
        </main>
      </div>
      {isStandaloneProductPage ? null : <Footer />}
      {isMobile && !isStandaloneProductPage ? <MobileBottomNav /> : null}
    </div>
  )
}
