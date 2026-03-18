interface QuickActionsProps {
  onSelect: (message: string) => void
  disabled: boolean
}

const ACTIONS = [
  { label: '🩺 Symptoms',   message: 'I want to log a symptom' },
  { label: '💊 Medications', message: 'Show me my medication schedule' },
  { label: '📅 Appointments',message: 'What are my upcoming appointments?' },
  { label: '📊 Summary',    message: 'Generate a visit summary for my doctor' },
  { label: '👤 My Profile', message: 'Tell me about my care plan' },
]

export default function QuickActions({ onSelect, disabled }: QuickActionsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap',
      marginBottom: 10,
    }}>
      {ACTIONS.map(action => (
        <button
          key={action.label}
          disabled={disabled}
          onClick={() => onSelect(action.message)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '6px 14px',
            color: 'var(--text-mid)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-sm)',
          }}
          onMouseEnter={e => {
            if (!disabled) {
              (e.target as HTMLElement).style.background = 'var(--blue-light)'
              ;(e.target as HTMLElement).style.borderColor = 'var(--blue-mid)'
              ;(e.target as HTMLElement).style.color = 'var(--accent)'
            }
          }}
          onMouseLeave={e => {
            ;(e.target as HTMLElement).style.background = 'var(--surface)'
            ;(e.target as HTMLElement).style.borderColor = 'var(--border)'
            ;(e.target as HTMLElement).style.color = 'var(--text-mid)'
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
