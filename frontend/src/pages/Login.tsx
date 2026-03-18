import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #e8f4fd 0%, #f0f6fb 50%, #e6eef8 100%)',
      padding: 24,
      animation: 'fadeUp 0.4s ease forwards',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '52px 44px',
        maxWidth: 400,
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{
          width: 60, height: 60,
          background: 'var(--navy)',
          borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          margin: '0 auto 24px',
          boxShadow: '0 4px 16px rgba(10,37,64,0.2)',
        }}>
          🏥
        </div>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--navy)',
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: '-0.3px',
        }}>
          Welcome back
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          lineHeight: 1.65,
          marginBottom: 36,
        }}>
          Sign in to access your personal care dashboard
        </p>

        {/* Divider with text */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>Continue with</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <GoogleSignInButton />
        </div>

        <p style={{
          fontSize: 11,
          color: 'var(--text-light)',
          lineHeight: 1.7,
          padding: '0 8px',
        }}>
          🔒 Your health data is private and encrypted. We never share your information.
        </p>
      </div>

      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          top: 24, left: 24,
          background: 'rgba(255,255,255,0.8)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 16px',
          color: 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--navy)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        ← Back
      </button>
    </div>
  )
}
