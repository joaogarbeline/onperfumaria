import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ItemDetail } from '../components/item/ItemDetail'
import { MainLayout } from '../layouts/MainLayout'
import { AccountPage } from '../pages/AccountPage'
import { ArabesPage } from '../pages/ArabesPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { ComercialPage } from '../pages/ComercialPage'
import { CustomerAuthPage } from '../pages/CustomerAuthPage'
import { FemininoPage } from '../pages/FemininoPage'
import { HomePage } from '../pages/HomePage'
import { ImportadosPage } from '../pages/ImportadosPage'
import { MasculinoPage } from '../pages/MasculinoPage'
import { ManagedPage } from '../pages/ManagedPage'
import { OrderTrackingPage } from '../pages/OrderTrackingPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { OrdersPage } from '../pages/OrdersPage'
import { OrganizerPage } from '../pages/OrganizerPage'
import { ProductPage } from '../pages/ProductPage'
import { UnisexPage } from '../pages/UnisexPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/organizador" element={<OrganizerPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/comercial" element={<ComercialPage />} />
          <Route path="/arabes" element={<ArabesPage />} />
          <Route path="/feminino" element={<FemininoPage />} />
          <Route path="/masculino" element={<MasculinoPage />} />
          <Route path="/importados" element={<ImportadosPage />} />
          <Route path="/unisex" element={<UnisexPage />} />
          <Route path="/pagina/:slug" element={<ManagedPage />} />
          <Route path="/produto/:slug" element={<ProductPage />} />
          <Route path="/produto-modelo" element={<ItemDetail />} />
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
