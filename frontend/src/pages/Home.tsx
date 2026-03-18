import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

const features = [
  { icon: '🩺', label: 'Symptom Tracking' },
  { icon: '💊', label: 'Medication Reminders' },
  { icon: '📅', label: 'Appointment Scheduling' },
  { icon: '🚨', label: 'Emergency Alerts' },
]

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(160deg, #e8f4fd 0%, #f0f6fb 50%, #e6eef8 100%)',
    }}>
      {/* Top nav bar */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid var(--border-light)',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--navy)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🏥</div>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--navy)',
            letterSpacing: '-0.3px',
          }}>CareCompanion</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'var(--navy)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 22px',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-mid)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
        >
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
        animation: 'fadeUp 0.5s ease forwards',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--blue-light)',
          border: '1px solid var(--blue-mid)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--accent)',
          marginBottom: 28,
          letterSpacing: '0.2px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          AI-Powered Healthcare Assistant
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 700,
          color: 'var(--navy)',
          letterSpacing: '-1px',
          lineHeight: 1.15,
          marginBottom: 20,
          maxWidth: 640,
        }}>
          Your Recovery,<br />Supported Every Step
        </h1>

        <p style={{
          fontSize: 17,
          color: 'var(--text-mid)',
          maxWidth: 480,
          lineHeight: 1.75,
          marginBottom: 44,
          fontWeight: 400,
        }}>
          CareCompanion helps post-discharge patients manage symptoms, track medications, and stay connected with their care team — all in one place.
        </p>

        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'var(--navy)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '16px 44px',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: '0 4px 20px rgba(10,37,64,0.25)',
            letterSpacing: '0.1px',
            marginBottom: 56,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--navy-mid)'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(10,37,64,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--navy)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,37,64,0.25)'
          }}
        >
          Get Started — It's Free
        </button>

        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14,
          maxWidth: 720,
          width: '100%',
        }}>
          {features.map(f => (
            <div key={f.label} style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px 16px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)', lineHeight: 1.4 }}>{f.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: 12,
        color: 'var(--text-light)',
        borderTop: '1px solid var(--border-light)',
      }}>
        CareCompanion — Not a substitute for professional medical advice.
      </footer>
    </div>
  )
}
