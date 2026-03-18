interface StatusPillProps {
  online: boolean
}

export default function StatusPill({ online }: StatusPillProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: online ? '#f0fdf4' : 'var(--surface-2)',
      border: `1px solid ${online ? '#bbf7d0' : 'var(--border)'}`,
      borderRadius: 20,
      padding: '4px 12px',
      fontSize: 11,
      fontWeight: 500,
      color: online ? '#15803d' : 'var(--text-muted)',
      letterSpacing: '0.2px',
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: '50%',
        background: online ? '#22c55e' : 'var(--text-light)',
        display: 'inline-block',
        animation: online ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />
      {online ? 'Connected' : 'Offline'}
    </div>
  )
}
