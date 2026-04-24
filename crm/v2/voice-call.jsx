/* global React */
// Voice Call UI — Incoming / Active / Keypad
// Brand-aligned 2026-04-24: retired LCD-red/green chrome status badges,
// stepped ringPulse animation, pixel timer, and chrome-label button
// labels. Replaces them with navy/gold status chips, smooth fades,
// JetBrains Mono timer, and clean Inter captions.

const VcIcons = {
  decline: <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>,
  accept:  <svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 5 L9 5 L11 10 L9 12 A8 8 0 0 0 12 15 L14 13 L19 15 L19 19 A1 1 0 0 1 18 20 A15 15 0 0 1 4 6 A1 1 0 0 1 5 5 Z"/></svg>,
  mute:    <svg viewBox="0 0 24 24" width="18" height="18"><rect x="9" y="4" width="6" height="10"/><path d="M6 12 A6 6 0 0 0 18 12 M12 18 L12 21 M8 21 L16 21"/></svg>,
  pad:     <svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="4" width="4" height="4"/><rect x="10" y="4" width="4" height="4"/><rect x="16" y="4" width="4" height="4"/><rect x="4" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="16" y="10" width="4" height="4"/><rect x="4" y="16" width="4" height="4"/><rect x="10" y="16" width="4" height="4"/><rect x="16" y="16" width="4" height="4"/></svg>,
  spk:     <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9 L4 15 L9 15 L14 19 L14 5 L9 9 Z M17 9 A4 4 0 0 1 17 15 M19 6 A7 7 0 0 1 19 18"/></svg>,
  rec:     <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="7"/></svg>,
  hold:    <svg viewBox="0 0 24 24" width="18" height="18"><rect x="8" y="5" width="3" height="14"/><rect x="13" y="5" width="3" height="14"/></svg>,
  hang:    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 12 A11 11 0 0 1 21 12 L19 15 L15 13 L15 10 A6 6 0 0 0 9 10 L9 13 L5 15 Z M6 6 L18 18"/></svg>,
};

function VcHeader({ status, tone = 'navy', name = 'Sarah M', phone = '(864) 555-0101', small = false, timer, isRinging = false }) {
  const avatarSize = small ? 56 : 104;
  return (
    <div style={{
      padding: small ? '16px 18px 12px' : '24px 24px 18px',
      background: 'var(--navy)',
      color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: small ? 8 : 12,
      borderRadius: small ? '0' : 'var(--radius-lg) var(--radius-lg) 0 0',
    }}>
      <div style={{
        width: avatarSize, height: avatarSize,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        boxShadow: isRinging ? '0 0 0 4px rgba(255,186,0,0.18), 0 0 0 8px rgba(255,186,0,0.08)' : 'none',
        transition: 'box-shadow 600ms var(--ease-in-out)',
        animation: isRinging ? 'vcRing 1.2s ease-in-out infinite' : 'none',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontWeight: 600,
          color: '#fff', fontSize: small ? 16 : 30,
          letterSpacing: '0.01em',
        }}>SM</span>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: small ? 16 : 22, color: '#fff',
        letterSpacing: '-0.01em',
      }}>{name}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'rgba(255,255,255,0.65)',
      }}>{phone}</span>
      <span style={{
        marginTop: 4, padding: '4px 12px',
        background: tone === 'green' ? 'color-mix(in srgb, var(--green) 22%, var(--navy))' : 'color-mix(in srgb, var(--gold) 22%, var(--navy))',
        color: tone === 'green' ? '#d3fae4' : 'var(--gold)',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        borderRadius: 'var(--radius-pill)',
      }}>{status}</span>
      {timer && (
        <span style={{
          marginTop: 6,
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 30,
          color: '#fff',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}>{timer}</span>
      )}
    </div>
  );
}

