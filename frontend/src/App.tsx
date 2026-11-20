import { Navigate, NavLink, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AppFooter } from '@/components/AppFooter'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { ToastProvider } from '@/components/ui/toast'
import { isLoggedIn } from '@/lib/api'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { ReportsPage } from '@/pages/ReportsPage'
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
    <nav className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline pb-3.5">
      <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
        Overview
      </NavLink>
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
      <NavLink to="/payments" className={NAV_LINK_CLASS}>
        Payments
      </NavLink>
      <NavLink to="/reports" className={NAV_LINK_CLASS}>
        Reports
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
          <div className="mx-auto flex min-h-screen max-w-[1040px] flex-col border-l-[3px] border-ledger py-7 pl-5 pr-4">
            <div className="mb-5">
              <Logo withWordmark />
            </div>
            <Nav />
            <main className="flex-1">
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
              <Route path="/" element={<Navigate to={isLoggedIn() ? '/dashboard' : '/login'} replace />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/payments"
                element={
                  <RequireAuth>
                    <PaymentsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <ReportsPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </main>
            <AppFooter />
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}
