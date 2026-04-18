/* global React */
// Calendar — weekly grid (desktop) + daily agenda (mobile)

const DAYS = [
  { abbr: 'MON', n: 13 },
  { abbr: 'TUE', n: 14 },
  { abbr: 'WED', n: 15 },
  { abbr: 'THU', n: 16 },
  { abbr: 'FRI', n: 17, open: true },
  { abbr: 'SAT', n: 18 },
  { abbr: 'SUN', n: 19 },
];
const TODAY_IDX = 3; // THU

const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19]; // 8a–7p
const HOUR_H = 56; // px per hour

// event starts at `h` (24h), runs `dur` hours, in column `day`
const EVENTS = [
  { day:1, type:'install', start:9,  dur:4, label:'INSTALL',    who:'Robert K' },
  { day:1, type:'follow',  start:15.75, dur:.5, label:'FOLLOW-UP', who:'Sarah M · 3:45P' },
  { day:2, type:'inspect', start:10, dur:1, label:'INSPECTION', who:'Mark L' },
  { day:2, type:'permit',  start:14, dur:.5,label:'PERMIT',     who:'PICKUP', badge:true },
  { day:3, type:'install', start:8,  dur:8, label:'INSTALL · ALL DAY', who:'Helen S' },
  { day:5, type:'install', start:9,  dur:4, label:'INSTALL',    who:'Mike J' },
];

const CalIcons = {
  arrowL: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3 L4 8 L10 13"/></svg>,
  arrowR: <svg viewBox="0 0 16 16" width="14" height="14"><path d="M6 3 L12 8 L6 13"/></svg>,
  key:    <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="5" cy="8" r="3"/><path d="M8 8 L14 8 M11 8 L11 11"/></svg>,
};

