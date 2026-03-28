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
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  signOut: () => {},
  setOnboarded: () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
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

// ---------------------------------------------------------------------------
// Minimal password hashing using Web Crypto (PBKDF2-SHA-256)
// The derived key is stored locally so the raw password is never persisted.
// For a production app, hashing should happen server-side via a /signup and
// /login endpoint that stores bcrypt hashes in the database.
// ---------------------------------------------------------------------------
async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashArray = Array.from(new Uint8Array(bits))
  const saltArray = Array.from(salt)
  return {
    hash: hashArray.map(b => b.toString(16).padStart(2, '0')).join(''),
    salt: saltArray.map(b => b.toString(16).padStart(2, '0')).join(''),
  }
}

const EMAIL_ACCOUNTS_KEY = 'cc_email_accounts'

interface StoredAccount {
  name: string
  email: string
  passwordHash: string
  salt: string
  userId: number
  onboarded: boolean
}

function getStoredAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_ACCOUNTS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(EMAIL_ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function AuthProvider({ children }: { children: ReactNode }) {
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

  // Sign in with email + password
  async function signInWithEmail(email: string, password: string) {
    const accounts = getStoredAccounts()
    const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())
    if (!account) throw new Error('No account found for this email. Please sign up first.')

    const { hash } = await hashPassword(password, account.salt)
    if (hash !== account.passwordHash) throw new Error('Incorrect password.')

    const fullUser: GoogleUser = {
      name: account.name,
      email: account.email,
      picture: '',
      token: `email:${account.email}`,
      userId: account.userId,
      onboarded: account.onboarded,
    }
    setUser(fullUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
  }

  // Sign up with name, email + password
  async function signUpWithEmail(name: string, email: string, password: string) {
    const accounts = getStoredAccounts()
    if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists. Please sign in.')
    }

    const { hash, salt } = await hashPassword(password)

    // Register user in backend (same endpoint used by Google flow)
    const res = await fetch(`/user-by-email/${encodeURIComponent(email)}`)
    const data = await res.json()
    const userId: number = data.user_id

    const newAccount: StoredAccount = {
      name,
      email,
      passwordHash: hash,
      salt,
      userId,
      onboarded: false,
    }
    saveStoredAccounts([...accounts, newAccount])

    const fullUser: GoogleUser = {
      name,
      email,
      picture: '',
      token: `email:${email}`,
      userId,
      onboarded: false,
    }
    setUser(fullUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
  }

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

    // Also update the stored email account if it exists
    const accounts = getStoredAccounts()
    const idx = accounts.findIndex(a => a.email.toLowerCase() === user.email.toLowerCase())
    if (idx !== -1) {
      accounts[idx].onboarded = val
      saveStoredAccounts(accounts)
    }
  }

  return (
    <AuthContext.Provider value={{ user, signOut, setOnboarded, signInWithEmail, signUpWithEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
