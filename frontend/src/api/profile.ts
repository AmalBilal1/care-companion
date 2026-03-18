export async function getProfile(userId: number) {
  const res = await fetch(`/profile/${userId}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}

export async function updateProfile(userId: number, fields: Record<string, string | null>) {
  const res = await fetch(`/profile/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Error ${res.status}`)
  return res.json()
}
