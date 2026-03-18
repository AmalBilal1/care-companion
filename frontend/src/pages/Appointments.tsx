import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getAppointments, addAppointment, updateAppointment } from '../api/appointments'

interface Appointment {
  id: number; appointment_time: string; reason: string;
  location: string | null; appointment_type: string;
  status: string; source: string;
}

const TYPE_COLORS: Record<string, string> = {
  'follow-up': '#3b82f6', 'therapy': '#8b5cf6',
  'surgery': '#ef4444', 'consultation': '#059669', 'other': '#6b7280',
}

function ApptCard({ appt, onComplete }: { appt: Appointment; onComplete: () => void; onRefetch: () => void }) {
  const dt = new Date(appt.appointment_time)
  const color = TYPE_COLORS[appt.appointment_type] || '#6b7280'
  const isCompleted = appt.status === 'completed'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)', opacity: isCompleted ? 0.75 : 1,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{appt.reason}</span>
            <span style={{
              background: `${color}18`, color, border: `1px solid ${color}40`,
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            }}>{appt.appointment_type}</span>
            {appt.source === 'discharge' && (
              <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                From Discharge
              </span>
            )}
            {isCompleted && (
              <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                ✓ Completed
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 5 }}>
              📅 {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 5 }}>
              🕐 {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {appt.location && (
              <span style={{ fontSize: 13, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 5 }}>
                📍 {appt.location}
              </span>
            )}
          </div>
        </div>
        {!isCompleted && (
          <button onClick={onComplete} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500,
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)',
            whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.color = '#15803d' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  )
}

export default function Appointments() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getAppointments(userId), [userId])

  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    appointment_time: '', reason: '', location: '', appointment_type: 'follow-up',
  })
  const [addLoading, setAddLoading] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '9px 13px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.appointment_time || !addForm.reason) return
    setAddLoading(true)
    await addAppointment({ user_id: userId, ...addForm })
    setAddForm({ appointment_time: '', reason: '', location: '', appointment_type: 'follow-up' })
    setShowAdd(false)
    setAddLoading(false)
    refetch()
  }

  async function handleComplete(id: number) {
    await updateAppointment(id, { status: 'completed' })
    refetch()
  }

  const upcoming: Appointment[] = data?.upcoming ?? []
  const completed: Appointment[] = data?.completed ?? []
  const list = tab === 'upcoming' ? upcoming : completed

  return (
    <div style={{ maxWidth: 800, animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Next appointment banner */}
      {data?.next_appointment && (
        <div style={{
          background: 'linear-gradient(120deg, #1e3a5f 0%, #2c5282 100%)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 20, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 16px rgba(10,37,64,0.2)',
        }}>
          <div>
            <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Next Appointment</p>
            <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
              {data.next_appointment.reason}
            </p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              📅 {new Date(data.next_appointment.appointment_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}🕐 {new Date(data.next_appointment.appointment_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {data.next_appointment.location && ` · 📍 ${data.next_appointment.location}`}
            </p>
          </div>
          <div style={{ fontSize: 48, opacity: 0.2 }}>📅</div>
        </div>
      )}

      {/* Header with tabs + add button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {(['upcoming', 'completed'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 18px', borderRadius: 7, border: 'none',
              background: tab === t ? 'var(--navy)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}>
              {t} ({t === 'upcoming' ? upcoming.length : completed.length})
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: showAdd ? 'var(--surface-2)' : 'var(--navy)',
          color: showAdd ? 'var(--text-muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '9px 18px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          {showAdd ? 'Cancel' : '+ New Appointment'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '20px', marginBottom: 16, boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Reason *</label>
              <input style={inputStyle} placeholder="e.g. Cardiology follow-up"
                value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date & Time *</label>
              <input style={inputStyle} type="datetime-local"
                value={addForm.appointment_time} onChange={e => setAddForm(f => ({ ...f, appointment_time: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Location</label>
              <input style={inputStyle} placeholder="e.g. Boston Medical Center"
                value={addForm.location} onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Type</label>
              <select style={inputStyle} value={addForm.appointment_type} onChange={e => setAddForm(f => ({ ...f, appointment_type: e.target.value }))}>
                <option value="follow-up">Follow-up</option>
                <option value="consultation">Consultation</option>
                <option value="therapy">Therapy</option>
                <option value="surgery">Surgery</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={addLoading} style={{
            background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>{addLoading ? 'Saving…' : 'Schedule Appointment'}</button>
        </form>
      )}

      {/* Appointments list */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading appointments…</p>
      ) : list.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '40px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {tab === 'upcoming' ? 'No upcoming appointments. Schedule one above.' : 'No completed appointments yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(appt => (
            <ApptCard key={appt.id} appt={appt}
              onComplete={() => handleComplete(appt.id)}
              onRefetch={refetch} />
          ))}
        </div>
      )}
    </div>
  )
}
