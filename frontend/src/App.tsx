import { Navigate, NavLink, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NotificationBell } from '@/components/NotificationBell'
import { ToastProvider } from '@/components/ui/toast'
import { isLoggedIn } from '@/lib/api'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { LoginPage } from '@/pages/LoginPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { UploadPage } from '@/pages/UploadPage'
import { VendorsPage } from '@/pages/VendorsPage'

function RequireAuth({ children }: { children: React.ReactElement }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

const NAV_LINK_CLASS =
  'border-b-2 border-transparent pb-1 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-ledger aria-[current=page]:text-foreground'

function Nav() {
  if (!isLoggedIn()) return null
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-5 border-b border-hairline pb-3.5">
      <NavLink to="/upload" className={NAV_LINK_CLASS}>
        Invoices
      </NavLink>
      <NavLink to="/vendors" className={NAV_LINK_CLASS}>
        Vendors
      </NavLink>
      <NavLink to="/purchase-orders" className={NAV_LINK_CLASS}>
        Purchase Orders
      </NavLink>
      <NavLink to="/approvals" className={NAV_LINK_CLASS}>
        Approvals
      </NavLink>
      <div className="ml-auto">
        <NotificationBell />
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="mx-auto min-h-screen max-w-[1040px] border-l-[3px] border-ledger py-7 pl-5 pr-4">
            <div className="mb-5 flex items-baseline gap-2">
              <span className="text-[17px] font-bold tracking-tight">AP Automation</span>
            </div>
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
              <Route
                path="/approvals"
                element={
                  <RequireAuth>
                    <ApprovalsPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to={isLoggedIn() ? '/upload' : '/login'} replace />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}
