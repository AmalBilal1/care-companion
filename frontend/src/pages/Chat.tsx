import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import ChatBubble from '../components/ChatBubble'
import TypingIndicator from '../components/TypingIndicator'
import EmergencyAlert from '../components/EmergencyAlert'
import QuickActions from '../components/QuickActions'

export default function Chat() {
  const { user } = useAuth()
  const { messages, isLoading, isEmergency, sendMessage, dismissEmergency } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadBanner, setUploadBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    sendMessage(text)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadBanner({ type: 'error', text: 'Only PDF files are supported.' })
      return
    }
    setUploading(true)
    setUploadBanner(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('user_id', String(user!.userId))
      const res = await fetch('/upload-discharge', { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed.')
      const data = await res.json()
      setUploadBanner({
        type: 'success',
        text: `✅ Discharge processed: ${data.medications_added} medication${data.medications_added !== 1 ? 's' : ''}, ${data.appointments_scheduled} appointment${data.appointments_scheduled !== 1 ? 's' : ''}, ${data.instructions_saved} instructions added.`,
      })
    } catch (err) {
      setUploadBanner({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      margin: '-28px -32px',
      animation: 'fadeUp 0.35s ease forwards',
    }}>
      {isEmergency && <EmergencyAlert onDismiss={dismissEmergency} />}

      {/* Upload banner */}
      {uploadBanner && (
        <div style={{
          padding: '12px 20px', margin: '12px 20px 0',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          background: uploadBanner.type === 'success' ? '#f0fdf4' : 'var(--danger-bg)',
          border: `1px solid ${uploadBanner.type === 'success' ? '#bbf7d0' : 'var(--danger-border)'}`,
          color: uploadBanner.type === 'success' ? '#15803d' : 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{uploadBanner.text}</span>
          <button onClick={() => setUploadBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', marginLeft: 12 }}>×</button>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '24px 20px 16px',
        display: 'flex', flexDirection: 'column', gap: 18,
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '60px 20px', gap: 14,
            animation: 'fadeUp 0.4s ease forwards',
          }}>
            <div style={{
              width: 72, height: 72, background: 'var(--blue-light)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>💬</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--navy)' }}>
              How can I help you today?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.75 }}>
              Ask about your medications, log symptoms, schedule appointments, or upload your discharge papers.
            </p>
          </div>
        ) : (
          messages.map(msg => <ChatBubble key={msg.id} message={msg} />)
        )}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '12px 20px 18px',
        boxShadow: '0 -4px 20px rgba(10,37,64,0.05)',
      }}>
        <QuickActions onSelect={msg => sendMessage(msg)} disabled={isLoading} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* PDF upload button */}
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload discharge papers (PDF)"
            style={{
              width: 44, height: 44, borderRadius: 11, flexShrink: 0,
              background: 'var(--surface-2)', border: '1.5px solid var(--border)',
              cursor: uploading ? 'wait' : 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', opacity: uploading ? 0.6 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--blue-light)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)' }}
          >
            {uploading ? '⏳' : '📎'}
          </button>

          <textarea
            ref={inputRef} value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your recovery, medications, appointments…"
            rows={1}
            style={{
              flex: 1, background: 'var(--surface-2)',
              border: '1.5px solid var(--border)', borderRadius: 12,
              padding: '11px 14px', color: 'var(--text)',
              fontFamily: 'var(--font-body)', fontSize: 14,
              outline: 'none', resize: 'none',
              minHeight: 44, maxHeight: 140, lineHeight: 1.55,
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(30,111,168,0.1)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
          />
          <button
            onClick={handleSend} disabled={isLoading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 11,
              background: isLoading || !input.trim() ? 'var(--border)' : 'var(--navy)',
              border: 'none', cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, opacity: isLoading || !input.trim() ? 0.5 : 1, transition: 'all 0.15s',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={isLoading || !input.trim() ? 'var(--text-light)' : '#fff'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8, textAlign: 'center' }}>
          📎 Upload discharge PDF · Enter to send · Not a substitute for medical advice
        </p>
      </div>
    </div>
  )
}
