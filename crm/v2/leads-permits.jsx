/* global React */
// Leads — Permits sub-view. 7-step permit pipeline per jurisdiction.

const STEP_HEADS = ['SUBMIT', 'PAY', 'PAID', 'PRINT', 'PRINTED', 'INSPECT\u00a0SCHED', 'INSPECT\u00a0PASS'];

const PermitIcons = {
  clock: <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="3" width="10" height="10"/><path d="M8 6 L8 8 L10 10"/></svg>,
  check: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8 L7 12 L13 4"/></svg>,
  x:     <svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 4 L12 12 M12 4 L4 12"/></svg>,
};

/* ── Minesweeper-style step cell ── */
function StepCell({ state }) {
  const base = {
    width: 40, height: 40,
    display: 'grid', placeItems: 'center',
    background: 'var(--card)', color: 'var(--text)',
  };
  if (state === 'empty') {
    return <div style={{ ...base, boxShadow: 'var(--pressed-2)' }} />;
  }
  if (state === 'progress') {
    return (
      <div style={{ ...base, boxShadow: 'var(--raised-2)', color: 'var(--text-muted)' }}>
        {PermitIcons.clock}
      </div>
    );
  }
  if (state === 'done') {
    return (
      <div style={{
        ...base, boxShadow: 'var(--pressed-2)',
        color: 'var(--ms-2)',
      }}>
        {PermitIcons.check}
      </div>
    );
  }
  if (state === 'blocked') {
    return (
      <div style={{
        ...base,
        background: 'var(--lcd-bg)',
        boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-red)',
        textShadow: 'var(--lcd-glow-red)',
      }}>
        {PermitIcons.x}
      </div>
    );
  }
  return <div style={base} />;
}

function StepRow({ cells }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      boxShadow: '0 0 0 1px rgba(0,0,0,.15)',
    }}>
      {cells.map((s, i) => <StepCell key={i} state={s} />)}
    </div>
  );
}

