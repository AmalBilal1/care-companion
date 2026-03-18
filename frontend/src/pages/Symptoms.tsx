import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getSymptoms, logSymptom } from '../api/symptoms'
import { WARNING_SIGNS } from '../lib/warningData'
import EmergencyAlert from '../components/EmergencyAlert'

const CONDITIONS = [
  { value: 'cardiac_surgery', label: 'Cardiac Surgery' },
  { value: 'joint_replacement', label: 'Joint Replacement' },
  { value: 'abdominal_surgery', label: 'Abdominal Surgery' },
  { value: 'pneumonia', label: 'Pneumonia' },
  { value: 'heart_failure', label: 'Heart Failure' },
  { value: 'stroke', label: 'Stroke' },
  { value: 'general_surgery', label: 'General Surgery' },
]

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Very mild', 2: 'Mild', 3: 'Mild-moderate', 4: 'Moderate',
  5: 'Noticeable', 6: 'Moderately severe', 7: 'Severe',
  8: 'Very severe', 9: 'Extreme', 10: 'Worst possible',
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '22px 24px', marginBottom: 20,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 18 }}>{title}</h3>
      {children}
    </div>
  )
}

export default function Symptoms() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getSymptoms(userId), [userId])

  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState(3)
  const [conditionType, setConditionType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [assessment, setAssessment] = useState<{ level: string; reason: string } | null>(null)
  const [showEmergency, setShowEmergency] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '10px 14px', fontSize: 14, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    if (!symptom.trim()) return
    setSubmitting(true)
    setAssessment(null)
    try {
      const res = await logSymptom(userId, { symptom, severity, condition_type: conditionType || undefined })
      setAssessment({ level: res.assessment_level, reason: res.assessment_reason })
      if (res.assessment_level === 'emergency') setShowEmergency(true)
      setSymptom('')
      setSeverity(3)
      refetch()
    } finally {
      setSubmitting(false)
    }
  }

  const sevColor = severity <= 3 ? '#22c55e' : severity <= 6 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ maxWidth: 820, animation: 'fadeUp 0.35s ease forwards' }}>
      {showEmergency && <EmergencyAlert onDismiss={() => setShowEmergency(false)} />}

      {/* Log form */}
      <Card title="Log a Symptom">
        <form onSubmit={handleLog}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Symptom *</label>
              <input style={inputStyle} placeholder="e.g. chest tightness, fatigue…"
                value={symptom} onChange={e => setSymptom(e.target.value)} required
                onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Condition Type</label>
              <select style={inputStyle} value={conditionType} onChange={e => setConditionType(e.target.value)}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}>
                <option value="">General</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Severity slider */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Severity</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: sevColor }}>
                {severity}/10 — {SEVERITY_LABELS[severity]}
              </span>
            </div>
            <input type="range" min={1} max={10} value={severity}
              onChange={e => setSeverity(Number(e.target.value))}
              style={{ width: '100%', accentColor: sevColor }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
              <span>1 — Mild</span><span>5 — Moderate</span><span>10 — Severe</span>
            </div>
          </div>

          {/* Assessment result */}
          {assessment && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
              background: assessment.level === 'emergency' ? 'var(--danger-bg)' : assessment.level === 'urgent' ? '#fffbeb' : assessment.level === 'monitor' ? '#eff6ff' : '#f0fdf4',
              border: `1px solid ${assessment.level === 'emergency' ? 'var(--danger-border)' : assessment.level === 'urgent' ? '#fde68a' : assessment.level === 'monitor' ? 'var(--blue-mid)' : '#bbf7d0'}`,
              color: assessment.level === 'emergency' ? 'var(--danger)' : assessment.level === 'urgent' ? '#92400e' : assessment.level === 'monitor' ? 'var(--accent)' : '#15803d',
            }}>
              <strong>{assessment.level === 'emergency' ? '🚨 Emergency' : assessment.level === 'urgent' ? '⚠️ Urgent' : assessment.level === 'monitor' ? '📊 Monitor' : '✅ Normal'}</strong>
              {' — '}{assessment.reason}
            </div>
          )}

          <button type="submit" disabled={submitting || !symptom.trim()} style={{
            background: submitting || !symptom.trim() ? 'var(--border)' : 'var(--navy)',
            color: submitting || !symptom.trim() ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 10, padding: '11px 28px',
            fontSize: 14, fontWeight: 600, cursor: submitting || !symptom.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
            {submitting ? 'Logging…' : 'Log Symptom'}
          </button>
        </form>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Today's symptoms */}
        <Card title={`Today's Symptoms (${data?.today?.length ?? 0})`}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : data?.today?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No symptoms logged today. You're doing great!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data?.today?.map((s: { symptom_id: number; symptom: string; severity: number; logged_at: string }) => {
                const col = s.severity <= 3 ? '#22c55e' : s.severity <= 6 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={s.symptom_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', background: 'var(--surface-2)',
                    border: '1px solid var(--border-light)', borderRadius: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: `${col}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: col, flexShrink: 0,
                    }}>{s.severity}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy)' }}>{s.symptom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(s.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* 7-day trend */}
        <Card title="7-Day Trend">
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.trend ?? []} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip formatter={(v) => [`${v}/10`, 'Avg Severity']}
                  labelFormatter={d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
                <Bar dataKey="avg_severity" radius={[4, 4, 0, 0]}>
                  {(data?.trend ?? []).map((entry: { avg_severity: number }, i: number) => (
                    <Cell key={i} fill={entry.avg_severity <= 3 ? '#22c55e' : entry.avg_severity <= 6 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Warning signs */}
      {conditionType && WARNING_SIGNS[conditionType] && (
        <Card title={`⚠️ Warning Signs — ${CONDITIONS.find(c => c.value === conditionType)?.label}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { key: 'emergency_signs', label: '🚨 Emergency', bg: 'var(--danger-bg)', border: 'var(--danger-border)', color: 'var(--danger)' },
              { key: 'urgent_signs',    label: '⚠️ Urgent',    bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
              { key: 'expected_symptoms', label: '✅ Expected', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
            ].map(({ key, label, bg, border, color }) => (
              <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>{label}</p>
                {(WARNING_SIGNS[conditionType][key] as string[]).map((s: string, i: number) => (
                  <p key={i} style={{ fontSize: 12, color, lineHeight: 1.5, marginBottom: 4 }}>• {s}</p>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
