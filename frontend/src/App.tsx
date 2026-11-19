import { Link, Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { isLoggedIn } from '@/lib/api'
import { LoginPage } from '@/pages/LoginPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { UploadPage } from '@/pages/UploadPage'
import { VendorsPage } from '@/pages/VendorsPage'

function RequireAuth({ children }: { children: React.ReactElement }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

function Nav() {
  if (!isLoggedIn()) return null
  return (
    <nav className="mx-auto flex max-w-3xl gap-4 px-4 pt-6 text-sm text-muted-foreground">
      <Link to="/upload">Invoices</Link>
      <Link to="/vendors">Vendors</Link>
      <Link to="/purchase-orders">Purchase Orders</Link>
    </nav>
  )
}

export default function App() {
  return (
    <Router>
      <Nav />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <UploadPage />
            </RequireAuth>
          }
        />
        <Route
          path="/vendors"
          element={
            <RequireAuth>
              <VendorsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/purchase-orders"
          element={
            <RequireAuth>
              <PurchaseOrdersPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to={isLoggedIn() ? '/upload' : '/login'} replace />} />
      </Routes>
    </Router>
  )
}
