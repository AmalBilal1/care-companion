import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface GoogleUser {
  name: string
  email: string
  picture: string
  token: string
  userId: number
  onboarded: boolean
}

interface AuthContextType {
  user: GoogleUser | null
  signOut: () => void
  setOnboarded: (val: boolean) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  signOut: () => {},
  setOnboarded: () => {},
})

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, config: object) => void
          prompt: () => void
          disableAutoSelect: () => void
          revoke: (email: string, done: () => void) => void
        }
      }
    }
  }
}

function decodeJwt(token: string) {
  const payload = JSON.parse(atob(token.split('.')[1]))
  return { name: payload.name as string, email: payload.email as string, picture: payload.picture as string }
}

const STORAGE_KEY = 'cc_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Warm up the server on app load (Render free tier cold start)
  useEffect(() => { fetch('/health').catch(() => {}) }, [])

  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    async function handleCredential(response: { credential: string }) {
      const { name, email, picture } = decodeJwt(response.credential)
      // Look up or create user in backend
      const res = await fetch(`/user-by-email/${encodeURIComponent(email)}`)
      const data = await res.json()
      const fullUser: GoogleUser = {
        name, email, picture,
        token: response.credential,
        userId: data.user_id,
        onboarded: data.onboarded,
      }
      setUser(fullUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
    }

    function initGsi() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      })
    }

    if (window.google?.accounts?.id) {
      initGsi()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initGsi()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [])

  function signOut() {
    if (user && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
      window.google.accounts.id.revoke(user.email, () => {})
    }
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  function setOnboarded(val: boolean) {
    if (!user) return
    const updated = { ...user, onboarded: val }
    setUser(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, signOut, setOnboarded }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
