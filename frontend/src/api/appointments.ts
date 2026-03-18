export async function getAppointments(userId: number) {
  const res = await fetch(`/appointments/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function addAppointment(payload: {
  user_id: number; appointment_time: string; reason: string;
  location?: string; appointment_type?: string; status?: string; source?: string
}) {
  const res = await fetch('/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateAppointment(id: number, fields: Record<string, string>) {
  const res = await fetch(`/appointments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
