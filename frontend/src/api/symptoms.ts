export async function getSymptoms(userId: number) {
  const now = new Date()
  const localDate = now.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const utcOffset = -Math.round(now.getTimezoneOffset() / 60) // e.g. EST = -5
  const res = await fetch(`/symptoms/${userId}?local_date=${localDate}&utc_offset=${utcOffset}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function logSymptom(userId: number, payload: { symptom: string; severity: number; condition_type?: string }) {
  const res = await fetch(`/symptoms/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
