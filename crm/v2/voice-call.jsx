/* global React */
// Voice Call UI — Incoming / Active / Keypad

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

function VcHeader({ status, statusColor, glow, name = 'Sarah M', phone = '(864) 555-0101', small = false, timer }) {
  return (
    <div style={{
      padding: small ? '14px 16px 8px' : '20px 20px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: small ? 6 : 10,
      borderBottom: '1px solid rgba(0,0,0,.1)',
    }}>
      {!small && (
        <div style={{
          width: 112, height: 112,
          background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
          display: 'grid', placeItems: 'center',
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'var(--font-chrome)', fontWeight: 700,
            color: 'var(--gold)', fontSize: 34, letterSpacing: '.04em',
          }}>SM</span>
        </div>
      )}
      {small && (
        <div style={{
          width: 48, height: 48,
          background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-chrome)', fontWeight: 700, color: 'var(--gold)', fontSize: 16 }}>SM</span>
        </div>
      )}
      <span style={{ fontFamily: 'var(--font-body)', fontSize: small ? 16 : 20, fontWeight: 700, color: 'var(--text)' }}>
        {name}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
        {phone}
      </span>
      <span style={{
        marginTop: 4, padding: '3px 10px',
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: statusColor, textShadow: glow,
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.12em',
        animation: status === 'INCOMING CALL' ? 'ringPulse 800ms steps(4) infinite' : 'none',
      }}>{status}</span>
      {timer && (
        <span style={{
          marginTop: 4,
          padding: '6px 14px',
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
          fontFamily: 'var(--font-pixel)', fontSize: 36, letterSpacing: '.06em',
        }}>{timer}</span>
      )}
    </div>
  );
}

function RingCard() {
  return (
    <div style={{
      width: 320, height: 480,
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes ringPulse { 0%,49%{opacity:1} 50%,100%{opacity:.35} }
      `}</style>
      <VcHeader
        status="INCOMING CALL"
        statusColor="var(--lcd-red)"
        glow="var(--lcd-glow-red)"
      />
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: 16,
      }}>
        <button style={{
          width: 72, height: 72, clipPath: 'var(--avatar-clip)',
          background: 'var(--ms-3)', color: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: 'inset 3px 3px 0 rgba(255,255,255,.25), inset -3px -3px 0 rgba(0,0,0,.35)',
        }}>{VcIcons.decline}</button>
        <button style={{
          width: 72, height: 72, clipPath: 'var(--avatar-clip)',
          background: 'var(--ms-2)', color: '#fff',
          display: 'grid', placeItems: 'center',
          boxShadow: 'inset 3px 3px 0 rgba(255,255,255,.25), inset -3px -3px 0 rgba(0,0,0,.35)',
          animation: 'ringPulse 800ms steps(4) infinite',
        }}>{VcIcons.accept}</button>
      </div>
    </div>
  );
}

function ActiveBtn({ icon, label, tone = 'flat' }) {
  const TONES = {
    flat: { bg: 'var(--card)',  fg: 'var(--text)' },
    red:  { bg: 'var(--ms-3)',  fg: '#fff' },
  };
  const t = TONES[tone];
  return (
    <button className="tactile-raised" style={{
      width: 56, height: 56,
      background: t.bg, color: t.fg,
      display: 'grid', placeItems: 'center', gridTemplateRows: '1fr auto',
      padding: 6, gap: 2,
    }}>
      <span style={{ display:'grid', placeItems:'center' }}>{icon}</span>
      <span className="chrome-label" style={{ fontSize: 8, letterSpacing: '.08em' }}>{label}</span>
    </button>
  );
}

function ActiveCard() {
  return (
    <div style={{
      width: 320, height: 480,
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      <VcHeader
        status="ON CALL"
        statusColor="var(--lcd-green)"
        glow="var(--lcd-glow-green)"
        timer="00:03:42"
      />
      <div style={{
        flex: 1, padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 10, justifyItems: 'center', alignItems: 'center',
      }}>
        <ActiveBtn icon={VcIcons.mute} label="MUTE" />
        <ActiveBtn icon={VcIcons.pad}  label="KEYPAD" />
        <ActiveBtn icon={VcIcons.spk}  label="SPEAKER" />
        <ActiveBtn icon={VcIcons.rec}  label="RECORD" />
        <ActiveBtn icon={VcIcons.hold} label="HOLD" />
        <ActiveBtn icon={VcIcons.hang} label="HANG UP" tone="red" />
      </div>
    </div>
  );
}

function DialKey({ num, letters }) {
  return (
    <button className="tactile-raised" style={{
      width: 72, height: 72,
      background: 'var(--card)', color: 'var(--text)',
      display: 'grid', placeItems: 'center', gridTemplateRows: '1fr auto',
      padding: '6px 4px', gap: 0,
    }}>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 30, color: 'var(--text)', lineHeight: 1 }}>{num}</span>
      <span className="chrome-label" style={{
        fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.16em',
      }}>{letters}</span>
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
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      <VcHeader
        small
        status="ON CALL"
        statusColor="var(--lcd-green)"
        glow="var(--lcd-glow-green)"
        timer="00:03:42"
      />
      <div style={{
        flex: 1, padding: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, justifyItems: 'center', alignItems: 'center',
      }}>
        {keys.map((k, i) => <DialKey key={i} num={k[0]} letters={k[1]} />)}
      </div>
      <button className="tactile-raised" style={{
        height: 44, margin: '0 12px 12px',
        background: 'var(--ms-3)', color: '#fff',
        fontFamily: 'var(--font-chrome)', fontWeight: 700, fontSize: 13,
        letterSpacing: '.14em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {VcIcons.hang} HANG UP
      </button>
    </div>
  );
}

Object.assign(window, { RingCard, ActiveCard, KeypadCard });
