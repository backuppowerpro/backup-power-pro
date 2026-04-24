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
      minWidth: 22, height: 22, padding: '0 6px',
      display: 'inline-grid', placeItems: 'center',
      background: 'var(--sunken)',
      boxShadow: 'var(--ring)',
      borderRadius: 'var(--radius-xs)',
      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11,
      color: 'var(--text-muted)',
    }}>{k}</span>
  );
}

function CmdGroupHead({ color, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px 6px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>{label}</span>
    </div>
  );
}

function CmdMiniAvatar({ i, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, flex:'0 0 auto',
      background: 'var(--navy)',
      borderRadius: '50%',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)', fontWeight: 600,
        color: '#fff', fontSize: size >= 40 ? 13 : 11,
      }}>{i}</span>
    </div>
  );
}

function CmdRow({ icon, title, sub, hint, highlight = false, mobile = false }) {
  const h = mobile ? 56 : 48;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px', height: h,
      background: highlight ? 'var(--sunken)' : 'transparent',
      boxShadow: highlight ? 'inset 0 0 0 1.5px var(--gold)' : 'none',
      borderRadius: highlight ? 'var(--radius-sm)' : 0,
      margin: highlight ? '0 8px' : 0,
      cursor: 'pointer',
      transition: 'background var(--dur-fast) var(--ease)',
    }}
    onMouseEnter={e => { if (!highlight) e.currentTarget.style.background = 'var(--sunken)' }}
    onMouseLeave={e => { if (!highlight) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ display:'grid', placeItems:'center', color: highlight ? 'var(--navy)' : 'var(--text-muted)' }}>
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
      width: mobile ? '100%' : 580,
      height: mobile ? '100%' : 'auto',
      maxHeight: mobile ? '100%' : 480,
      background: 'var(--card)',
      boxShadow: mobile ? 'none' : 'var(--shadow-xl), var(--ring)',
      borderRadius: mobile ? 0 : 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Search input */}
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--divider-faint)' }}>
        <div style={{
          flex: 1, height: 48, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px',
          background: 'var(--sunken)',
          boxShadow: 'var(--ring)',
          borderRadius: 'var(--radius-pill)',
        }}>
          <span style={{ color: 'var(--text-faint)' }}>{CmdIcons.search}</span>
          <span style={{
            flex: 1,
            fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text)',
          }}>
            sar
            <span style={{
              display:'inline-block', width: 2, height: 17, verticalAlign: -3,
              background: 'var(--navy)', marginLeft: 2,
              animation: 'caret 1s ease-in-out infinite',
            }}/>
          </span>
          <Kbd k="Esc" />
        </div>
      </div>

      <style>{`@keyframes caret { 0%,50% { opacity: 1 } 50.01%,100% { opacity: 0 } }`}</style>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 6px' }}>
        <CmdGroupHead color="var(--blue)" label="Leads" />
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

        <CmdGroupHead color="var(--green)" label="Navigation" />
        <CmdRow icon={CmdIcons.pipe}  title="Go to Pipeline" hint="G P" mobile={mobile} />
        <CmdRow icon={CmdIcons.cal}   title="Go to Calendar" hint="G C" mobile={mobile} />
        <CmdRow icon={CmdIcons.money} title="Go to Finance"  hint="G F" mobile={mobile} />

        <CmdGroupHead color="var(--red)" label="Actions" />
        <CmdRow icon={CmdIcons.plus} title="New lead"  hint="N L" mobile={mobile} />
        <CmdRow icon={CmdIcons.sms}  title="Send SMS"  hint="S S" mobile={mobile} />

        <CmdGroupHead color="var(--purple)" label="Sparky" />
        <CmdRow
          icon={<span style={{
            width: 26, height: 26, background: 'var(--gold)', color: 'var(--navy)',
            display:'inline-grid', placeItems:'center',
            fontFamily:'var(--font-display)', fontWeight: 800, fontSize: 13,
            borderRadius: 'var(--radius-sm)',
            boxShadow:'var(--shadow-xs)',
          }}>S</span>}
          title={<>Ask Sparky: "sa<QueryHighlight q="r" />"</>}
          hint="⏎"
          mobile={mobile}
        />
      </div>

      {/* Footer */}
      <div style={{
        height: 44, padding: '0 18px',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'var(--sunken)',
        borderTop: '1px solid var(--divider)',
        fontFamily: 'var(--font-body)', fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Kbd k="↑↓" /> Navigate</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Kbd k="↵" /> Select</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Kbd k="Esc" /> Close</span>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
