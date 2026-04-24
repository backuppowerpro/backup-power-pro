/* global React */
// BPP CRM — shared shell v2.
// Tabs on TOP on both desktop + mobile.
// Search moves to a fixed morphing BOTTOM bar (modes A/B/C).

const { useState } = React;

/* ────────── Icons (16×16 pixel grid) ────────── */
const Ico = {
  search: <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2" width="8" height="8"/><path d="M10 10 L14 14"/></svg>,
  plus:   <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 2 L8 14 M2 8 L14 8"/></svg>,
  sun:    <svg viewBox="0 0 16 16" width="14" height="14"><rect x="5" y="5" width="6" height="6"/><path d="M8 1 L8 3 M8 13 L8 15 M1 8 L3 8 M13 8 L15 8 M3 3 L4 4 M12 12 L13 13 M12 4 L13 3 M3 13 L4 12"/></svg>,
  send:   <svg viewBox="0 0 16 16" width="16" height="16"><path d="M1 2 L15 8 L1 14 L3 8 L1 2 Z M3 8 L9 8"/></svg>,
  attach: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M11 4 L11 10 L8 13 L5 10 L5 3 L7 1 L9 3 L9 9 L8 10 L7 9 L7 5"/></svg>,
  dots:   <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="7" width="2" height="2"/><rect x="7" y="7" width="2" height="2"/><rect x="12" y="7" width="2" height="2"/></svg>,
  quote:  <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="10" height="12"/><path d="M5 5 L11 5 M5 8 L11 8 M5 11 L9 11"/></svg>,
  sched:  <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="3" width="12" height="11"/><path d="M2 6 L14 6 M5 2 L5 4 M11 2 L11 4"/><rect x="9" y="9" width="2" height="2"/></svg>,
  materials: <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="5" width="12" height="9"/><path d="M2 5 L8 2 L14 5"/></svg>,
  status: <svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="2" width="12" height="12"/><rect x="5" y="5" width="6" height="6"/></svg>,
  note:   <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2 L11 2 L13 4 L13 14 L3 14 Z M11 2 L11 4 L13 4"/><path d="M5 7 L11 7 M5 10 L9 10"/></svg>,
  leads:    <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="3" width="12" height="10"/><path d="M2 6 L14 6"/><rect x="5" y="8" width="2" height="2"/><path d="M9 9 L12 9 M9 11 L11 11"/></svg>,
  calendar: <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="3" width="12" height="11"/><path d="M2 6 L14 6 M5 2 L5 4 M11 2 L11 4"/><rect x="5" y="9" width="2" height="2"/><rect x="9" y="9" width="2" height="2"/></svg>,
  finance:  <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="4" width="12" height="9"/><path d="M2 7 L14 7"/><rect x="6" y="9" width="4" height="3"/></svg>,
  messages: <svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3 L14 3 L14 11 L9 11 L6 14 L6 11 L2 11 Z"/><path d="M5 6 L11 6 M5 8 L9 8"/></svg>,
  sparky:   <svg viewBox="0 0 16 16" width="16" height="16"><path d="M9 1 L4 9 L7 9 L6 15 L12 6 L9 6 Z"/></svg>,
  grip:     <svg viewBox="0 0 8 8" width="8" height="8"><rect x="0" y="0" width="2" height="2"/><rect x="6" y="0" width="2" height="2"/><rect x="0" y="6" width="2" height="2"/><rect x="6" y="6" width="2" height="2"/></svg>,
};

// Flat tab list — no tabs-within-tabs (Key 2026-04-21: "actually add all
// of the different left hand items all as tabs, no tabs within tabs").
// Mobile scrolls horizontally; active tab auto-scrolls into view.
const TABS = [
  { id: 'quick',     label: 'Quick',     icon: Ico.leads },
  { id: 'calendar',  label: 'Calendar',  icon: Ico.calendar },
  // LIST removed 2026-04-21 — QUICK is now a Sparky-scored smart list.
  // PIPELINE removed 2026-04-22 (Key: "i really dislike the pipeline view,
  // lets just scrap that") — Smart List + priority tables replace it.
  { id: 'messages',  label: 'Messages',  icon: Ico.messages },
  { id: 'calls',     label: 'Calls',     icon: Ico.messages },
  { id: 'proposals', label: 'Proposals', icon: Ico.finance },
  { id: 'invoices',  label: 'Invoices',  icon: Ico.finance },
  { id: 'permits',   label: 'Permits',   icon: Ico.leads },
  { id: 'materials', label: 'Materials', icon: Ico.leads },
  { id: 'finance',   label: 'Finance',   icon: Ico.finance },
  // 2026-04-24: Playbook tab backs the /memories/ filesystem that
  // Alex + Sparky + post-mortem Alex read and write. Key reviews,
  // prunes bad patterns, and adds his own field insights.
  { id: 'playbook',  label: 'Playbook',  icon: Ico.finance },
];