function EventBlock({ e }) {
  const h = Math.max(28, e.dur * HOUR_H - 4);
  const top = (e.start - HOURS[0]) * HOUR_H + 2;

  if (e.badge) {
    return (
      <div style={{
        position: 'absolute', top, left: 4, right: 4, height: 28,
        background: 'var(--card)', boxShadow: 'var(--raised-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        color: 'var(--gold)',
      }}>
        {CalIcons.key}
        <span className="chrome-label" style={{ fontSize: 9, color: 'var(--text)' }}>{e.who}</span>
      </div>
    );
  }
  if (e.type === 'follow') {
    return (
      <div style={{
        position: 'absolute', top, left: 4, right: 4, height: 22,
        background: 'var(--card)', boxShadow: 'var(--pressed-2)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
        borderLeft: '3px solid var(--ms-4)',
      }}>
        <span className="chrome-label" style={{ fontSize: 9, color: 'var(--ms-4)' }}>{e.label}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.who}</span>
      </div>
    );
  }
  const isInspect = e.type === 'inspect';
  return (
    <div className="tactile-raised" style={{
      position: 'absolute', top, left: 4, right: 4, height: h,
      background: isInspect ? 'var(--gold)' : 'var(--navy)',
      color: isInspect ? '#1a1a1a' : '#fff',
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span className="chrome-label" style={{ fontSize: 9, color: isInspect ? '#1a1a1a' : 'var(--gold)' }}>{e.label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{e.who}</span>
    </div>
  );
}

function CalHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="tactile-raised" style={{ width: 32, height: 32, background: 'var(--card)', color: 'var(--text)', display: 'grid', placeItems: 'center' }}>{CalIcons.arrowL}</button>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 22, letterSpacing: '.08em', color: 'var(--text)' }}>
          WEEK OF APR 13, 2026
        </span>
        <button className="tactile-raised" style={{ width: 32, height: 32, background: 'var(--card)', color: 'var(--text)', display: 'grid', placeItems: 'center' }}>{CalIcons.arrowR}</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="tactile-raised chrome-label" style={{
          height: 32, padding: '0 14px', fontSize: 11,
          background: 'var(--gold)', color: '#1a1a1a',
        }}>TODAY</button>
        <div style={{ display: 'flex', height: 32, boxShadow: 'var(--raised-2)' }}>
          {['DAY','WEEK','MONTH'].map(v => {
            const on = v === 'WEEK';
            return (
              <button key={v} className="chrome-label" style={{
                height: 32, padding: '0 12px', fontSize: 11,
                background: on ? 'var(--navy)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--text)',
                boxShadow: on ? 'var(--pressed-2)' : 'none',
              }}>{v}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CalHeader />
      <div style={{ padding: '0 16px 88px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'var(--card)', boxShadow: 'var(--pressed-2)',
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid rgba(0,0,0,.15)' }}>
            <div />
            {DAYS.map((d, i) => {
              const isToday = i === TODAY_IDX;
              return (
                <div key={i} style={{
                  padding: '10px 0', textAlign: 'center',
                  borderLeft: '1px solid rgba(0,0,0,.08)',
                  background: isToday ? 'rgba(220,38,38,.05)' : 'transparent',
                }}>
                  <div className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.abbr}</div>
                  <div style={{
                    fontFamily: 'var(--font-pixel)', fontSize: 22,
                    color: isToday ? 'var(--lcd-red)' : 'var(--text)',
                    textShadow: isToday ? 'var(--lcd-glow-red)' : 'none',
                    lineHeight: 1,
                  }}>{d.n}</div>
                </div>
              );
            })}
          </div>
          {/* Grid body */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Time column */}
            <div style={{ position: 'relative', borderRight: '1px solid rgba(0,0,0,.08)' }}>
              {HOURS.map((h, i) => (
                <div key={i} style={{ height: HOUR_H, display: 'flex', justifyContent: 'flex-end', padding: '2px 6px 0 0' }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--text-muted)', letterSpacing: '.06em' }}>
                    {h > 12 ? `${h-12}P` : `${h}${h===12?'P':'A'}`}
                  </span>
                </div>
              ))}
            </div>
            {/* Day columns */}
            {DAYS.map((d, di) => (
              <div key={di} style={{
                position: 'relative', borderLeft: '1px solid rgba(0,0,0,.08)',
                background: di === TODAY_IDX ? 'rgba(220,38,38,.025)' : 'transparent',
              }}>
                {/* Hour grid lines */}
                {HOURS.map((_, i) => (
                  <div key={i} style={{
                    height: HOUR_H,
                    borderBottom: '1px solid rgba(0,0,0,.05)',
                  }} />
                ))}
                {d.open && (
                  <span style={{
                    position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                    fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--text-faint)', letterSpacing: '.1em',
                  }}>OPEN</span>
                )}
                {EVENTS.filter(e => e.day === di).map((e, ei) => (
                  <EventBlock key={ei} e={e} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile daily agenda ── */
function CalendarMobile() {
  // Collapse events by day; only show days with events + today
  const byDay = DAYS.map((d, i) => ({ ...d, i, events: EVENTS.filter(e => e.day === i) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, letterSpacing: '.08em', color: 'var(--text)' }}>
          APR 13 – 19, 2026
        </span>
        <button className="tactile-raised chrome-label" style={{
          height: 26, padding: '0 10px', fontSize: 10,
          background: 'var(--gold)', color: '#1a1a1a',
        }}>TODAY</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {byDay.map((d, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              background: 'var(--card)', boxShadow: 'var(--pressed-2)',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              <span className="chrome-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.abbr}</span>
              <span style={{
                fontFamily: 'var(--font-pixel)', fontSize: 18,
                color: i === TODAY_IDX ? 'var(--lcd-red)' : 'var(--text)',
                textShadow: i === TODAY_IDX ? 'var(--lcd-glow-red)' : 'none',
              }}>APR {d.n}</span>
              {i === TODAY_IDX && (
                <span style={{
                  marginLeft: 'auto', padding: '2px 6px',
                  background: 'var(--lcd-bg)', boxShadow: 'var(--pressed-2)',
                  color: 'var(--lcd-red)', textShadow: 'var(--lcd-glow-red)',
                  fontFamily: 'var(--font-pixel)', fontSize: 11, letterSpacing: '.08em',
                }}>TODAY</span>
              )}
              {d.events.length === 0 && (
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--text-faint)' }}>OPEN</span>
              )}
            </div>
            {d.events.map((e, ei) => {
              const timeStr = (h) => {
                const H = Math.floor(h);
                const M = Math.round((h - H) * 60);
                const p = H >= 12 ? 'P' : 'A';
                const HH = ((H + 11) % 12) + 1;
                return M ? `${HH}:${String(M).padStart(2,'0')}${p}` : `${HH}${p}`;
              };
              const bg = e.type === 'install' ? 'var(--navy)' : e.type === 'inspect' ? 'var(--gold)' : 'var(--card)';
              const fg = e.type === 'install' ? '#fff' : e.type === 'inspect' ? '#1a1a1a' : 'var(--text)';
              const lbl = e.type === 'install' ? 'var(--gold)' : e.type === 'inspect' ? '#1a1a1a' : 'var(--ms-4)';
              return (
                <div key={ei} style={{
                  display: 'flex', marginTop: 4,
                  background: 'var(--card)',
                }}>
                  <div style={{
                    width: 90, padding: '8px 10px',
                    background: 'var(--card)', boxShadow: 'var(--pressed-2)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--text)' }}>
                      {timeStr(e.start)}
                    </span>
                    {e.dur >= 1 && (
                      <span className="chrome-label" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {e.dur}H
                      </span>
                    )}
                  </div>
                  <div className="tactile-raised" style={{
                    flex: 1, background: bg, color: fg,
                    padding: '8px 10px', marginLeft: 4,
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <span className="chrome-label" style={{ fontSize: 9, color: lbl }}>{e.label}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>{e.who}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CalendarDesktop, CalendarMobile });
