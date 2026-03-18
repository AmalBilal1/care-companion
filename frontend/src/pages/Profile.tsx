import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getProfile, updateProfile } from '../api/profile'

const CONDITIONS: Record<string, string> = {
  cardiac_surgery: 'Cardiac Surgery', joint_replacement: 'Joint Replacement',
  abdominal_surgery: 'Abdominal Surgery', pneumonia: 'Pneumonia',
  heart_failure: 'Heart Failure', stroke: 'Stroke', general_surgery: 'General Surgery', other: 'Other',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '22px 24px', marginBottom: 16,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 600, color: 'var(--navy)', marginBottom: 18, borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value, editing, input }: { label: string; value: string | null; editing: boolean; input?: React.ReactNode }) {
  if (!editing && !value) return null
  return (
    <div style={{ display: 'flex', alignItems: editing ? 'flex-start' : 'center', gap: 12, marginBottom: editing ? 14 : 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 160, textTransform: 'uppercase', letterSpacing: '0.3px', paddingTop: editing ? 8 : 0 }}>{label}</span>
      {editing && input ? input : <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{value || '—'}</span>}
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getProfile(userId), [userId])

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function startEdit() {
    if (!data) return
    setForm({
      name: data.name || '',
      phone: data.phone || '',
      date_of_birth: data.date_of_birth || '',
      gender: data.gender || '',
      location: data.location || '',
      primary_condition: data.primary_condition || '',
      insurance_id: data.insurance_id || '',
      medical_history: data.medical_history || '',
      patient_id_number: data.patient_id_number || '',
      other_condition: '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form }
    if (form.primary_condition === 'other' && form.other_condition?.trim()) {
      payload.primary_condition = form.other_condition.trim()
    }
    await updateProfile(userId, payload)
    setSaving(false)
    setEditing(false)
    refetch()
  }

  function handleExport() {
    if (!data) return
    const lines = [
      'CareCompanion — Patient Profile Export',
      '========================================',
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Patient ID: ${data.patient_id_number || 'N/A'}`,
      `Member Since: ${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}`,
      '',
      'PERSONAL INFORMATION',
      `Phone: ${data.phone || 'N/A'}`,
      `Date of Birth: ${data.date_of_birth || 'N/A'}`,
      `Gender: ${data.gender || 'N/A'}`,
      `Location: ${data.location || 'N/A'}`,
      '',
      'MEDICAL INFORMATION',
      `Primary Condition: ${CONDITIONS[data.primary_condition] || data.primary_condition || 'N/A'}`,
      `Insurance ID: ${data.insurance_id || 'N/A'}`,
      `Medical History: ${data.medical_history || 'N/A'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'carecompanion-profile.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 9,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  function inp(key: string, type = 'text', placeholder = '') {
    return (
      <input type={type} style={inputStyle} placeholder={placeholder}
        value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }} />
    )
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profile…</p>
  if (!data) return <p style={{ color: 'var(--danger)', fontSize: 14 }}>Could not load profile.</p>

  return (
    <div style={{ maxWidth: 720, animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Profile header card */}
      <div style={{
        background: 'linear-gradient(120deg, var(--navy) 0%, var(--navy-mid) 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 22,
        color: '#fff', boxShadow: '0 4px 20px rgba(10,37,64,0.2)',
      }}>
        <img src={user!.picture} alt={user!.name} style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.3)', flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{data.name}</h2>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>{data.email}</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>🪪 {data.patient_id_number || 'Patient ID pending'}</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>📅 Member since {data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</span>
            {data.primary_condition && (
              <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 10px' }}>
                🏥 {CONDITIONS[data.primary_condition] || data.primary_condition}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleExport} style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 500,
            color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Export
          </button>
          <button onClick={editing ? handleSave : startEdit} disabled={saving} style={{
            background: editing ? '#fff' : 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 600,
            color: editing ? 'var(--navy)' : '#fff', cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            {saving ? 'Saving…' : editing ? '✓ Save' : '✏️ Edit'}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 9, padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>Cancel</button>
          )}
        </div>
      </div>

      {/* Personal Info */}
      <Section title="Personal Information">
        <Row label="Full Name" value={data.name} editing={editing} input={inp('name')} />
        <Row label="Email" value={data.email} editing={false} />
        <Row label="Phone" value={data.phone} editing={editing} input={inp('phone', 'tel', '+1 (555) 000-0000')} />
        <Row label="Date of Birth" value={data.date_of_birth} editing={editing} input={inp('date_of_birth', 'date')} />
        <Row label="Gender" value={data.gender} editing={editing} input={
          <select style={inputStyle} value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        } />
        <Row label="Location" value={data.location} editing={editing} input={inp('location', 'text', 'City, State')} />
      </Section>

      {/* Medical Info */}
      <Section title="Medical & Insurance Information">
        <Row label="Patient ID" value={data.patient_id_number} editing={editing} input={inp('patient_id_number')} />
        <Row label="Insurance ID" value={data.insurance_id} editing={editing} input={inp('insurance_id', 'text', 'e.g. BCBS-123456')} />
        <Row label="Primary Condition" value={CONDITIONS[data.primary_condition] || data.primary_condition} editing={editing} input={
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select style={inputStyle} value={form.primary_condition || ''} onChange={e => setForm(f => ({ ...f, primary_condition: e.target.value }))}>
              <option value="">Select…</option>
              {Object.entries(CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {form.primary_condition === 'other' && (
              <input style={inputStyle} placeholder="Please specify your condition…"
                value={form.other_condition || ''}
                onChange={e => setForm(f => ({ ...f, other_condition: e.target.value }))} />
            )}
          </div>
        } />
        <div style={{ marginBottom: editing ? 14 : 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Medical History & Conditions</span>
          {editing ? (
            <textarea
              value={form.medical_history || ''}
              onChange={e => setForm(f => ({ ...f, medical_history: e.target.value }))}
              placeholder="e.g. Hypertension, Type 2 Diabetes, previous surgeries…"
              rows={3}
              style={{
                width: '100%', background: 'var(--surface-2)',
                border: '1.5px solid var(--border)', borderRadius: 9,
                padding: '9px 12px', fontSize: 13, color: 'var(--text)',
                fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          ) : (
            <p style={{ fontSize: 14, color: data.medical_history ? 'var(--text)' : 'var(--text-light)' }}>
              {data.medical_history || 'No medical history recorded.'}
            </p>
          )}
        </div>
      </Section>

      {/* Reminder Preferences */}
      <Section title="Notification Preferences">
        <Row label="Reminder Method" value={data.reminder_preference ? data.reminder_preference.toUpperCase() : null} editing={false} />
        <Row label="Preferred Time" value={data.preferred_time} editing={false} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          To update notification preferences, please contact support.
        </p>
      </Section>
    </div>
  )
}
