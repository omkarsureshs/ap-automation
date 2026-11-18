import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { isLoggedIn } from '@/lib/api'
import { LoginPage } from '@/pages/LoginPage'
import { UploadPage } from '@/pages/UploadPage'

function RequireAuth({ children }: { children: React.ReactElement }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Router>
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
        <Route path="*" element={<Navigate to={isLoggedIn() ? '/upload' : '/login'} replace />} />
      </Routes>
    </Router>
  )
}
