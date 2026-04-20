#!/usr/bin/env node
/**
 * Alex end-to-end smoke test.
 *
 * Runs against LIVE production edge functions + LIVE Supabase tables.
 * Uses a synthetic test phone (1-800-555-XXXX) that would never be a real
 * customer, so the flow doesn't leak a real SMS to anyone.
 *
 * What it verifies, in order — each step that fails flags a specific bug
 * class that has burned us in the past:
 *
 *  1. quo-ai-new-lead responds in < 3s        — form-submit-blocks-spinner bug
 *  2. A contact row was created                — dedup or insert logic
 *  3. An alex_sessions row was created         — inlined session-creation works
 *  4. `messages` has the opener (outbound/ai)  — opener actually fires within 35s
 *  5. Opener text introduces Key              — opener-copy regressions
 *  6. alex-agent reachable WITHOUT Supabase JWT — gateway verify-jwt trap
 *  7. Simulated Quo `message.received` → 200  — alex-agent payload shape
 *  8. Inbound row appears in `messages`        — inbound-persist bug
 *  9. Exactly ONE outbound row after inbound  — double-opener bug
 * 10. Outbound row has sender='ai'            — CRM thread labeling
 * 11. Cleanup — everything test-related is deleted
 *
 * Usage:
 *   node scripts/alex/smoke.js           # full run
 *   node scripts/alex/smoke.js --keep    # skip cleanup (for debugging)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CREDS = fs.readFileSync(path.join(process.env.HOME, '.claude', 'credentials.md'), 'utf8');
const SB_KEY = CREDS.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[A-Za-z0-9._-]+/g)
  ?.find(k => { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { return false } });
if (!SB_KEY) { console.error('No service_role key found'); process.exit(1); }
const SB_URL = 'https://reowtzedjflwmlptupbk.supabase.co';

const args = new Set(process.argv.slice(2));
const KEEP = args.has('--keep');

// Fake test phone — never a real customer
const TEST_PHONE = '+18005550001';
const TEST_NAME = `SmokeTest${Date.now().toString().slice(-5)}`;

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method, host: u.host, path: u.pathname + u.search,
      headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
    }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: buf, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const sbGet = (table, query = '') => request(`${SB_URL}/rest/v1/${table}${query}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
const sbDel = (table, query) => request(`${SB_URL}/rest/v1/${table}${query}`, { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });

// ── Assertions ───────────────────────────────────────────────────────────────
let passes = 0, fails = 0;
const failures = [];
function pass(label) { console.log(`  ✓ ${label}`); passes++; }
function fail(label, detail) { console.log(`  ✗ ${label}\n    ${detail}`); fails++; failures.push({ label, detail }); }
function assert(cond, label, detail) { cond ? pass(label) : fail(label, detail || ''); return !!cond; }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(predicate, { timeout = 40000, interval = 2000, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await predicate();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Alex smoke test — ${TEST_NAME} / ${TEST_PHONE}\n`);
  let contactId = null;
  let sessionId = null;

  try {
    // ── STEP 1-3: form submit ────────────────────────────────────────────────
    console.log('STEP 1-3: form submit (quo-ai-new-lead)');
    const submitStart = Date.now();
    const submitRes = await request(`${SB_URL}/functions/v1/quo-ai-new-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: TEST_NAME, phone: TEST_PHONE,
        pageUrl: 'https://backuppowerpro.com/m/',
        source: 'smoke-test',
      }),
    });
    const submitMs = Date.now() - submitStart;
    let submitBody;
    try { submitBody = JSON.parse(submitRes.body) } catch { submitBody = {} }

    assert(submitRes.status === 200, `quo-ai-new-lead returns 200 (got ${submitRes.status})`, submitRes.body.slice(0, 150));
    assert(submitMs < 3000, `quo-ai-new-lead responds in <3s (took ${submitMs}ms)`,
      `Spinner-blocking bug: form submit is awaiting something heavy. Check for synchronous awaits before the Response.`);
    contactId = submitBody.contactId;
    sessionId = submitBody.alex?.sessionId;
    assert(!!contactId, 'contactId returned', `response: ${JSON.stringify(submitBody)}`);
    assert(!!sessionId, 'alex.sessionId returned');

    // ── STEP 4-5: opener fires within 35s ────────────────────────────────────
    console.log('\nSTEP 4-5: opener fires within 35s (typing delay is 18-30s)');
    const openerRow = await waitFor(async () => {
      const r = await sbGet('messages', `?contact_id=eq.${contactId}&direction=eq.outbound&order=created_at.asc&limit=1`);
      const rows = JSON.parse(r.body);
      return rows[0] || null;
    }, { timeout: 40000, interval: 3000, label: 'opener in messages table' });
    assert(!!openerRow, 'opener row appears in messages');
    const opener = openerRow.body || '';
    assert(opener.includes('Alex') && opener.includes('Backup Power Pro'),
      `opener identifies Alex + brand`, `got: ${opener.slice(0, 100)}`);
    assert(opener.includes('Key') && /licensed electric/i.test(opener),
      `opener introduces Key with title`, `got: ${opener.slice(0, 120)}`);
    assert(/what got you|what brought|backup power solution/i.test(opener),
      `opener asks the motivation question (not inventory probe)`, `got: ${opener.slice(0, 120)}`);

    // ── STEP 6: alex-agent reachable without Supabase JWT ────────────────────
    console.log('\nSTEP 6: alex-agent gateway — must accept unauthed Quo webhook');
    const unauthRes = await request(`${SB_URL}/functions/v1/alex-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping' }), // malformed on purpose; we only care about gateway
    });
    assert(unauthRes.status !== 401,
      `alex-agent NOT rejected by gateway verify-jwt (got ${unauthRes.status})`,
      `CRITICAL: alex-agent was redeployed with verify-jwt ON. Quo webhooks will be rejected. Redeploy with --no-verify-jwt.`);

    // ── STEP 7-10: simulate Quo inbound, assert Alex reply ───────────────────
    // Alex has TEST_MODE defaulting to true, which means it ignores inbound
    // from any phone except KEY_PHONE (+19414417996). Our synthetic test
    // phone (1-800-555-*) will get {skipped: 'test_mode'} — that's CORRECT
    // behavior. We still verify the full message-persistence + reply path
    // by checking for one of two outcomes:
    //   (a) TEST_MODE on: response body says test_mode skip (expected)
    //   (b) TEST_MODE off (production): inbound row lands + exactly one reply
    console.log('\nSTEP 7-10: simulated Quo message.received → alex-agent');
    const inboundRes = await request(`${SB_URL}/functions/v1/alex-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message.received',
        data: {
          object: {
            from: TEST_PHONE,
            to: ['+18644005302'],
            direction: 'incoming',
            body: 'yeah had a bad storm last month. just bought a 10kw champion',
            id: `smoke-test-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    });
    assert(inboundRes.status === 200, `alex-agent handles inbound (got ${inboundRes.status})`,
      inboundRes.body.slice(0, 200));

    let inboundBody;
    try { inboundBody = JSON.parse(inboundRes.body) } catch { inboundBody = {} }
    const isTestModeSkip = inboundBody.skipped && inboundBody.reason === 'test_mode';

    if (isTestModeSkip) {
      fail('alex-agent processed smoke-test inbound',
        `smoke phone not in ALEX_TEST_ALLOWLIST. Set ALEX_TEST_ALLOWLIST=${TEST_PHONE},...`);
      return;
    }

    // Full end-to-end — same path a real customer hits. Allowlisted phone
    // means alex-agent runs normally but DRY-runs the Quo API call (no
    // real SMS). We still verify the outbound row lands in messages table
    // with Alex's actual generated content.
    console.log('  waiting up to 45s for inbound persist + Alex dry-run reply...');
    const state = await waitFor(async () => {
      const r = await sbGet('messages', `?contact_id=eq.${contactId}&order=created_at.asc`);
      const rows = JSON.parse(r.body);
      const inbound = rows.filter(m => m.direction === 'inbound');
      const outbound = rows.filter(m => m.direction === 'outbound');
      if (inbound.length >= 1 && outbound.length >= 2) return { inbound, outbound, all: rows };
      return null;
    }, { timeout: 45000, interval: 3000, label: 'inbound persist + Alex reply' }).catch(() => null);

    if (!state) {
      const r = await sbGet('messages', `?contact_id=eq.${contactId}&order=created_at.asc`);
      const rows = JSON.parse(r.body);
      fail('alex-agent processes inbound + replies within 45s',
        `got ${rows.length} total rows. Thread:\n` +
        rows.map(m => `  [${m.created_at.slice(11, 19)}] ${m.direction}: ${(m.body || '').slice(0, 80)}`).join('\n'));
      return;
    }

    assert(state.inbound.length === 1, `inbound persisted (got ${state.inbound.length} inbound rows)`);
    assert(state.outbound.length === 2, `exactly 2 outbound rows (opener + Alex reply) — got ${state.outbound.length}`,
      `double-opener bug. Thread:\n` +
      state.all.map(m => `  [${m.created_at.slice(11, 19)}] ${m.direction}/${m.sender}: ${(m.body || '').slice(0, 70)}`).join('\n'));

    const alexReply = state.outbound[1].body || '';
    console.log(`  Alex replied: "${alexReply.slice(0, 100)}"`);
    assert(state.outbound[1].sender === 'ai', `Alex reply sender='ai'`);
    assert(!/—|–/.test(alexReply), 'no em/en dashes in Alex reply', `found dash in: ${alexReply}`);
    assert(!/\$\d|dollar|\d+\s?(?:bucks|k\b)/i.test(alexReply), 'no dollar amounts in Alex reply',
      `money reference in: ${alexReply}`);
    assert(alexReply.length < 500, `reply fits in SMS (under 500 chars, got ${alexReply.length})`);

    // Multi-turn: second inbound should get one more Alex response on the SAME session
    console.log('\n  Multi-turn: send second inbound, verify no double-opener');
    const secondInbound = await request(`${SB_URL}/functions/v1/alex-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message.received',
        data: { object: {
          from: TEST_PHONE, to: ['+18644005302'], direction: 'incoming',
          body: 'panel is in the garage',
          id: `smoke-test-${Date.now()}-2`, createdAt: new Date().toISOString(),
        }},
      }),
    });
    assert(secondInbound.status === 200, 'second inbound accepted');

    const after = await waitFor(async () => {
      const r = await sbGet('messages', `?contact_id=eq.${contactId}&order=created_at.asc`);
      const rows = JSON.parse(r.body);
      if (rows.filter(m => m.direction === 'inbound').length >= 2 &&
          rows.filter(m => m.direction === 'outbound').length >= 3) return rows;
      return null;
    }, { timeout: 30000, interval: 3000, label: 'second reply' }).catch(() => null);

    if (!after) {
      fail('Alex responds to second inbound', 'second reply never landed within 30s');
    } else {
      const afterOut = after.filter(m => m.direction === 'outbound');
      assert(afterOut.length === 3, `exactly 3 outbound total (opener + 2 replies), got ${afterOut.length}`,
        `double-opener or duplicate-reply bug. Thread:\n` +
        after.map(m => `  [${m.created_at.slice(11, 19)}] ${m.direction}/${m.sender}: ${(m.body || '').slice(0, 70)}`).join('\n'));
      const reply2 = afterOut[2].body || '';
      console.log(`  Alex 2nd reply: "${reply2.slice(0, 100)}"`);
      // Rule checks on second reply too
      assert(!/—|–/.test(reply2), 'no dashes in 2nd reply');
      assert(!/\$\d|dollar/i.test(reply2), 'no dollar amounts in 2nd reply');
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${passes} passed, ${fails} failed`);
    if (fails > 0) {
      console.log('\nFailures:');
      for (const f of failures) console.log(`  ✗ ${f.label}\n    ${f.detail}`);
    }

  } finally {
    // ── STEP 11: cleanup ─────────────────────────────────────────────────────
    if (KEEP) {
      console.log(`\n(--keep set; test data preserved. contact=${contactId} session=${sessionId})`);
    } else if (contactId) {
      console.log('\nSTEP 11: cleanup');
      for (const t of ['messages', 'follow_up_queue', 'sms_consent_log']) {
        const r = await sbDel(t, `?contact_id=eq.${contactId}`);
        console.log(`  ${t}: ${r.status}`);
      }
      await sbDel('alex_sessions', `?phone=eq.${encodeURIComponent(TEST_PHONE)}`);
      await sbDel('sparky_memory', `?key=like.contact:${encodeURIComponent(TEST_PHONE)}:%25`);
      await sbDel('contacts', `?id=eq.${contactId}`);
      console.log('  cleaned.');
    }
  }

  process.exit(fails > 0 ? 1 : 0);
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(2); });
