import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getSummaries, createSummary, updateSummary } from '../api/summaries'

interface Summary {
  summary_id: number; title: string; ai_summary: string;
  user_notes: string | null; visit_date: string | null; created_at: string;
}

export default function Summaries() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getSummaries(userId), [userId])

  const [expanded, setExpanded] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [showGen, setShowGen] = useState(false)
  const [genForm, setGenForm] = useState({ title: '', visit_date: '' })
  const [generating, setGenerating] = useState(false)

  const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>()

  function handleNotesChange(summaryId: number, val: string) {
    setNotes(prev => ({ ...prev, [summaryId]: val }))
    if (debounceTimers.has(summaryId)) clearTimeout(debounceTimers.get(summaryId)!)
    const timer = setTimeout(async () => {
      setSaving(prev => ({ ...prev, [summaryId]: true }))
      await updateSummary(summaryId, { user_notes: val })
      setSaving(prev => ({ ...prev, [summaryId]: false }))
    }, 1200)
    debounceTimers.set(summaryId, timer)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    try {
      await createSummary({
        user_id: userId,
        title: genForm.title || 'Visit Summary',
        visit_date: genForm.visit_date || undefined,
      })
      setGenForm({ title: '', visit_date: '' })
      setShowGen(false)
      refetch()
    } finally {
      setGenerating(false)
    }
  }

  const summaries: Summary[] = data?.summaries ?? []

  const getNotes = useCallback((s: Summary) =>
    notes[s.summary_id] !== undefined ? notes[s.summary_id] : (s.user_notes || ''), [notes])

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '9px 13px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 860, animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {summaries.length} visit {summaries.length === 1 ? 'summary' : 'summaries'} on record
          </p>
        </div>
        <button onClick={() => setShowGen(!showGen)} style={{
          background: showGen ? 'var(--surface-2)' : 'var(--navy)',
          color: showGen ? 'var(--text-muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {showGen ? 'Cancel' : '✨ Generate New Summary'}
        </button>
      </div>

      {/* Generate form */}
      {showGen && (
        <form onSubmit={handleGenerate} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 16 }}>
            Generate AI Visit Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Title</label>
              <input style={inputStyle} placeholder="e.g. Week 3 Recovery Check-in"
                value={genForm.title} onChange={e => setGenForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Visit Date</label>
              <input style={inputStyle} type="date"
                value={genForm.visit_date} onChange={e => setGenForm(f => ({ ...f, visit_date: e.target.value }))} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            The AI will generate a summary based on your logged symptoms, medications, and appointments.
          </p>
          <button type="submit" disabled={generating} style={{
            background: generating ? 'var(--border)' : 'var(--navy)',
            color: generating ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 10, padding: '11px 24px',
            fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {generating ? '⏳ Generating summary…' : '✨ Generate Summary'}
          </button>
        </form>
      )}

      {/* Summaries */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading summaries…</p>
      ) : summaries.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '60px 40px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📊</div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>No summaries yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Generate your first AI visit summary to prepare for your next doctor's appointment.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {summaries.map(s => (
            <div key={s.summary_id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Card header */}
              <button
                onClick={() => setExpanded(expanded === s.summary_id ? null : s.summary_id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 22px', background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', marginBottom: 4, fontFamily: 'var(--font-heading)' }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                    {s.visit_date && <span>📅 {new Date(s.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    <span>Generated {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--text-muted)', transform: expanded === s.summary_id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
              </button>

              {/* Expanded content */}
              {expanded === s.summary_id && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: '20px 22px', background: 'var(--surface-2)' }}>
                  {/* AI summary */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>✨ AI Summary</span>
                      <span style={{
                        background: 'var(--blue-light)', color: 'var(--accent)',
                        border: '1px solid var(--blue-mid)', borderRadius: 20,
                        padding: '2px 10px', fontSize: 10, fontWeight: 600,
                      }}>AI Generated</span>
                    </div>
                    <div style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '14px 16px',
                      fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.75,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {s.ai_summary || 'No AI summary available.'}
                    </div>
                  </div>

                  {/* User notes */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>📝 My Notes</span>
                      {saving[s.summary_id] && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span>}
                    </div>
                    <textarea
                      value={getNotes(s)}
                      onChange={e => handleNotesChange(s.summary_id, e.target.value)}
                      placeholder="Add your own notes, doctor's comments, or reminders…"
                      rows={4}
                      style={{
                        width: '100%', background: 'var(--surface)',
                        border: '1.5px solid var(--border)', borderRadius: 10,
                        padding: '12px 14px', fontSize: 13, color: 'var(--text)',
                        fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical',
                        lineHeight: 1.6, transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 6 }}>Notes auto-save as you type.</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
