import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export function MainLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen text-stone-900">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(216,154,40,0.14),_transparent_30%),linear-gradient(180deg,_#fafaf8_0%,_#f7f2eb_45%,_#fafaf8_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_18%_18%,_rgba(216,154,40,0.15),_transparent_28%),radial-gradient(circle_at_82%_0%,_rgba(23,20,18,0.06),_transparent_30%)]" />
      <Header />
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <main key={location.pathname} className="page-enter">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
