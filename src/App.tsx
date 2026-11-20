import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './auth'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Products = lazy(() => import('./pages/Products'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Sales = lazy(() => import('./pages/SalesOrders'))
const Purchase = lazy(() => import('./pages/PurchaseOrders'))
const Customers = lazy(() => import('./pages/Customers'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Finance = lazy(() => import('./pages/Finance'))
const Accounts = lazy(() => import('./pages/Accounts'))
const CustomerAccounts = lazy(() => import('./pages/CustomerAccounts'))
const Profile = lazy(() => import('./pages/Profile'))
const Shops = lazy(() => import('./pages/Shops'))
const Warehouses = lazy(() => import('./pages/Warehouses'))
const ShippingMethods = lazy(() => import('./pages/ShippingMethods'))
const ShippingTemplates = lazy(() => import('./pages/ShippingTemplates'))
const StockTransfers = lazy(() => import('./pages/StockTransfers'))
const Shipments = lazy(() => import('./pages/Shipments'))
const Profit = lazy(() => import('./pages/Profit'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Sourcing = lazy(() => import('./pages/Sourcing'))
const Listings = lazy(() => import('./pages/Listings'))
const OrderSync = lazy(() => import('./pages/OrderSync'))
const Messages = lazy(() => import('./pages/Messages'))

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><Spin size="large" /></div>
)

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/products" element={<AdminOnly><Products /></AdminOnly>} />
          <Route path="/inventory" element={<AdminOnly><Inventory /></AdminOnly>} />
          <Route path="/purchase" element={<AdminOnly><Purchase /></AdminOnly>} />
          <Route path="/suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />
          <Route path="/finance" element={<AdminOnly><Finance /></AdminOnly>} />
          <Route path="/accounts" element={<AdminOnly><Accounts /></AdminOnly>} />
          <Route path="/customer-accounts" element={<AdminOnly><CustomerAccounts /></AdminOnly>} />
          <Route path="/shops" element={<AdminOnly><Shops /></AdminOnly>} />
          <Route path="/warehouses" element={<AdminOnly><Warehouses /></AdminOnly>} />
          <Route path="/shipping-methods" element={<AdminOnly><ShippingMethods /></AdminOnly>} />
          <Route path="/shipping-templates" element={<AdminOnly><ShippingTemplates /></AdminOnly>} />
          <Route path="/stock-transfers" element={<AdminOnly><StockTransfers /></AdminOnly>} />
          <Route path="/shipments" element={<AdminOnly><Shipments /></AdminOnly>} />
          <Route path="/profit" element={<AdminOnly><Profit /></AdminOnly>} />
          <Route path="/pricing" element={<AdminOnly><Pricing /></AdminOnly>} />
          <Route path="/sourcing" element={<AdminOnly><Sourcing /></AdminOnly>} />
          <Route path="/listings" element={<AdminOnly><Listings /></AdminOnly>} />
          <Route path="/order-sync" element={<AdminOnly><OrderSync /></AdminOnly>} />
          <Route path="/messages" element={<AdminOnly><Messages /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
