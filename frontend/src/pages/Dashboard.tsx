import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getSymptoms } from '../api/symptoms'
import { getMedications } from '../api/medications'
import { getAppointments } from '../api/appointments'
import { getSummaries } from '../api/summaries'

function StatCard({
  icon, title, blurb, sub, color, onClick, loading,
}: {
  icon: string; title: string; blurb: string; sub?: string;
  color: string; onClick: () => void; loading: boolean
}) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 18, padding: '28px 24px',
      textAlign: 'left', cursor: 'pointer', width: '100%',
      boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s',
      borderTop: `4px solid ${color}`,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{icon}</div>
        <span style={{ fontSize: 18, color: 'var(--text-light)' }}>›</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{title}</div>
      {loading ? (
        <div style={{ height: 16, background: 'var(--border)', borderRadius: 6, marginBottom: 6, width: '80%', animation: 'pulse 1.5s infinite' }} />
      ) : (
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.4, marginBottom: 4 }}>{blurb}</div>
      )}
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </button>
  )
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = user!.userId

  const { data: sData, loading: sLoading } = useApi(() => getSymptoms(userId), [userId])
  const { data: mData, loading: mLoading } = useApi(() => getMedications(userId), [userId])
  const { data: aData, loading: aLoading } = useApi(() => getAppointments(userId), [userId])
  const { data: sumData, loading: sumLoading } = useApi(() => getSummaries(userId), [userId])
  const { data: profileData } = useApi(() => fetch(`/profile/${userId}`).then(r => r.json()), [userId])
  const calendarConnected = profileData?.calendar_connected ?? false

  const [calendarToast, setCalendarToast] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('calendar') === 'connected') setCalendarToast('Google Calendar connected!')
    if (params.get('calendar') === 'error') setCalendarToast(`Calendar connection failed: ${params.get('msg') || 'unknown error'}`)
  }, [location])

  async function handleConnectCalendar() {
    const res = await fetch(`/auth/google/calendar?user_id=${userId}`)
    const data = await res.json()
    window.location.href = data.auth_url
  }

  const firstName = user!.name.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const pendingMeds = mData?.medications?.filter((m: { taken_today: boolean }) => !m.taken_today).length ?? 0
  const nextAppt = aData?.next_appointment
  const lastSymptom = sData?.last_logged
  const lastSummary = sumData?.last_summary_date

  return (
    <div style={{ animation: 'fadeUp 0.35s ease forwards', maxWidth: 860 }}>
      {/* Calendar toast */}
      {calendarToast && (
        <div style={{
          background: calendarToast.includes('connected') ? '#d1fae5' : '#fee2e2',
          color: calendarToast.includes('connected') ? '#065f46' : '#991b1b',
          border: `1px solid ${calendarToast.includes('connected') ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {calendarToast.includes('connected') ? '✓' : '✕'} {calendarToast}
          <button onClick={() => setCalendarToast('')} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 16, color: 'inherit', lineHeight: 1,
          }}>×</button>
        </div>
      )}
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(120deg, var(--navy) 0%, var(--navy-mid) 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 28,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(10,37,64,0.2)',
      }}>
        <div>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>{greeting},</p>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
            {firstName} 👋
          </h2>
          <p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6, maxWidth: 380 }}>
            Here's an overview of your care today. Stay on track with your recovery.
          </p>
          {!calendarConnected && (
            <button onClick={handleConnectCalendar} style={{
              marginTop: 12, background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 8, padding: '8px 16px', fontSize: 12,
              color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              📅 Connect Google Calendar
            </button>
          )}
          {calendarConnected && (
            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>✓ Google Calendar connected</p>
          )}
        </div>
        <div style={{ fontSize: 64, opacity: 0.15, userSelect: 'none' }}>🏥</div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon="🩺" title="Symptoms" color="#3b82f6"
          blurb={lastSymptom ? `Last: ${lastSymptom.symptom}` : 'No symptoms logged yet'}
          sub={lastSymptom ? fmtDate(lastSymptom.logged_at) ?? undefined : 'Tap to log how you feel'}
          loading={sLoading} onClick={() => navigate('/symptoms')} />
        <StatCard icon="💊" title="Medications" color="#8b5cf6"
          blurb={mLoading ? '…' : pendingMeds > 0 ? `${pendingMeds} medication${pendingMeds > 1 ? 's' : ''} still to take` : 'All medications taken today ✓'}
          sub={mData ? `${mData.medications?.length ?? 0} total prescribed` : undefined}
          loading={mLoading} onClick={() => navigate('/medications')} />
        <StatCard icon="📅" title="Appointments" color="#059669"
          blurb={nextAppt ? nextAppt.reason : 'No upcoming appointments'}
          sub={nextAppt ? fmtDate(nextAppt.appointment_time) ?? undefined : 'Tap to schedule one'}
          loading={aLoading} onClick={() => navigate('/appointments')} />
        <StatCard icon="📊" title="Visit Summaries" color="#f59e0b"
          blurb={sumData?.summaries?.length ? `${sumData.summaries.length} ${sumData.summaries.length > 1 ? 'summaries' : 'summary'}` : 'No summaries yet'}
          sub={lastSummary ? `Last generated ${fmtDate(lastSummary)}` : 'Generate your first summary'}
          loading={sumLoading} onClick={() => navigate('/summaries')} />
      </div>

      {/* Quick links */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>Quick Actions</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '💬 Chat with Assistant', path: '/chat' },
            { label: '🩺 Log a Symptom', path: '/symptoms' },
            { label: '📅 Add Appointment', path: '/appointments' },
            { label: '📊 Generate Summary', path: '/summaries' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 500,
              color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-light)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--blue-mid)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-mid)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
