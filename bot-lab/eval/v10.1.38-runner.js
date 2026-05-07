// v10.1.38 brutal-runner — replays the 54 v10.1.14 scenarios against the
// current bot-lab/state-machine.js, captures terminals, audit hits, and
// surfaces drift vs the v10.1.14 baseline (which passed 54/54 on 2026-05-03).
//
// Scenarios in v10.1.14-brutal-scenarios.js have NO explicit expected_terminal
// field, but the scenario NAME encodes the intended outcome. We infer the
// expected terminal set per scenario name and accept any match in that set.
//
// Read-only: does not mutate any state-machine code.

'use strict';

const path = require('path');
const fs = require('fs');

const REPO = '/Users/keygoodson/Desktop/CLAUDE';
const harness = require(path.join(REPO, 'bot-lab/eval/v10.1.14-brutal-harness.js'));
const SCENARIOS = require(path.join(REPO, 'bot-lab/eval/v10.1.14-brutal-scenarios.js'));

// Baseline terminals from v10.1.14-brutal-transcript.txt (54/54 pass on
// 2026-05-03). We treat that run as canonical: a scenario PASSES if the
// current terminal matches the v10.1.14 baseline exactly. Drift from the
// baseline = regression to investigate (or a deliberate v10.1.32+ change
// that needs an updated baseline).
//
// COMPLETE is treated as a successful continuation of SCHEDULE_QUOTE (since
// SCHEDULE_QUOTE -> COMPLETE on friendly_chitchat in v10.1.32+). So a baseline
// of SCHEDULE_QUOTE accepts current terminal in {SCHEDULE_QUOTE, COMPLETE}.
const BASELINE = {
  'S1':  'COMPLETE',
  'S2':  'DISQUALIFIED_120V',
  'S3':  'SCHEDULE_QUOTE',
  'S4':  'DISQUALIFIED_120V',
  'S5':  'SCHEDULE_QUOTE',
  'S6':  'NEEDS_CALLBACK',
  'S7':  'SCHEDULE_QUOTE',
  'S8':  'STOPPED',
  'S9':  'SCHEDULE_QUOTE',
  'S10': 'SCHEDULE_QUOTE',
  'S11': 'SCHEDULE_QUOTE',
  'S12': 'POSTPONED',
  'S13': 'NEEDS_CALLBACK',
  'S14': 'DISQUALIFIED_RENTER',
  'S15': 'SCHEDULE_QUOTE',
  'S16': 'NEEDS_CALLBACK',
  'S17': 'SCHEDULE_QUOTE',
  'S18': 'SCHEDULE_QUOTE',
  'S19': 'DISQUALIFIED_120V',
  'S20': 'NEEDS_CALLBACK',
  'S21': 'DISQUALIFIED_120V',
  'S22': 'SCHEDULE_QUOTE',
  'S23': 'SCHEDULE_QUOTE',
  'S24': 'SCHEDULE_QUOTE',
  'S25': 'SCHEDULE_QUOTE',
  'S26': 'SCHEDULE_QUOTE',
  'S27': 'DISQUALIFIED_120V',
  'S28': 'SCHEDULE_QUOTE',
  'S29': 'SCHEDULE_QUOTE',
  'N1':  'NEEDS_CALLBACK',
  'N2':  'NEEDS_CALLBACK',
  'N3':  'NEEDS_CALLBACK',
  'N4':  'SCHEDULE_QUOTE',
  'N5':  'SCHEDULE_QUOTE',
  'N6':  'SCHEDULE_QUOTE',
  'N7':  'SCHEDULE_QUOTE',
  'N8':  'DISQUALIFIED_OUT_OF_AREA',
  'N9':  'SCHEDULE_QUOTE',
  'N10': 'DISQUALIFIED_OUT_OF_AREA',
  'B1':  'SCHEDULE_QUOTE',
  'B2':  'SCHEDULE_QUOTE',
  'B3':  'SCHEDULE_QUOTE',
  'P1':  'NEEDS_CALLBACK',
  'P2':  'SCHEDULE_QUOTE',
  'P3':  'SCHEDULE_QUOTE',
  'P4':  'SCHEDULE_QUOTE',
  'P5':  'SCHEDULE_QUOTE',
  'P6':  'SCHEDULE_QUOTE',
  'P7':  'SCHEDULE_QUOTE',
  'T1':  'SCHEDULE_QUOTE',
  'T2':  'SCHEDULE_QUOTE',
  'T3':  'SCHEDULE_QUOTE',
  'T4':  'NEEDS_CALLBACK',
  'T5':  'SCHEDULE_QUOTE',
};
const TERMINAL_SETS_LEGACY_UNUSED = {
  'S1':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S2':  ['NEEDS_CALLBACK'],   // 3-prong → soft-DQ, then dont_own_generator pushes to callback
  'S3':  ['SCHEDULE_QUOTE', 'COMPLETE'],   // hazardous Zinsco still routes through, flagged in qd
  'S4':  ['NEEDS_CALLBACK'],   // Predator 3500 = 120V-only DQ
  'S5':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S6':  ['NEEDS_CALLBACK', 'STOPPED'],
  'S7':  ['SCHEDULE_QUOTE', 'COMPLETE'],   // FPE flagged, route continues
  'S8':  ['STOPPED'],
  'S9':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],   // EU7000iS voltage selector ambiguity → callback OR continue
  'S10': ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S11': ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S12': ['POSTPONED', 'NEEDS_CALLBACK'],
  'S13': ['NEEDS_CALLBACK', 'SCHEDULE_QUOTE', 'COMPLETE'],
  'S14': ['DISQUALIFIED_RENTER'],
  'S15': ['SCHEDULE_QUOTE', 'COMPLETE'],   // bot answers and continues
  'S16': ['NEEDS_CALLBACK'],   // detached + no access = needs Key
  'S17': ['SCHEDULE_QUOTE', 'COMPLETE'],   // typo confirmed, recovers
  'S18': ['DISQUALIFIED_OUT_OF_AREA'],
  'S19': ['NEEDS_CALLBACK'],   // post-DQ recommendation question
  'S20': ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'S21': ['NEEDS_CALLBACK'],   // photo contradicts customer claim
  'S22': ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S23': ['SCHEDULE_QUOTE', 'COMPLETE'],
  'S24': ['NEEDS_CALLBACK', 'SCHEDULE_QUOTE', 'COMPLETE'],
  'S25': ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],   // coverage Q mid-flow, defer to Key
  'S26': ['NEEDS_CALLBACK'],   // sizing Q = Key only
  'S27': ['NEEDS_CALLBACK'],   // DQ_120V + coverage push
  'S28': ['NEEDS_CALLBACK'],   // sizing Q = Key only
  'S29': ['NEEDS_CALLBACK', 'SCHEDULE_QUOTE', 'COMPLETE'],
  'N1':  ['NEEDS_CALLBACK'],   // non-English handoff
  'N2':  ['NEEDS_CALLBACK'],   // ATS = scope mismatch
  'N3':  ['NEEDS_CALLBACK'],   // 22kW whole-home standby = Key only
  'N4':  ['SCHEDULE_QUOTE', 'COMPLETE'],   // licensed/insured Q answered, continues
  'N5':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'N6':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'N7':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'N8':  ['DISQUALIFIED_OUT_OF_AREA'],
  'N9':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'N10': ['DISQUALIFIED_OUT_OF_AREA'],
  'B1':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'B2':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'B3':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'P1':  ['NEEDS_CALLBACK', 'SCHEDULE_QUOTE', 'COMPLETE'],
  'P2':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'P3':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'P4':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'P5':  ['NEEDS_CALLBACK'],   // knob-and-tube = Key
  'P6':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'P7':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'T1':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'T2':  ['SCHEDULE_QUOTE', 'COMPLETE', 'NEEDS_CALLBACK'],
  'T3':  ['SCHEDULE_QUOTE', 'COMPLETE'],
  'T4':  ['NEEDS_CALLBACK'],
  'T5':  ['SCHEDULE_QUOTE', 'COMPLETE'],
};

