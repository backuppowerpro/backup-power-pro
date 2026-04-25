/* global React */
// Morning Briefing — once-a-day modal

const BriefIcons = {
  x:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>,
  plus:   <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3 L8 13 M3 8 L13 8"/></svg>,
  install:<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="6" width="10" height="7"/><path d="M3 6 L8 2 L13 6"/></svg>,
  inspect:<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="7" cy="7" r="4"/><path d="M10 10 L13 13"/></svg>,
  follow: <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 4 L13 4 L13 10 L8 10 L5 13 L5 10 L3 10 Z"/></svg>,
};

function BriefSection({ color, label, children }) {
  return (
    <div style={{
      background: 'var(--card)',
      boxShadow: 'var(--shadow-sm), var(--ring)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: 14,
    }}>
      <div style={{
        padding: '10px 16px 8px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--divider-faint)',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto', background: color,
        }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function BriefRow({ left, main, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid var(--divider-faint)',
      background: 'var(--card)',
      transition: 'background var(--dur) var(--ease)',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--sunken)'}
    onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
    >
      {left}
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
        {main}
      </div>
      {right}
    </div>
  );
}

function DoneBtn({ label = 'Mark done' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: 30, height: 30,
        background: 'var(--card)',
        color: 'var(--text-muted)',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--ring)',
        display: 'grid', placeItems: 'center',
        cursor: 'pointer', border: 'none',
        transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >{BriefIcons.plus}</button>
  );
}

function LcdTime({ t }) {
  return (
    <span style={{
      minWidth: 58, padding: '4px 10px',
      background: 'var(--sunken)',
      color: 'var(--text)',
      fontFamily: 'var(--font-mono)', fontWeight: 600,
      fontSize: 13, letterSpacing: '0.02em',
      fontVariantNumeric: 'tabular-nums',
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
      boxShadow: 'var(--ring)',
    }}>{t}</span>
  );
}

function OrderBtn() {
  return (
    <button style={{
      height: 30, padding: '0 14px',
      background: 'var(--gold)', color: 'var(--navy)',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      borderRadius: 'var(--radius-pill)',
      boxShadow: 'var(--shadow-gold)',
      cursor: 'pointer',
      transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold)' }}
    >Order</button>
  );
}

function GoodDot() {
  return (
    <span style={{
      width: 8, height: 8, flex: '0 0 auto',
      background: 'var(--green)', borderRadius: '50%',
    }} />
  );
}

function MorningBriefing({ mobile = false }) {
  return (
    <div style={{
      width: mobile ? '100%' : 680,
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : '90vh',
      background: 'var(--card)',
      boxShadow: mobile ? 'none' : 'var(--shadow-xl), var(--ring)',
      borderRadius: mobile ? 0 : 'var(--radius-lg)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Hero-card header — navy panel with eyebrow + wordmark-style greeting */}
      <div style={{
        padding: '22px 24px 20px',
        background: 'var(--navy)',
        color: '#fff',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 11, color: 'var(--gold)' }}>
            Morning briefing · Friday · Apr 18
          </span>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 28, letterSpacing: '-0.02em',
            color: '#fff',
          }}>Good morning, Key.</span>
        </div>
        {!mobile && (
          <button
            type="button"
            aria-label="Close briefing"
            title="Close briefing"
            style={{
              width: 34, height: 34,
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              borderRadius: 'var(--radius-pill)',
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', border: 'none',
              transition: 'background var(--dur) var(--ease)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >{BriefIcons.x}</button>
        )}
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        background: 'var(--bg)',
      }}>
        <BriefSection color="var(--red)" label="Overdue · 3">
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--red)', borderRadius: '50%' }} />}
            main="Follow up with Sarah M — 5 days silent"
            right={<DoneBtn />}
          />
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--red)', borderRadius: '50%' }} />}
            main="Send reminder to Mike J — quote expiring"
            right={<DoneBtn />}
          />
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--red)', borderRadius: '50%' }} />}
            main="Call back Dave H — voicemail from Tuesday"
            right={<DoneBtn />}
          />
        </BriefSection>

        <BriefSection color="var(--gold)" label="Today · 3 scheduled">
          <BriefRow
            left={<LcdTime t="9:00" />}
            main={<><span className="smart-chip smart-chip--gold" style={{ marginRight: 8 }}>Install</span>Helen S</>}
          />
          <BriefRow
            left={<LcdTime t="11:30" />}
            main={<><span className="smart-chip smart-chip--purple" style={{ marginRight: 8 }}>Inspect</span>Mark L</>}
          />
          <BriefRow
            left={<LcdTime t="14:00" />}
            main={<><span className="smart-chip smart-chip--navy" style={{ marginRight: 8 }}>Follow-up</span>Tom B</>}
          />
        </BriefSection>

        <BriefSection color="var(--navy)" label="Materials to order · 2">
          <BriefRow
            left={<span className="smart-chip smart-chip--navy">50A</span>}
            main={<>Robert K · <span style={{ color: 'var(--text-muted)' }}>Inlet box</span></>}
            right={<OrderBtn />}
          />
          <BriefRow
            left={<span className="smart-chip smart-chip--gold">+$375</span>}
            main={<>Helen S · <span style={{ color: 'var(--text-muted)' }}>Surge protector</span></>}
            right={<OrderBtn />}
          />
        </BriefSection>

        <BriefSection color="var(--green)" label="Good news · 3">
          <BriefRow left={<GoodDot />} main={<>Sarah M approved <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>$1,497</span> proposal</>} />
          <BriefRow left={<GoodDot />} main="Alex collected 3 new photos overnight" />
          <BriefRow left={<GoodDot />} main={<>Mark L paid deposit <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>$748</span></>} />
        </BriefSection>
      </div>

      <div style={{
        height: 72, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid var(--divider)',
        background: 'var(--card)',
      }}>
        <button style={{
          height: 40, padding: '0 16px',
          background: 'transparent', color: 'var(--text-muted)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
          borderRadius: 'var(--radius-pill)',
          cursor: 'pointer',
        }}>Dismiss</button>
        <button className="btn-gold" style={{ height: 44 }}>Open CRM →</button>
      </div>
    </div>
  );
}

Object.assign(window, { MorningBriefing });