const ROWS = [
  { name: 'Sarah M',  initials:'SM', jur: null,        cells: Array(7).fill('empty'),
    action: { kind: 'amber', label: 'SET JURISDICTION' } },
  { name: 'Mike J',   initials:'MJ', jur: 'GREENVILLE COUNTY',
    cells: ['done','done','blocked','empty','empty','empty','empty'],
    action: { kind: 'blocked', label: 'BLOCKED — CALL COUNTY' } },
  { name: 'Robert K', initials:'RK', jur: 'GREENVILLE COUNTY',
    cells: ['done','done','progress','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'AWAITING PAYMENT' } },
  { name: 'Mark L',   initials:'ML', jur: 'GREENVILLE COUNTY',
    cells: ['done','done','done','done','progress','empty','empty'],
    action: { kind: 'wait',  label: 'READY TO PRINT' } },
  { name: 'Bill C',   initials:'BC', jur: 'SPARTANBURG COUNTY',
    cells: ['done','empty','empty','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'PAY TO SPARTANBURG' } },
  { name: 'Paul R',   initials:'PR', jur: 'SPARTANBURG COUNTY',
    cells: ['done','done','empty','empty','empty','empty','empty'],
    action: { kind: 'wait',  label: 'PAY TO SPARTANBURG' } },
  { name: 'Carl W',   initials:'CW', jur: 'GREENVILLE COUNTY',
    cells: ['done','done','done','done','done','done','empty'],
    action: { kind: 'wait',  label: 'SCHEDULE INSPECTION' } },
  { name: 'Helen S',  initials:'HS', jur: 'PICKENS COUNTY',
    cells: ['done','done','done','done','done','done','progress'],
    action: { kind: 'today', label: 'INSPECTION TODAY' } },
];

function JurisCell({ jur }) {
  if (!jur) {
    return (
      <span style={{
        height: 24, padding: '0 8px',
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-amber)', textShadow: 'var(--lcd-glow-amber)',
        fontFamily: 'var(--font-pixel)', fontSize: 13,
        letterSpacing: '.08em',
      }}>NO JURISDICTION</span>
    );
  }
  return (
    <span className="chrome-label" style={{
      fontSize: 11, color: 'var(--text)', letterSpacing: '.08em',
    }}>{jur}</span>
  );
}

function ActionCell({ action }) {
  if (action.kind === 'amber') {
    return (
      <button className="tactile-raised chrome-label" style={{
        height: 28, padding: '0 10px', fontSize: 11,
        background: 'var(--gold)', color: '#1a1a1a',
      }}>{action.label}</button>
    );
  }
  if (action.kind === 'blocked') {
    return (
      <span style={{
        height: 28, padding: '0 10px',
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>{action.label}</span>
    );
  }
  if (action.kind === 'today') {
    return (
      <span style={{
        height: 28, padding: '0 10px',
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>{action.label}</span>
    );
  }
  return (
    <span className="chrome-label" style={{
      height: 28, padding: '0 10px',
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--card)', boxShadow: 'var(--pressed-2)',
      fontSize: 11, color: 'var(--text)',
    }}>{action.label}</span>
  );
}

function MiniAvatar({ initials }) {
  return (
    <div style={{
      width: 28, height: 28, flex: '0 0 auto',
      background: 'var(--navy)', clipPath: 'var(--avatar-clip)',
      display: 'grid', placeItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-chrome)', fontWeight: 700,
        color: 'var(--gold)', fontSize: 10, letterSpacing: '.04em',
      }}>{initials}</span>
    </div>
  );
}

function PermitsToolbar() {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS', active: true },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  const jurs = [
    { id: 'all', label: 'ALL', active: true },
    { id: 'gv',  label: 'GREENVILLE' },
    { id: 'sb',  label: 'SPARTANBURG' },
    { id: 'pk',  label: 'PICKENS' },
  ];
  const stat = [
    { id: 'ns',  label: 'NOT STARTED' },
    { id: 'ip',  label: 'IN PROGRESS', active: true },
    { id: 'cp',  label: 'COMPLETE' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      padding: '16px 16px 8px',
    }}>
      <div style={{ display: 'flex', height: 36, boxShadow: 'var(--raised-2)' }}>
        {subs.map(s => (
          <button key={s.id} className="chrome-label" style={{
            height: 36, padding: '0 16px', fontSize: 12,
            background: s.active ? 'var(--navy)' : 'transparent',
            color: s.active ? 'var(--gold)' : 'var(--text)',
            boxShadow: s.active ? 'var(--pressed-2)' : 'none',
          }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {jurs.map(f => (
          <button key={f.id} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 11,
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text)',
            boxShadow: f.active ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{f.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {stat.map(f => (
          <button key={f.id} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 11,
            background: f.active ? 'var(--navy)' : 'var(--card)',
            color: f.active ? '#fff' : 'var(--text)',
            boxShadow: f.active ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

function CornerBadges() {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '0 16px 8px',
      justifyContent: 'flex-end',
    }}>
      <span style={{
        height: 26, padding: '0 10px',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>◆ 8 ACTIVE PERMITS</span>
      <span style={{
        height: 26, padding: '0 10px',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
        color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
        fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
      }}>◆ 1 BLOCKED</span>
    </div>
  );
}

/* ────────── Desktop table ────────── */
function PermitsDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PermitsToolbar />
      <CornerBadges />
      <div style={{ padding: '0 16px 88px', flex: 1, overflow: 'hidden' }}>
        <div style={{
          background: 'var(--card)',
          boxShadow: 'var(--pressed-2)',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '200px 200px auto 200px',
            height: 36, alignItems: 'center',
            padding: '0 14px',
            borderBottom: '1px solid rgba(0,0,0,.15)',
          }}>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>CUSTOMER</span>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>JURISDICTION</span>
            <div style={{ display: 'flex', gap: 0, justifyContent: 'center' }}>
              {STEP_HEADS.map((s, i) => (
                <span key={i} className="chrome-label" style={{
                  width: 40, fontSize: 8, color: 'var(--text-muted)',
                  textAlign: 'center', letterSpacing: '.04em',
                }}>{s}</span>
              ))}
            </div>
            <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</span>
          </div>

          {/* Data rows */}
          {ROWS.map((r, i) => (
            <div key={i} className="tactile-flat" style={{
              display: 'grid',
              gridTemplateColumns: '200px 200px auto 200px',
              height: 64, alignItems: 'center',
              padding: '0 14px',
              borderBottom: i < ROWS.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
              background: 'var(--card)',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MiniAvatar initials={r.initials} />
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                  color: 'var(--text)',
                }}>{r.name}</span>
              </div>
              <JurisCell jur={r.jur} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <StepRow cells={r.cells} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ActionCell action={r.action} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────── Mobile list ────────── */
function PermitsMobile() {
  const subs = [
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'list',     label: 'LIST' },
    { id: 'permits',  label: 'PERMITS', active: true },
    { id: 'mat',      label: 'MATERIALS' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 8px 4px' }}>
        <div style={{ display: 'flex', height: 32, boxShadow: 'var(--raised-2)', alignSelf: 'flex-start' }}>
          {subs.map(s => (
            <button key={s.id} className="chrome-label" style={{
              height: 32, padding: '0 10px', fontSize: 10,
              background: s.active ? 'var(--navy)' : 'transparent',
              color: s.active ? 'var(--gold)' : 'var(--text)',
              boxShadow: s.active ? 'var(--pressed-2)' : 'none',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '4px 8px', display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        <span style={{
          height: 22, padding: '0 8px',
          display: 'inline-flex', alignItems: 'center',
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: 'var(--lcd-green)', textShadow: 'var(--lcd-glow-green)',
          fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '.08em',
        }}>8 ACTIVE</span>
        <span style={{
          height: 22, padding: '0 8px',
          display: 'inline-flex', alignItems: 'center',
          background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
          color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
          fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '.08em',
        }}>1 BLOCKED</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', margin: '4px 8px', boxShadow: 'var(--pressed-2)', background: 'var(--card)' }}>
        {ROWS.map((r, i) => (
          <div key={i} style={{
            padding: '10px 12px',
            borderBottom: i < ROWS.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MiniAvatar initials={r.initials} />
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                color: 'var(--text)', flex: 1,
              }}>{r.name}</span>
              <JurisCell jur={r.jur} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ overflowX: 'auto', flex: '0 0 auto' }}>
                <StepRow cells={r.cells} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <ActionCell action={r.action} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PermitsDesktop, PermitsMobile });
