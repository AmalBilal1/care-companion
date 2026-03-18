import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { getMedications, markMedicationTaken, addMedication, getMedicationInfo } from '../api/medications'

interface Medication {
  medication_id: number; medication_name: string; dosage: string;
  schedule: string; taken_today: boolean; next_dose_time: string | null;
  start_date: string | null; end_date: string | null;
}

interface MedInfo {
  found: boolean; purpose?: string; common_side_effects?: string;
  warnings?: string; food_instructions?: string;
}

export default function Medications() {
  const { user } = useAuth()
  const userId = user!.userId
  const { data, loading, refetch } = useApi(() => getMedications(userId), [userId])

  const [showAdd, setShowAdd] = useState(false)
  const [expandedInfo, setExpandedInfo] = useState<Record<number, MedInfo | null>>({})
  const [addForm, setAddForm] = useState({ medication_name: '', dosage: '', schedule: '', start_date: '', end_date: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [takingId, setTakingId] = useState<number | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '9px 13px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font-body)', outline: 'none',
  }

  async function handleTake(med: Medication) {
    if (med.taken_today || takingId === med.medication_id) return
    setTakingId(med.medication_id)
    await markMedicationTaken(userId, med.medication_id)
    refetch()
    setTakingId(null)
  }

  async function handleInfo(med: Medication) {
    if (expandedInfo[med.medication_id] !== undefined) {
      setExpandedInfo(prev => { const n = { ...prev }; delete n[med.medication_id]; return n })
      return
    }
    setExpandedInfo(prev => ({ ...prev, [med.medication_id]: null }))
    const info = await getMedicationInfo(med.medication_name)
    setExpandedInfo(prev => ({ ...prev, [med.medication_id]: info }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.medication_name.trim()) return
    setAddLoading(true)
    await addMedication({ user_id: userId, ...addForm })
    setAddForm({ medication_name: '', dosage: '', schedule: '', start_date: '', end_date: '' })
    setShowAdd(false)
    setAddLoading(false)
    refetch()
  }

  const meds: Medication[] = data?.medications ?? []
  const taken = meds.filter(m => m.taken_today).length

  return (
    <div style={{ maxWidth: 760, animation: 'fadeUp 0.35s ease forwards' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '16px 22px', marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Today's progress</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-heading)' }}>
            {taken} / {meds.length} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>medications taken</span>
          </p>
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: taken === meds.length && meds.length > 0 ? '#f0fdf4' : 'var(--blue-light)',
          border: `3px solid ${taken === meds.length && meds.length > 0 ? '#22c55e' : 'var(--blue-mid)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {taken === meds.length && meds.length > 0 ? '✅' : '💊'}
        </div>
      </div>

      {/* Medications list */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>
            My Medications
          </h3>
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: showAdd ? 'var(--surface-2)' : 'var(--navy)',
            color: showAdd ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 8, padding: '7px 16px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {showAdd ? 'Cancel' : '+ Add Medication'}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border-light)',
            borderRadius: 12, padding: '16px', marginBottom: 18,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Name *</label>
                <input style={inputStyle} placeholder="e.g. Metoprolol"
                  value={addForm.medication_name} onChange={e => setAddForm(f => ({ ...f, medication_name: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Dosage</label>
                <input style={inputStyle} placeholder="e.g. 25mg"
                  value={addForm.dosage} onChange={e => setAddForm(f => ({ ...f, dosage: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Schedule</label>
                <input style={inputStyle} placeholder="e.g. twice daily"
                  value={addForm.schedule} onChange={e => setAddForm(f => ({ ...f, schedule: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Start Date</label>
                <input style={inputStyle} type="date"
                  value={addForm.start_date} onChange={e => setAddForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>End Date</label>
                <input style={inputStyle} type="date"
                  value={addForm.end_date} onChange={e => setAddForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={addLoading} style={{
              background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              {addLoading ? 'Saving…' : 'Save Medication'}
            </button>
          </form>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading medications…</p>
        ) : meds.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No medications added yet. Add your first one above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meds.map(med => (
              <div key={med.medication_id}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  background: med.taken_today ? '#f0fdf4' : 'var(--surface-2)',
                  border: `1px solid ${med.taken_today ? '#bbf7d0' : 'var(--border-light)'}`,
                  borderRadius: 12, transition: 'all 0.2s',
                  opacity: med.taken_today ? 0.8 : 1,
                }}>
                  {/* Checkbox */}
                  <button onClick={() => handleTake(med)} disabled={med.taken_today || takingId === med.medication_id}
                    style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: med.taken_today ? '#22c55e' : 'var(--surface)',
                      border: `2px solid ${med.taken_today ? '#22c55e' : 'var(--border)'}`,
                      cursor: med.taken_today ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, transition: 'all 0.15s',
                    }}>
                    {med.taken_today ? '✓' : takingId === med.medication_id ? '…' : ''}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: med.taken_today ? '#15803d' : 'var(--navy)', textDecoration: med.taken_today ? 'line-through' : 'none' }}>
                      {med.medication_name} {med.dosage && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {med.dosage}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {med.schedule}{med.next_dose_time && !med.taken_today && ` · Next dose: ${med.next_dose_time}`}
                    </div>
                  </div>

                  <button onClick={() => handleInfo(med)} style={{
                    background: expandedInfo[med.medication_id] !== undefined ? 'var(--blue-light)' : 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '5px 12px', fontSize: 12, fontWeight: 500,
                    color: expandedInfo[med.medication_id] !== undefined ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}>
                    {expandedInfo[med.medication_id] !== undefined ? 'Hide' : 'Info'}
                  </button>
                </div>

                {/* Info panel */}
                {expandedInfo[med.medication_id] !== undefined && (
                  <div style={{
                    margin: '-4px 0 0', padding: '14px 16px',
                    background: 'var(--blue-light)', border: '1px solid var(--blue-mid)',
                    borderTop: 'none', borderRadius: '0 0 12px 12px', fontSize: 13,
                  }}>
                    {expandedInfo[med.medication_id] === null ? (
                      <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
                    ) : expandedInfo[med.medication_id]?.found === false ? (
                      <span style={{ color: 'var(--text-muted)' }}>No reference info found for this medication.</span>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          ['Purpose', expandedInfo[med.medication_id]?.purpose],
                          ['Side Effects', expandedInfo[med.medication_id]?.common_side_effects],
                          ['⚠️ Warnings', expandedInfo[med.medication_id]?.warnings],
                          ['🍽️ With Food', expandedInfo[med.medication_id]?.food_instructions],
                        ].map(([label, val]) => val && (
                          <div key={label as string}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>{label as string}</p>
                            <p style={{ color: 'var(--text-mid)', lineHeight: 1.5 }}>{val as string}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
