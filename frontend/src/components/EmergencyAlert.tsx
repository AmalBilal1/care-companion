interface EmergencyAlertProps {
  onDismiss: () => void
}

export default function EmergencyAlert({ onDismiss }: EmergencyAlertProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10,37,64,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '2px solid var(--danger)',
        borderRadius: 24,
        padding: '44px 36px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        animation: 'scaleIn 0.25s ease',
        boxShadow: '0 20px 60px rgba(220,38,38,0.2)',
      }}>
        <div style={{
          width: 72, height: 72,
          background: 'var(--danger-bg)',
          border: '2px solid var(--danger-border)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
          margin: '0 auto 20px',
        }}>
          🚨
        </div>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--danger)',
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 12,
          letterSpacing: '-0.3px',
        }}>
          Emergency Alert
        </h2>

        <p style={{
          color: 'var(--text-mid)',
          fontSize: 15,
          lineHeight: 1.7,
          marginBottom: 32,
        }}>
          Your symptoms may require <strong>immediate medical attention</strong>. Please call 911 or go to your nearest emergency room right away.
        </p>

        <a href="tel:911" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--danger)',
          color: '#fff',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: 17,
          padding: '16px 24px',
          borderRadius: 12,
          textDecoration: 'none',
          marginBottom: 14,
          boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
          transition: 'all 0.15s',
          letterSpacing: '0.2px',
        }}>
          📞 Call 911 Now
        </a>

        <button onClick={onDismiss} style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          padding: '4px 8px',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          I'm safe — dismiss
        </button>
      </div>
    </div>
  )
}
