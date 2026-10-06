import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../pages/layout/MainLayout'
import { AccountPage } from '../pages/AccountPage'
import { CategoryPage } from '../pages/CategoryPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { CustomerAuthPage } from '../pages/CustomerAuthPage'
import { HomePage } from '../pages/HomePage'
import { ManagedPage } from '../pages/ManagedPage'
import { OrderTrackingPage } from '../pages/OrderTrackingPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { OrdersPage } from '../pages/OrdersPage'
import { OrganizerPage } from '../pages/OrganizerPage'
import { ProductPage } from '../pages/ProductPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/organizador" element={<OrganizerPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/unisex" element={<CategoryPage title="Unisex" />} />
          <Route path="/pagina/:slug" element={<ManagedPage />} />
          <Route path="/produto/:slug" element={<ProductPage />} />
          <Route path="/pedido/:id" element={<OrderTrackingPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<CustomerAuthPage mode="login" />} />
          <Route path="/cadastro" element={<CustomerAuthPage mode="register" />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
