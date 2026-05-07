// v10.1.39 brutal-runner — runs all 54 v10.1.14 scenarios PLUS 5 new
// v10.1.39 scenarios that exercise prod-only transitions ported into
// bot-lab/state-machine.js (v10.1.32 / v10.1.33 / v10.1.36).
//
// Reads expected_terminal directly from each scenario object (now locked
// per scenario in v10.1.14-brutal-scenarios.js + v10.1.39-new-scenarios.js).
// No more inferring from name.

'use strict';

const path = require('path');
const fs = require('fs');

const REPO = '/Users/keygoodson/Desktop/CLAUDE';
const harness = require(path.join(REPO, 'bot-lab/eval/v10.1.14-brutal-harness.js'));
const ORIGINAL = require(path.join(REPO, 'bot-lab/eval/v10.1.14-brutal-scenarios.js'));
const NEW = require(path.join(REPO, 'bot-lab/eval/v10.1.39-new-scenarios.js'));
const SCENARIOS = ORIGINAL.concat(NEW);

function expectedFor(sc) {
  if (!sc.expected_terminal) return null;
  // Treat SCHEDULE_QUOTE and COMPLETE as drop-in equivalents (v10.1.32+
  // SQ -> COMPLETE on friendly_chitchat). A scenario expecting SQ accepts
  // either; a scenario expecting COMPLETE accepts only COMPLETE.
  if (sc.expected_terminal === 'SCHEDULE_QUOTE') return ['SCHEDULE_QUOTE', 'COMPLETE'];
  return [sc.expected_terminal];
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
    const expected = expectedFor(sc);
    const ok = expected && expected.includes(r.terminal);

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
      const last5 = r.transcript.slice(-12).filter(e => e.role === 'bot' || e.role === 'customer' || e.role === 'state_machine');
      allFailures.push({
        name: sc.name,
        expected: expected || '(no expected_terminal)',
        actual: r.terminal,
        last_lines: last5,
      });
      results.push({ name: sc.name, status: 'FAIL', expected, terminal: r.terminal, audits: scenarioAudit });
    }
  }

  const elapsed = Date.now() - t0;

  // Build full transcript output
  const transcriptOut = [];
  transcriptOut.push(`# v10.1.39 brutal run — ${new Date().toISOString()}`);
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

  fs.writeFileSync(path.join(REPO, 'bot-lab/eval/v10.1.39-transcript.txt'), transcriptOut.join('\n'));

  console.log(`\n=== v10.1.39 BRUTAL RUN ===`);
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
      console.log(`\n--- ${f.name}`);
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