/* ────────── Top bar (desktop + mobile share layout) ────────── */
function TopBar({ compact = false, onToggleDark, onNewLead, onOpenSearch, isDark }) {
  const h = compact ? 52 : 60;
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 14,
      boxShadow: '0 1px 0 var(--divider)',
      background: 'var(--card)',
      position: 'relative', zIndex: 3,
    }}>
      {/* Logo — matches website header: gold-tile brand mark + Outfit wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: compact ? 26 : 30, height: compact ? 26 : 30,
          background: 'var(--gold)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-xs)',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
        }}>
          <svg viewBox="0 0 16 16" width={compact ? 14 : 16} height={compact ? 14 : 16}
               style={{ stroke: 'var(--navy)', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M9 1 L4 9 L7 9 L6 15 L12 6 L9 6 Z" />
          </svg>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: compact ? 16 : 18, letterSpacing: '-0.02em',
          color: 'var(--navy)',
          whiteSpace: 'nowrap',
        }}>Backup Power <span style={{ color: 'var(--gold)' }}>Pro</span></div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onOpenSearch}
          aria-label="Open smart search (Cmd+K)"
          title="Search (⌘K)"
          style={{
          height: 34, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8,
          color: 'var(--text-muted)', cursor: 'pointer',
          background: 'var(--sunken)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--ring)',
          transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--sunken)'; e.currentTarget.style.boxShadow = 'var(--ring)' }}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="7" cy="7" r="4"/>
            <path d="M10 10 L13 13"/>
          </svg>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '.02em' }}>⌘K</span>
        </button>
        <button onClick={onToggleDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          style={{
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          color: 'var(--text-muted)', cursor: 'pointer',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--ring)',
          background: 'var(--card)',
          transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--sunken)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >{Ico.sun}</button>
        <button onClick={onNewLead}
          aria-label="Create new lead"
          title="New lead"
          style={{
          height: 34, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold)', color: 'var(--navy)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          letterSpacing: '0.01em',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-gold)',
          cursor: 'pointer',
          transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.boxShadow = 'var(--shadow-gold)' }}
        >{Ico.plus}<span>New lead</span></button>
        <div style={{
          width: 36, height: 36, background: 'var(--navy)',
          borderRadius: '50%',
          display: 'grid', placeItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 600,
            color: '#fff', fontSize: 13, letterSpacing: '0.01em',
          }}>KG</span>
        </div>
      </div>
    </div>
  );
}

/* ────────── Mobile tab grouping (Key 2026-04-21) ────────── */
// 11 flat tabs don't fit on a 375px viewport, and several aren't even
// useful on a phone (pipeline kanban needs width; permits / materials
// tables; the finance dashboard). Mobile collapses to 4 parents with a
// drop-down sub-row covering only what Key does in the field: triage,
// text people, check money owed, confirm the calendar. Desktop stays
// flat with all 11.
//   QUICK      standalone — daily landing
//   LEADS      LIST · MESSAGES · CALLS     (no pipeline — desktop only)
//   MONEY      PROPOSALS · INVOICES        (no finance dashboard)
//   CALENDAR   standalone — tomorrow's installs at a glance
const MOBILE_GROUPS = [
  { id: 'quick',    label: 'Quick',    icon: Ico.leads,    children: null },
  { id: 'leads',    label: 'Leads',    icon: Ico.leads,    children: ['messages', 'calls'] },
  { id: 'money',    label: 'Money',    icon: Ico.finance,  children: ['proposals', 'invoices'] },
  { id: 'calendar', label: 'Calendar', icon: Ico.calendar, children: null },
];

// Tabs that don't belong on a phone — pipeline needs width, table views
// (permits / materials) and the finance dashboard are desktop-only. When
// a mobile user lands on one of these (stale URL, deep link, etc.) route
// them to QUICK so the app doesn't render a mangled layout.
const MOBILE_DESKTOP_ONLY_TABS = new Set(['permits', 'materials', 'finance']);

function mobileParentFor(tabId) {
  for (const g of MOBILE_GROUPS) {
    if (g.id === tabId) return g.id;
    if (g.children?.includes(tabId)) return g.id;
  }
  return 'quick';
}

/* ────────── Tab bar — desktop flat, mobile 2-level grouped ────────── */
function TabBar({ active = 'quick', scrollable = false, onChange, badges = {} }) {
  // Scroll the active tab into view on mobile when it changes (avoids the
  // off-screen "where am I" confusion we had before).
  const barRef = React.useRef(null);
  React.useEffect(() => {
    if (!scrollable || !barRef.current) return;
    const btn = barRef.current.querySelector(`button[data-tab-id="${active}"], button[data-group-id="${mobileParentFor(active)}"]`);
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [active, scrollable]);

  if (scrollable) {
    // Mobile: parent row + optional sub-row for the currently-active parent
    const activeParent = mobileParentFor(active);
    const group = MOBILE_GROUPS.find(g => g.id === activeParent);
    const showSubRow = group?.children && group.children.length > 0;
    return (
      <div ref={barRef} role="tablist" aria-label="Main navigation" style={{
        background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        position: 'relative', zIndex: 2,
      }}>
        {/* Parent row */}
        <div style={{
          height: 44, display: 'flex', alignItems: 'stretch',
          padding: '0 8px', overflowX: 'auto', whiteSpace: 'nowrap',
        }}>
          {MOBILE_GROUPS.map(g => {
            const isActive = g.id === activeParent;
            // Tapping a parent lands on its first child (or on itself if it's
            // the standalone QUICK tab). Already-on-this-parent taps are a
            // no-op so Key doesn't accidentally bounce between sub-tabs.
            const onParentClick = () => {
              if (isActive) return;
              const target = g.children ? g.children[0] : g.id;
              onChange && onChange(target);
            };
            // Parent shows a badge if any of its children has one.
            const badgeSum = g.children
              ? g.children.reduce((n, cid) => n + (badges[cid] || 0), 0)
              : (badges[g.id] || 0);
            return (
              <button key={g.id} className="chrome-label"
                role="tab"
                data-group-id={g.id}
                aria-selected={isActive}
                aria-label={g.label}
                onClick={onParentClick}
                style={{
                  height: '100%', padding: '0 16px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  flex: '0 0 auto',
                  color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 13,
                  boxShadow: isActive ? 'inset 0 -3px 0 var(--gold)' : 'none',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}>
                <span style={{ display: 'flex', opacity: isActive ? 1 : .75 }} aria-hidden="true">{g.icon}</span>
                <span>{g.label}</span>
                {badgeSum ? (
                  <span className="mono" style={{
                    fontSize: 10, padding: '1px 5px', letterSpacing: '.04em',
                    color: '#fff', background: 'var(--ms-3)',
                  }}>{badgeSum}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {/* Sub-row — only when the active parent has children */}
        {showSubRow ? (
          <div style={{
            height: 36, display: 'flex', alignItems: 'stretch',
            padding: '0 8px', overflowX: 'auto', whiteSpace: 'nowrap',
            background: 'var(--card)',
            borderTop: '1px solid var(--divider)',
          }}>
            {group.children.map(cid => {
              const t = TABS.find(x => x.id === cid);
              if (!t) return null;
              const isActive = t.id === active;
              const badge = badges[t.id];
              return (
                <button key={t.id} className="chrome-label"
                  role="tab"
                  data-tab-id={t.id}
                  aria-selected={isActive}
                  aria-label={badge ? `${t.label} (${badge})` : t.label}
                  onClick={() => onChange && onChange(t.id)}
                  style={{
                    height: '100%', padding: '0 14px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    flex: '0 0 auto',
                    color: isActive ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: 11, letterSpacing: '.06em',
                    boxShadow: isActive ? 'inset 0 -2px 0 var(--gold)' : 'none',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                  }}>
                  <span>{t.label}</span>
                  {badge ? (
                    <span className="mono" style={{
                      fontSize: 10, padding: '1px 5px', letterSpacing: '.04em',
                      color: '#fff', background: 'var(--ms-3)',
                    }}>{badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  // Desktop: original flat row, icons dropped so all 11 tabs fit in the
  // left-panel width (Key 2026-04-22: "items cut off, remove icons to
  // make room"). Each tab now flex:1 so labels share the available
  // space evenly. Overflow-x clipping would hide tabs; flex sharing
  // keeps every label at least partly visible.
  return (
    <div ref={barRef} role="tablist" aria-label="Main navigation" style={{
      height: 48, display: 'flex', alignItems: 'stretch',
      padding: '0 12px',
      background: 'var(--card)',
      boxShadow: '0 1px 0 var(--divider)',
      whiteSpace: 'nowrap',
      position: 'relative', zIndex: 2,
    }}>
      {TABS.map(t => {
        const isActive = t.id === active;
        const badge = badges[t.id];
        return (
          <button key={t.id}
            role="tab"
            data-tab-id={t.id}
            aria-selected={isActive}
            aria-label={badge ? `${t.label} (${badge})` : t.label}
            onClick={() => onChange && onChange(t.id)}
            style={{
              height: '100%', padding: '0 6px', minWidth: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              flex: '1 1 0',
              color: isActive ? 'var(--navy)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: isActive ? 700 : 500,
              fontSize: isActive ? 13 : 12.5,
              letterSpacing: 0,
              boxShadow: isActive ? 'inset 0 -2px 0 var(--gold)' : 'none',
              transition: 'box-shadow var(--dur) var(--ease), color var(--dur) var(--ease)',
              cursor: 'pointer',
              background: 'transparent', border: 'none',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
            {badge ? (
              <span style={{
                fontSize: 10, padding: '2px 7px', letterSpacing: 0,
                fontWeight: 700,
                color: '#fff', background: 'var(--red)',
                borderRadius: 'var(--radius-pill)',
                flex: '0 0 auto',
              }}>{badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ────────── Morphing bottom bar — unused in current app.jsx
 * Kept as design-canvas reference. app.jsx uses ComposeBar and the
 * LiveSparky compose instead of mounting this. Safe to remove later. */
const SEARCH_PLACEHOLDERS = {
  leads:    { chip: 'LEADS »',    ph: 'SEARCH CUSTOMERS, PHONES, ADDRESSES...' },
  permits:  { chip: 'PERMITS »',  ph: 'SEARCH BY CUSTOMER OR JURISDICTION...' },
  materials:{ chip: 'MATERIALS »',ph: 'SEARCH BY CUSTOMER...' },
  calendar: { chip: 'CALENDAR »', ph: 'SEARCH EVENTS, INSTALLS, INSPECTIONS...' },
  finance:  { chip: 'FINANCE »',  ph: 'SEARCH PROPOSALS, INVOICES, PAYMENTS...' },
  messages: { chip: 'MESSAGES »', ph: 'SEARCH MESSAGE THREADS, CALL LOGS...' },
  sparky:   { chip: 'SPARKY »',   ph: 'ASK SPARKY ANYTHING...' },
};

function BottomBar({ mode = 'search', scope = 'leads', mobile = false, thread, sparkyMode = 'CHAT', centered = false, maxWidth = 880 }) {
  // ── inner row ──
  let innerInput, extras = null, accessoryRows = null;

  if (mode === 'search') {
    const cfg = SEARCH_PLACEHOLDERS[scope] || SEARCH_PLACEHOLDERS.leads;
    innerInput = <BarInput chip={cfg.chip} placeholder={cfg.ph} />;
    extras = (
      <>
        <span style={cmdKStyle}>⌘K</span>
        <button className="tactile-raised" style={iconBtnStyle}>{Ico.search}</button>
      </>
    );
  } else if (mode === 'sms') {
    innerInput = <BarInput
      chip={`TO: ${thread?.name?.toUpperCase() || 'CONTACT'} · ${thread?.phone || ''} »`}
      placeholder="TYPE A MESSAGE..."
    />;
    extras = (
      <>
        <button className="tactile-raised" style={{ ...iconBtnStyle, width: 24, height: 24 }}>{Ico.attach}</button>
        <button className="tactile-raised" style={{ ...iconBtnStyle, width: 32, height: 32, background: 'var(--navy)', color: '#fff' }}>{Ico.send}</button>
      </>
    );
    accessoryRows = <SmsAccessory mobile={mobile} />;
  } else if (mode === 'sparky') {
    innerInput = <BarInput chip="ASK SPARKY »" chipIcon="S" placeholder="ASK ANYTHING..." />;
    extras = (
      <>
        <span style={haikuBadgeStyle}>HAIKU-4-5</span>
        <button className="tactile-raised" style={{ ...iconBtnStyle, width: 32, height: 32, background: 'var(--navy)', color: '#fff' }}>{Ico.send}</button>
      </>
    );
    accessoryRows = <SparkyAccessory active={sparkyMode} />;
  }

  const outer = centered
    ? {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        display: 'flex', justifyContent: 'center',
        padding: '0 8px 8px',
        zIndex: 5,
      }
    : {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: mobile ? '0 8px calc(8px + env(safe-area-inset-bottom)) 8px' : '0 8px 8px 8px',
        zIndex: 5,
      };

  const inner = (
    <>
      {accessoryRows}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px',
        background: 'var(--card)',
        boxShadow: 'var(--raised)',
      }}>
        {innerInput}
        {extras}
      </div>
    </>
  );

  return (
    <div style={outer}>
      {centered ? (
        <div style={{ width: '100%', maxWidth }}>{inner}</div>
      ) : inner}
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28, display: 'grid', placeItems: 'center',
  color: 'var(--text)',
};
const cmdKStyle = {
  height: 24, padding: '0 8px', display: 'inline-flex', alignItems: 'center',
  background: 'var(--card)', boxShadow: 'var(--raised-2)',
  fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
  color: 'var(--text-muted)',
};
const haikuBadgeStyle = {
  height: 24, padding: '0 8px', display: 'inline-flex', alignItems: 'center',
  background: 'var(--lcd-bg)', color: 'var(--lcd-green)',
  textShadow: 'var(--lcd-glow-green)',
  boxShadow: 'var(--pressed-2)',
  fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: '.08em',
};

function BarInput({ chip, chipIcon, placeholder }) {
  return (
    <label style={{
      flex: 1, height: 40, display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 12px',
      background: 'var(--lcd-bg)',
      boxShadow: 'var(--pressed-2)',
    }}>
      {chip && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-pixel)', fontSize: 14,
          color: 'var(--gold)', letterSpacing: '.12em',
          textTransform: 'uppercase',
          textShadow: '0 0 6px rgba(212,145,26,.4)',
          whiteSpace: 'nowrap',
        }}>
          {chipIcon && <span style={{
            width: 16, height: 16, background: 'var(--gold)', color: '#000',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-pixel)', fontSize: 14, lineHeight: 1,
          }}>{chipIcon}</span>}
          {chip}
        </span>
      )}
      <input
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 400,
          color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
          letterSpacing: '.04em', textTransform: 'uppercase',
        }}
      />
    </label>
  );
}

function SmsAccessory({ mobile }) {
  const chips = ['SEND QUOTE', 'ASK FOR PHOTO', 'SCHEDULE INSTALL', 'MORNING CHECK', 'PASS TO KEY'];
  const actions = [
    { k: 'quote', i: Ico.quote, label: 'QUOTE' },
    { k: 'sched', i: Ico.sched, label: 'SCHEDULE' },
    { k: 'mat',   i: Ico.materials, label: 'MATERIALS' },
    { k: 'stat',  i: Ico.status, label: 'STATUS' },
    { k: 'note',  i: Ico.note, label: 'NOTE' },
  ];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: 8, marginBottom: 0,
      background: 'var(--card)', boxShadow: 'var(--raised)',
      borderBottom: '3px solid rgba(0,0,0,.12)',
    }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}>
        {chips.map(c => (
          <button key={c} className="tactile-raised chrome-label" style={{
            flex: '0 0 auto', height: 28, padding: '0 10px',
            fontSize: 11,
          }}>{c}</button>
        ))}
      </div>
      {mobile ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="tactile-raised" style={{
            width: 28, height: 28, display: 'grid', placeItems: 'center',
          }}>{Ico.dots}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {actions.map(a => (
            <button key={a.k} className="tactile-raised chrome-label" style={{
              height: 28, padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10,
            }}>{a.i}<span>{a.label}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

function SparkyAccessory({ active }) {
  const modes = ['CHAT', 'BRIEFING', 'INSIGHT', 'REPLY', 'DRAFT'];
  return (
    <div style={{
      display: 'flex', gap: 6, padding: 8,
      background: 'var(--card)', boxShadow: 'var(--raised)',
    }}>
      {modes.map(m => {
        const isOn = m === active;
        return (
          <button key={m} className="chrome-label" style={{
            height: 28, padding: '0 12px', fontSize: 11,
            background: isOn ? 'var(--navy)' : 'var(--card)',
            color: isOn ? '#fff' : 'var(--text)',
            boxShadow: isOn ? 'var(--pressed-2)' : 'var(--raised-2)',
          }}>{m}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, { TopBar, TabBar, BottomBar, Ico, TABS, MOBILE_DESKTOP_ONLY_TABS });
