import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Onboard from './pages/Onboard'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Symptoms from './pages/Symptoms'
import Medications from './pages/Medications'
import Appointments from './pages/Appointments'
import Summaries from './pages/Summaries'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* Onboarding: must be logged in, onboarding not yet required */}
            <Route element={<ProtectedRoute requireOnboarded={false} />}>
              <Route path="/onboard" element={<Onboard />} />
            </Route>

            {/* Authenticated + onboarded pages inside Layout */}
            <Route element={<ProtectedRoute requireOnboarded={true} />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/symptoms" element={<Symptoms />} />
                <Route path="/medications" element={<Medications />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/summaries" element={<Summaries />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
