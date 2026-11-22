import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppFooter } from '@/components/AppFooter'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { ToastProvider } from '@/components/ui/toast'
import { AUTH_CHANGE_EVENT, getCurrentUser, isLoggedIn, logout } from '@/lib/api'
import { landingPageFor } from '@/lib/nav'

/** Forces the whole app to re-render right after login/logout, since
 * isLoggedIn()/getCurrentUser() read localStorage directly rather than
 * through React state — without this, Nav and route guards would only
 * pick up a fresh login after a full page reload. */
function useAuthRerender() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(AUTH_CHANGE_EVENT, handler)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler)
  }, [])
}

const ROLE_LABELS: Record<string, string> = {
  requester: 'Requester',
  approver: 'Approver',
  ap_admin: 'AP Admin',
  vendor: 'Vendor',
}

function UserMenu() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  if (!user) return null

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-medium text-foreground" title={user.email}>
        {ROLE_LABELS[user.role] ?? user.role}
      </span>
      <button
        type="button"
        onClick={() => {
          logout()
          navigate('/login', { replace: true })
        }}
        className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
      >
        Log out
      </button>
    </div>
  )
}
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

const NAV_LINKS: { to: string; label: string; roles: string[] | null }[] = [
  { to: '/dashboard', label: 'Overview', roles: ['ap_admin', 'approver'] },
  { to: '/upload', label: 'Invoices', roles: ['requester', 'ap_admin'] },
  { to: '/vendors', label: 'Vendors', roles: null },
  { to: '/purchase-orders', label: 'Purchase Orders', roles: null },
  { to: '/approvals', label: 'Approvals', roles: ['requester', 'approver', 'ap_admin'] },
  { to: '/payments', label: 'Payments', roles: ['ap_admin', 'approver'] },
  { to: '/reports', label: 'Reports', roles: ['ap_admin', 'approver'] },
]

function Nav() {
  const location = useLocation()
  if (location.pathname === '/login' || !isLoggedIn()) return null
  const role = getCurrentUser()?.role
  const links = NAV_LINKS.filter((link) => link.roles === null || !role || link.roles.includes(role))
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline pb-3.5">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className={NAV_LINK_CLASS}>
          {link.label}
        </NavLink>
      ))}
      <div className="ml-auto flex items-center gap-4">
        <NotificationBell />
        <UserMenu />
      </div>
    </nav>
  )
}

function AppShell() {
  useAuthRerender()
  return (
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
              <Route path="/" element={<Navigate to={isLoggedIn() ? landingPageFor(getCurrentUser()?.role) : '/login'} replace />} />
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
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  )
}
