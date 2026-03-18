export async function getSymptoms(userId: number) {
  const res = await fetch(`/symptoms/${userId}`)
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
