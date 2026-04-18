/* global React */
// Morning Briefing — once-a-day modal

const BriefIcons = {
  x:      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>,
  plus:   <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3 L8 13 M3 8 L13 8"/></svg>,
  install:<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="6" width="10" height="7"/><path d="M3 6 L8 2 L13 6"/></svg>,
  inspect:<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="7" cy="7" r="4"/><path d="M10 10 L13 13"/></svg>,
  follow: <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 4 L13 4 L13 10 L8 10 L5 13 L5 10 L3 10 Z"/></svg>,
};

function BriefHeaderStrip({ color, label }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: color,
      color: '#fff',
      fontFamily: 'var(--font-chrome)', fontWeight: 700,
      fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
      boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.25), inset -1px -1px 0 rgba(0,0,0,.35)',
    }}>{label}</div>
  );
}

function BriefSection({ color, label, children }) {
  return (
    <div style={{
      boxShadow: 'var(--pressed-2)', background: 'var(--card)',
      marginBottom: 10,
    }}>
      <BriefHeaderStrip color={color} label={label} />
      <div>{children}</div>
    </div>
  );
}

function BriefRow({ left, main, right }) {
  return (
    <div className="tactile-flat" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px',
      borderBottom: '1px solid rgba(0,0,0,.06)',
      background: 'var(--card)',
    }}>
      {left}
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
        {main}
      </div>
      {right}
    </div>
  );
}

function DoneBtn() {
  return (
    <button className="tactile-raised" style={{
      width: 28, height: 28, background: 'var(--card)',
      display: 'grid', placeItems: 'center', color: 'var(--text)',
    }}>{BriefIcons.plus}</button>
  );
}

function LcdTime({ t }) {
  return (
    <span style={{
      minWidth: 60, padding: '2px 6px',
      background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
      color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
      fontFamily: 'var(--font-pixel)', fontSize: 16, letterSpacing: '.04em',
      textAlign: 'center',
    }}>{t}</span>
  );
}

function OrderBtn() {
  return (
    <button className="tactile-raised" style={{
      height: 28, padding: '0 10px',
      background: 'var(--navy)', color: 'var(--gold)',
      fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
    }}>ORDER</button>
  );
}

function GoodDot() {
  return (
    <span style={{
      width: 10, height: 10, flex: '0 0 auto',
      background: 'var(--lcd-green)', boxShadow: '0 0 4px var(--lcd-green)',
    }} />
  );
}

function MorningBriefing({ mobile = false }) {
  return (
    <div style={{
      width: mobile ? '100%' : 640,
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : '90vh',
      background: 'var(--card)',
      boxShadow: mobile ? 'none' : 'var(--raised-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top strip */}
      <div style={{
        height: 72, padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,0,0,.12)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-pixel)', fontSize: 30,
            color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
            letterSpacing: '.06em',
          }}>GOOD MORNING, KEY</span>
          <span className="chrome-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            FRIDAY · APR 18 · 2026
          </span>
        </div>
        {!mobile && (
          <button className="tactile-raised" style={{
            width: 32, height: 32, background: 'var(--card)',
            display: 'grid', placeItems: 'center', color: 'var(--text)',
          }}>{BriefIcons.x}</button>
        )}
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: 14,
      }}>
        <BriefSection color="var(--ms-3)" label="◆ OVERDUE · 03">
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--ms-3)' }} />}
            main="Follow up with Sarah M — 5 days silent"
            right={<DoneBtn />}
          />
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--ms-3)' }} />}
            main="Send reminder to Mike J — quote expiring"
            right={<DoneBtn />}
          />
          <BriefRow
            left={<span style={{ width: 6, height: 6, background: 'var(--ms-3)' }} />}
            main="Call back Dave H — voicemail from Tuesday"
            right={<DoneBtn />}
          />
        </BriefSection>

        <BriefSection color="var(--ms-5)" label="◆ TODAY · 03 SCHEDULED">
          <BriefRow
            left={<LcdTime t="09:00" />}
            main={<><span className="chrome-label" style={{ fontSize: 9, color: 'var(--gold)', marginRight: 8 }}>INSTALL</span>Helen S</>}
          />
          <BriefRow
            left={<LcdTime t="11:30" />}
            main={<><span className="chrome-label" style={{ fontSize: 9, color: 'var(--ms-5)', marginRight: 8 }}>INSPECT</span>Mark L</>}
          />
          <BriefRow
            left={<LcdTime t="14:00" />}
            main={<><span className="chrome-label" style={{ fontSize: 9, color: 'var(--ms-4)', marginRight: 8 }}>FOLLOW-UP</span>Tom B</>}
          />
        </BriefSection>

        <BriefSection color="var(--navy)" label="◆ MATERIALS TO ORDER · 02">
          <BriefRow
            left={<span className="chrome-label" style={{ fontSize: 9, color: 'var(--navy)' }}>50A</span>}
            main={<>Robert K — <span style={{ color: 'var(--text-muted)' }}>INLET BOX</span></>}
            right={<OrderBtn />}
          />
          <BriefRow
            left={<span className="chrome-label" style={{ fontSize: 9, color: 'var(--gold)' }}>+$375</span>}
            main={<>Helen S — <span style={{ color: 'var(--text-muted)' }}>SURGE PROTECTOR</span></>}
            right={<OrderBtn />}
          />
        </BriefSection>

        <BriefSection color="var(--ms-2)" label="◆ GOOD NEWS · 03">
          <BriefRow left={<GoodDot />} main={<>Sarah M approved <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>$1,497</span> proposal</>} />
          <BriefRow left={<GoodDot />} main="Alex collected 3 new photos overnight" />
          <BriefRow left={<GoodDot />} main={<>Mark L paid deposit <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>$748</span></>} />
        </BriefSection>
      </div>

      <div style={{
        height: 64, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid rgba(0,0,0,.12)',
      }}>
        <button className="chrome-label" style={{
          height: 36, padding: '0 12px', fontSize: 11,
          background: 'transparent', color: 'var(--text-muted)',
        }}>DISMISS</button>
        <button className="tactile-raised chrome-label" style={{
          height: 44, padding: '0 20px', fontSize: 12,
          background: 'var(--navy)', color: 'var(--gold)',
        }}>OPEN CRM →</button>
      </div>
    </div>
  );
}

Object.assign(window, { MorningBriefing });
