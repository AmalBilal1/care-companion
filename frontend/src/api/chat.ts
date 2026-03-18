export async function sendChatMessage(
  message: string,
  userEmail?: string,
  userName?: string,
): Promise<string> {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, user_email: userEmail, user_name: userName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  const data = await res.json()
  return data.response
}
