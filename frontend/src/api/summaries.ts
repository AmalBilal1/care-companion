export async function getSummaries(userId: number) {
  const res = await fetch(`/summaries/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function createSummary(payload: { user_id: number; title?: string; visit_date?: string }) {
  const res = await fetch('/summaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateSummary(summaryId: number, fields: { user_notes?: string; title?: string }) {
  const res = await fetch(`/summaries/${summaryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