function RingCard() {
  return (
    <div style={{
      width: 320, height: 480,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-lg), var(--ring)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes vcRing {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>
      <VcHeader status="Incoming call" tone="gold" isRinging />
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 32, padding: 16,
        background: 'var(--card)',
      }}>
        <button aria-label="Decline call" style={{
          width: 72, height: 72,
          borderRadius: '50%',
          background: 'var(--red)', color: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--shadow-md)',
          border: 'none', cursor: 'pointer',
          transition: 'transform var(--dur-fast) var(--ease), background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--red)' }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >{VcIcons.decline}</button>
        <button aria-label="Accept call" style={{
          width: 72, height: 72,
          borderRadius: '50%',
          background: 'var(--green)', color: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
          border: 'none', cursor: 'pointer',
          animation: 'vcRing 1.2s ease-in-out infinite',
          transition: 'transform var(--dur-fast) var(--ease), background var(--dur) var(--ease)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--green)' }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >{VcIcons.accept}</button>
      </div>
    </div>
  );
}

function ActiveBtn({ icon, label, tone = 'flat', onClick, active = false }) {
  const TONES = {
    flat: { bg: 'var(--card)', fg: 'var(--text)',  hoverBg: 'var(--sunken)' },
    red:  { bg: 'var(--red)',  fg: '#fff',         hoverBg: '#b91c1c' },
    navy: { bg: 'var(--navy)', fg: '#fff',         hoverBg: '#0d2547' },
  };
  const t = TONES[tone];
  return (
    <button onClick={onClick} style={{
      width: 64, height: 64,
      background: active ? 'var(--navy)' : t.bg,
      color: active ? '#fff' : t.fg,
      borderRadius: '50%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 3,
      boxShadow: active ? 'var(--shadow-sm)' : 'var(--ring)',
      border: 'none', cursor: 'pointer',
      transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.hoverBg }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = t.bg }}
    >
      <span style={{ display:'grid', placeItems:'center', marginTop: 2 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 9,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        marginTop: -2,
      }}>{label}</span>
    </button>
  );
}

function ActiveCard() {
  return (
    <div style={{
      width: 320, height: 480,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-lg), var(--ring)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <VcHeader status="On call" tone="green" timer="00:03:42" />
      <div style={{
        flex: 1, padding: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 10, justifyItems: 'center', alignItems: 'center',
        background: 'var(--card)',
      }}>
        <ActiveBtn icon={VcIcons.mute} label="Mute" />
        <ActiveBtn icon={VcIcons.pad}  label="Keypad" />
        <ActiveBtn icon={VcIcons.spk}  label="Speaker" />
        <ActiveBtn icon={VcIcons.rec}  label="Record" />
        <ActiveBtn icon={VcIcons.hold} label="Hold" />
        <ActiveBtn icon={VcIcons.hang} label="End"  tone="red" />
      </div>
    </div>
  );
}

function DialKey({ num, letters }) {
  return (
    <button style={{
      width: 72, height: 72,
      background: 'var(--card)', color: 'var(--text)',
      borderRadius: '50%',
      boxShadow: 'var(--ring)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0,
      padding: '4px', border: 'none', cursor: 'pointer',
      transition: 'background var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--sunken)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
    onMouseDown={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
    onMouseUp={e => { e.currentTarget.style.boxShadow = 'var(--ring)' }}
    >
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26,
        letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1,
      }}>{num}</span>
      {letters && (
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 9,
          color: 'var(--text-muted)', letterSpacing: '0.14em', marginTop: 2,
        }}>{letters}</span>
      )}
    </button>
  );
}

function KeypadCard() {
  const keys = [
    ['1',''], ['2','ABC'], ['3','DEF'],
    ['4','GHI'], ['5','JKL'], ['6','MNO'],
    ['7','PQRS'], ['8','TUV'], ['9','WXYZ'],
    ['*',''], ['0','+'], ['#',''],
  ];
  return (
    <div style={{
      width: 320, height: 480,
      background: 'var(--card)',
      boxShadow: 'var(--shadow-lg), var(--ring)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <VcHeader small status="On call" tone="green" timer="00:03:42" />
      <div style={{
        flex: 1, padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, justifyItems: 'center', alignItems: 'center',
        background: 'var(--card)',
      }}>
        {keys.map((k, i) => <DialKey key={i} num={k[0]} letters={k[1]} />)}
      </div>
      <button style={{
        height: 48, margin: '0 14px 14px',
        background: 'var(--red)', color: '#fff',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
        letterSpacing: '0.01em',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--shadow-sm)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        border: 'none', cursor: 'pointer',
        transition: 'background var(--dur) var(--ease)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--red)' }}
      >
        {VcIcons.hang} End call
      </button>
    </div>
  );
}

Object.assign(window, { RingCard, ActiveCard, KeypadCard });
