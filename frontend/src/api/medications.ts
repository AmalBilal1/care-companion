export async function getMedications(userId: number) {
  const res = await fetch(`/medications/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function markMedicationTaken(userId: number, medicationId: number) {
  const res = await fetch(`/medications/${userId}/taken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medication_id: medicationId }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function addMedication(payload: {
  user_id: number; medication_name: string; dosage?: string;
  schedule?: string; start_date?: string; end_date?: string
}) {
  const res = await fetch('/medications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function getMedicationInfo(name: string) {
  const res = await fetch(`/medication-info/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}
