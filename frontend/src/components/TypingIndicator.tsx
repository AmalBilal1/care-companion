export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}
         className="fade-up">
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-light)', padding: '0 4px' }}>
        CareCompanion
      </span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px 16px 16px 4px',
        boxShadow: 'var(--shadow-sm)',
        width: 'fit-content',
      }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <span key={i} style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'inline-block',
            animation: `bounce 1.3s ease-in-out ${delay}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}
