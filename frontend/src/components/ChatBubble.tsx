import { type Message } from '../context/ChatContext'

export default function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isError = message.text.startsWith('⚠️')

  return (
    <div className="fade-up" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 5,
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-light)',
        padding: '0 4px',
        letterSpacing: '0.2px',
      }}>
        {isUser ? 'You' : 'CareCompanion'}
      </span>
      <div style={{
        maxWidth: '74%',
        padding: '11px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        fontSize: 14,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...(isUser
          ? {
              background: 'var(--navy)',
              color: '#fff',
              fontWeight: 400,
              boxShadow: '0 2px 8px rgba(10,37,64,0.18)',
            }
          : isError
          ? {
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
            }
          : {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }),
      }}>
        {message.text}
      </div>
    </div>
  )
}