function expectedFor(scenarioName) {
  const m = scenarioName.match(/^([A-Z]\d+)/);
  if (!m) return null;
  const baseline = BASELINE[m[1]];
  if (!baseline) return null;
  // SCHEDULE_QUOTE accepts COMPLETE as drop-in (v10.1.32+ SQ→COMPLETE on chitchat)
  if (baseline === 'SCHEDULE_QUOTE') return ['SCHEDULE_QUOTE', 'COMPLETE'];
  return [baseline];
}

function main() {
  const t0 = Date.now();
  const results = [];
  let passed = 0, failed = 0, errored = 0;
  let totalAuditHits = 0;
  const auditHistogram = {};
  const allFailures = [];

  for (const sc of SCENARIOS) {
    let r;
    try {
      r = harness.runScenario(sc);
    } catch (e) {
      errored++;
      allFailures.push({ name: sc.name, error: e.message, stack: e.stack });
      results.push({ name: sc.name, status: 'ERROR', error: e.message });
      continue;
    }
    const expected = expectedFor(sc.name);
    const ok = expected && expected.includes(r.terminal);

    // Count audit hits
    let scenarioAudit = 0;
    for (const e of r.transcript) {
      if (e.role === 'bot' && e.audit && e.audit.length) {
        scenarioAudit += e.audit.length;
        for (const rule of e.audit) {
          auditHistogram[rule] = (auditHistogram[rule] || 0) + 1;
        }
      }
    }
    totalAuditHits += scenarioAudit;

    if (ok) {
      passed++;
      results.push({ name: sc.name, status: 'PASS', terminal: r.terminal, audits: scenarioAudit });
    } else {
      failed++;
      const last5 = r.transcript.slice(-10).filter(e => e.role === 'bot' || e.role === 'customer' || e.role === 'state_machine');
      allFailures.push({
        name: sc.name,
        expected: expected || '(unmapped)',
        actual: r.terminal,
        last_lines: last5,
      });
      results.push({ name: sc.name, status: 'FAIL', expected, terminal: r.terminal, audits: scenarioAudit });
    }
  }

  const elapsed = Date.now() - t0;

  // Build transcript file with all 54 full transcripts
  const transcriptOut = [];
  transcriptOut.push(`# v10.1.38 brutal run — ${new Date().toISOString()}`);
  transcriptOut.push(`# ${passed}/${SCENARIOS.length} PASS, ${failed} FAIL, ${errored} ERROR`);
  transcriptOut.push(`# total audit hits: ${totalAuditHits}`);
  transcriptOut.push(`# runtime: ${elapsed}ms`);
  transcriptOut.push('');

  for (const sc of SCENARIOS) {
    let r;
    try { r = harness.runScenario(sc); } catch (_) { continue; }
    transcriptOut.push(harness.renderTranscript(r));
    transcriptOut.push('');
    transcriptOut.push('-'.repeat(80));
    transcriptOut.push('');
  }

  fs.writeFileSync(path.join(REPO, 'bot-lab/eval/v10.1.38-transcript.txt'), transcriptOut.join('\n'));

  // Print summary report
  console.log(`\n=== v10.1.38 BRUTAL RUN ===`);
  console.log(`Total scenarios: ${SCENARIOS.length}`);
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);
  console.log(`ERROR: ${errored}`);
  console.log(`Total audit hits: ${totalAuditHits}`);
  console.log(`Runtime: ${elapsed}ms`);
  console.log('');
  console.log(`Audit rule histogram:`);
  const sortedAudit = Object.entries(auditHistogram).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedAudit) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log('');
  if (allFailures.length) {
    console.log(`=== FAILURES (${allFailures.length}) ===`);
    for (const f of allFailures) {
      console.log(`\n— ${f.name}`);
      if (f.error) {
        console.log(`  ERROR: ${f.error}`);
      } else {
        console.log(`  expected: ${JSON.stringify(f.expected)}`);
        console.log(`  actual:   ${f.actual}`);
        console.log(`  last lines:`);
        for (const e of f.last_lines) {
          if (e.role === 'bot') console.log(`    [T${e.turn}] BOT(${e.state}): ${(e.text||'').slice(0,140)}`);
          else if (e.role === 'customer') console.log(`    [T${e.turn}] CUST: ${(e.text||'').slice(0,140)}`);
          else if (e.role === 'state_machine') console.log(`    [T${e.turn}] SM: ${e.from} -> ${e.to}`);
        }
      }
    }
  }

  return { passed, failed, errored, totalAuditHits, auditHistogram, allFailures, elapsed };
}

if (require.main === module) {
  main();
}

module.exports = { main };
