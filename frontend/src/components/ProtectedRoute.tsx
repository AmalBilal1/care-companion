import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  requireOnboarded?: boolean
}

export default function ProtectedRoute({ requireOnboarded = true }: Props) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (requireOnboarded && !user.onboarded) return <Navigate to="/onboard" replace />
  return <Outlet />
}
