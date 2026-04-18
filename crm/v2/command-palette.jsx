/* global React */
// Command Palette — ⌘K

const CmdIcons = {
  search:<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="7" cy="7" r="4"/><path d="M10 10 L14 14"/></svg>,
  pipe:  <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="3" width="3" height="10"/><rect x="7" y="6" width="3" height="7"/><rect x="11" y="9" width="3" height="4"/></svg>,
  cal:   <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="4" width="12" height="10"/><path d="M2 6 L14 6 M5 2 L5 5 M11 2 L11 5"/></svg>,
  money: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 6 L12 6 M4 10 L12 10 M6 4 L6 12 M10 4 L10 12"/></svg>,
  plus:  <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3 L8 13 M3 8 L13 8"/></svg>,
  sms:   <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 4 L14 4 L14 11 L8 11 L5 14 L5 11 L2 11 Z"/></svg>,
  s:     <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4 L12 4 L12 7 L4 7 L4 9 L12 9 L12 12 L4 12"/></svg>,
};

function Kbd({ k }) {
  return (
    <span style={{
      minWidth: 20, height: 20, padding: '0 5px',
      display: 'inline-grid', placeItems: 'center',
      background: 'var(--card)', boxShadow: 'var(--raised-2)',
      fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--text)',
      letterSpacing: '.04em',
    }}>{k}</span>
  );
}

function CmdGroupHead({ color, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px',
      position: 'relative',
    }}>
      <span style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 4,
        background: color,
        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.35), inset -1px -1px 0 rgba(0,0,0,.35)',
      }} />
      <span className="chrome-label" style={{
        fontSize: 11, color: color, letterSpacing: '.12em',
      }}>{label}</span>
    </div>
  );
}

function CmdMiniAvatar({ i, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, flex:'0 0 auto',
      background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-chrome)', fontWeight: 700,
        color: 'var(--gold)', fontSize: 12,
      }}>{i}</span>
    </div>
  );
}

function CmdRow({ icon, title, sub, hint, highlight = false, mobile = false }) {
  const h = mobile ? 56 : 44;
  return (
    <div className="tactile-flat" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 14px', height: h,
      position: 'relative',
      background: 'var(--card)',
      boxShadow: highlight ? 'var(--pressed-2)' : 'none',
      borderBottom: '1px solid rgba(0,0,0,.04)',
    }}>
      {highlight && (
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: 'var(--gold)',
        }} />
      )}
      <span style={{ display:'grid', placeItems:'center', color: 'var(--text-muted)' }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: mobile ? 15 : 14,
          fontWeight: 600, color: 'var(--text)',
        }}>{title}</span>
        {sub && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>
        )}
      </div>
      {hint && (
        <div style={{ display: 'flex', gap: 4 }}>
          {hint.split(' ').map((k, i) => <Kbd key={i} k={k} />)}
        </div>
      )}
    </div>
  );
}

function QueryHighlight({ q = 'sar' }) {
  return (
    <span>
      <span style={{ background: 'var(--gold)', color: '#1a1a1a', padding: '0 2px' }}>{q}</span>
    </span>
  );
}

function CommandPalette({ mobile = false }) {
  return (
    <div style={{
      width: mobile ? '100%' : 560,
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : 440,
      background: 'var(--card)',
      boxShadow: mobile ? 'none' : 'var(--raised-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Search input */}
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          flex: 1, height: 48, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 14px',
          background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        }}>
          <span style={{ color: 'var(--text-faint)' }}>{CmdIcons.search}</span>
          <span style={{
            flex: 1,
            fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--text)',
          }}>
            sar
            <span style={{
              display:'inline-block', width: 2, height: 18, verticalAlign: -3,
              background: 'var(--text)', marginLeft: 2,
              animation: 'caret .8s steps(2) infinite',
            }}/>
          </span>
          <Kbd k="ESC" />
        </div>
      </div>

      <style>{`@keyframes caret { 50% { opacity: 0 } }`}</style>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 4px' }}>
        <CmdGroupHead color="var(--ms-1)" label="LEADS" />
        <CmdRow
          icon={<CmdMiniAvatar i="SM" />}
          title={<>Sa<QueryHighlight />h M</>}
          sub="(864) 555-0101 · 412 Laurel Ridge Rd"
          hint="↵"
          highlight
          mobile={mobile}
        />
        <CmdRow
          icon={<CmdMiniAvatar i="SP" />}
          title={<>Sa<QueryHighlight q="ra" />h P</>}
          sub="(864) 555-0412 · 77 Elm St"
          hint="↵"
          mobile={mobile}
        />

        <CmdGroupHead color="var(--ms-2)" label="NAVIGATION" />
        <CmdRow icon={CmdIcons.pipe}  title="Go to Pipeline" hint="G P" mobile={mobile} />
        <CmdRow icon={CmdIcons.cal}   title="Go to Calendar" hint="G C" mobile={mobile} />
        <CmdRow icon={CmdIcons.money} title="Go to Finance"  hint="G F" mobile={mobile} />

        <CmdGroupHead color="var(--ms-3)" label="ACTIONS" />
        <CmdRow icon={CmdIcons.plus} title="New lead"  hint="N L" mobile={mobile} />
        <CmdRow icon={CmdIcons.sms}  title="Send SMS"  hint="S S" mobile={mobile} />

        <CmdGroupHead color="var(--ms-4)" label="SPARKY" />
        <CmdRow
          icon={<span style={{
            width: 20, height: 20, background: 'var(--gold)', color: '#1a1a1a',
            display:'inline-grid', placeItems:'center',
            fontFamily:'var(--font-pixel)', fontSize: 14,
            boxShadow:'inset 1px 1px 0 rgba(255,255,255,.5), inset -1px -1px 0 rgba(0,0,0,.35)',
          }}>S</span>}
          title={<>Ask Sparky: "sa<QueryHighlight q="r" />"</>}
          hint="⏎"
          mobile={mobile}
        />
      </div>

      {/* Footer */}
      <div style={{
        height: 40, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        fontFamily: 'var(--font-pixel)', fontSize: 13,
        color: 'var(--text-muted)', letterSpacing: '.12em',
      }}>
        <span>↑↓ NAVIGATE</span>
        <span>↵ SELECT</span>
        <span>ESC CLOSE</span>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
