import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { MainLayout } from '../layouts/MainLayout'
import { AccountPage } from '../pages/AccountPage'
import { AdminLoginPage } from '../pages/AdminLoginPage'
import { AdminPage } from '../pages/AdminPage'
import { CatalogPage } from '../pages/CatalogPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { CustomerAuthPage } from '../pages/CustomerAuthPage'
import { HomePage } from '../pages/HomePage'
import { OrderTrackingPage } from '../pages/OrderTrackingPage'
import { ProductPage } from '../pages/ProductPage'

function RequireAdmin({ children }: { children: ReactElement }) {
  const { token, scope } = useAuth()
  if (!token || scope !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalogo" element={<CatalogPage />} />
          <Route path="/produto/:slug" element={<ProductPage />} />
          <Route path="/pedido/:id" element={<OrderTrackingPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<CustomerAuthPage mode="login" />} />
          <Route path="/cadastro" element={<CustomerAuthPage mode="register" />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
