import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/dashboard',    icon: '🏠', label: 'Dashboard' },
  { path: '/chat',         icon: '💬', label: 'Chat' },
  { path: '/symptoms',     icon: '🩺', label: 'Symptoms' },
  { path: '/medications',  icon: '💊', label: 'Medications' },
  { path: '/appointments', icon: '📅', label: 'Appointments' },
  { path: '/summaries',    icon: '📊', label: 'Summaries' },
  { path: '/profile',      icon: '👤', label: 'Profile' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const currentPage = NAV_ITEMS.find(n => n.path === location.pathname)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 16px',
        boxShadow: '2px 0 8px rgba(10,37,64,0.04)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '20px 20px 18px',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--navy)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🏥</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 14, fontWeight: 700,
              color: 'var(--navy)', letterSpacing: '-0.2px', lineHeight: 1.1,
            }}>CareCompanion</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Healthcare Assistant</div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 10px' }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 12px',
                  borderRadius: 10, border: 'none',
                  background: active ? 'var(--blue-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginBottom: 2,
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--surface-2)'
                    e.currentTarget.style.color = 'var(--navy)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User section at bottom of sidebar */}
        {user && (
          <div style={{
            margin: '8px 10px 0',
            padding: '12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <img
                src={user.picture}
                alt={user.name}
                onClick={() => navigate('/profile')}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: '2px solid var(--border)',
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => { signOut(); navigate('/') }}
              style={{
                width: '100%', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px', fontSize: 12, fontWeight: 500,
                color: 'var(--text-muted)', cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top header */}
        <header style={{
          height: 60,
          flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 28px',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
          zIndex: 10,
        }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 18, fontWeight: 700,
            color: 'var(--navy)', letterSpacing: '-0.3px',
            flex: 1,
          }}>
            {currentPage?.label || 'CareCompanion'}
          </h1>

          {/* Avatar click → profile */}
          {user && (
            <img
              src={user.picture}
              alt={user.name}
              onClick={() => navigate('/profile')}
              title="View Profile"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                border: '2px solid var(--border)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          )}
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 32px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
