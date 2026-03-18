import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CONDITIONS = [
  { value: 'cardiac_surgery',    label: 'Cardiac Surgery' },
  { value: 'joint_replacement',  label: 'Joint Replacement' },
  { value: 'abdominal_surgery',  label: 'Abdominal Surgery' },
  { value: 'pneumonia',          label: 'Pneumonia' },
  { value: 'heart_failure',      label: 'Heart Failure' },
  { value: 'stroke',             label: 'Stroke' },
  { value: 'general_surgery',    label: 'General Surgery' },
  { value: 'other',              label: 'Other' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-mid)',
  marginBottom: 6,
  display: 'block',
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export default function Onboard() {
  const { user, setOnboarded } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: '',
    date_of_birth: '',
    gender: '',
    primary_condition: '',
    other_condition: '',
    reminder_preference: 'email',
    preferred_time: '08:00',
    terms_agreed: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px rgba(30,111,168,0.1)'
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.terms_agreed) { setError('Please agree to the terms to continue.'); return }
    if (!form.primary_condition) { setError('Please select your primary condition.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = { ...form, user_id: user!.userId }
      if (form.primary_condition === 'other' && form.other_condition.trim()) {
        payload.primary_condition = form.other_condition.trim()
      }
      const res = await fetch('/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let detail = 'Failed to save profile.'
        try {
          const body = await res.json()
          detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        } catch {}
        throw new Error(detail)
      }
      setOnboarded(true)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #e8f4fd 0%, #f0f6fb 60%, #e6eef8 100%)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '44px 40px',
        maxWidth: 560,
        width: '100%',
        boxShadow: 'var(--shadow-lg)',
        animation: 'fadeUp 0.4s ease forwards',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--navy)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 16px',
          }}>🏥</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 24, fontWeight: 700,
            color: 'var(--navy)', marginBottom: 6,
          }}>
            Set up your profile
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Help us personalise your care experience. This takes about 2 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 14,
            padding: '20px 20px 4px',
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Personal Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Full Name">
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle} required />
              </Field>
              <Field label="Phone Number">
                <input style={inputStyle} type="tel" placeholder="+1 (555) 000-0000"
                  value={form.phone} onChange={e => set('phone', e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </Field>
              <Field label="Date of Birth">
                <input style={inputStyle} type="date" value={form.date_of_birth}
                  onChange={e => set('date_of_birth', e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </Field>
              <Field label="Gender">
                <select style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Step 2: Medical */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 14,
            padding: '20px 20px 4px',
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Medical Information</p>
            <Field label="Primary Condition *">
              <select style={inputStyle} value={form.primary_condition}
                onChange={e => set('primary_condition', e.target.value)}
                onFocus={focusStyle} onBlur={blurStyle} required>
                <option value="">Select your condition…</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            {form.primary_condition === 'other' && (
              <Field label="Please specify your condition">
                <input style={inputStyle} placeholder="e.g. COPD, Diabetes, Hypertension…"
                  value={form.other_condition} onChange={e => set('other_condition', e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </Field>
            )}
          </div>

          {/* Step 3: Reminders */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 14,
            padding: '20px 20px 4px',
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16 }}>Reminder Preferences</p>
            <Field label="Preferred Reminder Method">
              <div style={{ display: 'flex', gap: 10 }}>
                {['email', 'sms', 'push'].map(opt => (
                  <label key={opt} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '10px 14px',
                    border: `1.5px solid ${form.reminder_preference === opt ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: form.reminder_preference === opt ? 'var(--blue-light)' : 'var(--surface)',
                    color: form.reminder_preference === opt ? 'var(--accent)' : 'var(--text-mid)',
                    transition: 'all 0.15s', textTransform: 'capitalize',
                  }}>
                    <input type="radio" name="reminder" value={opt}
                      checked={form.reminder_preference === opt}
                      onChange={() => set('reminder_preference', opt)}
                      style={{ display: 'none' }} />
                    {opt === 'email' ? '📧' : opt === 'sms' ? '💬' : '🔔'} {opt.toUpperCase()}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Preferred Time for Reminders">
              <input style={inputStyle} type="time" value={form.preferred_time}
                onChange={e => set('preferred_time', e.target.value)}
                onFocus={focusStyle} onBlur={blurStyle} />
            </Field>
          </div>

          {/* Terms */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            marginBottom: 24, cursor: 'pointer',
          }}>
            <input type="checkbox" checked={form.terms_agreed}
              onChange={e => set('terms_agreed', e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              I agree to the <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Terms of Service</span> and{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Privacy Policy</span>. I understand this app supports but does not replace professional medical advice.
            </span>
          </label>

          {error && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              color: 'var(--danger)', borderRadius: 10, padding: '10px 14px',
              fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%',
            background: loading ? 'var(--border)' : 'var(--navy)',
            color: loading ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 12,
            padding: '15px', fontSize: 15, fontWeight: 600,
            fontFamily: 'var(--font-body)', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            boxShadow: loading ? 'none' : 'var(--shadow-sm)',
          }}>
            {loading ? 'Setting up your profile…' : 'Complete Setup →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-light)', marginTop: 14 }}>
            Already have an account?{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }}
              onClick={() => navigate('/login')}>Sign in</span>
          </p>
        </form>
      </div>
    </div>
  )
}
