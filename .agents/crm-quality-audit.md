# BPP CRM Quality Audit

## 1. BUGS FOUND

### Console.log in Production Code (Line 2104)
**Severity:** Medium — Leaks debug output to browser console in production
```javascript
// Line 2104: fireMetaEvent function
if (!META_CAPI_TOKEN) { console.log('[Meta CAPI] Skipped — no token (needs backend proxy)'); return; }
```
**Fix:** Replace with silent return or use `console.warn()` only if needed for dev debugging.

### Console.warn in Production (Line 4947)
**Severity:** Low — Same pattern
```javascript
// Line 4947: loadJurisdictions
if (error) { console.warn('Jurisdictions load failed:', error.message); return; }
```

### Onclick Attribute Injected via innerHTML (Line 3033)
**Severity:** Medium — Direct string concatenation creates onclick handlers; fragile if contactId contains quotes
```javascript
// Line 3033: loadInvoiceSection
el.innerHTML = '<button class="btn btn-outline" ... onclick="copyInvoiceLink(\'' + contactId + '\')">Copy Invoice Link</button>';
```
**Risk:** If contactId ever contains a quote, the HTML breaks. Should use `addEventListener` instead.

### setAttribute("onclick", ...) Pattern (Lines 2465, 2468)
**Severity:** Low — Sets onclick via string attribute; redundant with addEventListener pattern used elsewhere
```javascript
// Lines 2465-2468: drillTo function
inspBackBtn.setAttribute('onclick', "drillTo('payment')");
inspBackBtn.setAttribute('onclick', "drillTo('proposal')");
```
**Why problematic:** Sets onclick twice on same element; only the second wins. Should batch into one logic.

### Missing Null Check in confirmPayment (Line 3093)
**Severity:** Low — Assumes contact exists after insertion
```javascript
// Line 3093-3098: confirmPayment
const c = allContacts.find(function(x) { return x.id === contactId; });
if (c) { c.quote_amount = amount; ... }  // OK here, has check
```
This is fine, but line 3094 fires Meta event even if c is null (though c is checked before use).

### Invoice Lookup May Return Multiple Rows (Lines 3163, 3192)
**Severity:** Low — Query should `.limit(1)` before `.neq()` for safety
```javascript
// Line 3163: copyInvoiceLink
const { data: existing } = await db.from('invoices')
  .select('token')
  .eq('contact_id', contactId)
  .neq('status', 'cancelled')
  .order('created_at', { ascending: false })
  .limit(1);  // ✓ Has limit
```
Actually OK; both have `.limit(1)`.

### lockBody/unlockBody Mismatch Risk (Lines 4902-4915)
**Severity:** Low — Counter-based pattern is correct, but if `lockBody()` is called multiple times without matching `unlockBody()`, the counter grows. No current bug, but fragile.

---

## 2. REDUNDANT PATHS

### Three ways to close the side panel:
1. **Line 1599:** `onclick="if(event.target===this)panelSave()"` on overlay
2. **Line 3371-3397:** `closePanel()` function (removes 'open' class)
3. **Line 3399-3402:** `cancelPanel()` function (calls `closePanel()` then `loadContacts()`)

**Issue:** `panelSave()` on overlay click calls `closePanel()` → but also calls `panelSave()` logic. User can close panel three ways: overlay click, back gesture, explicit close. This is acceptable UX (multiple ways to exit is good), but the naming is confusing. `panelSave()` is invoked on overlay click, which should actually close without saving if no drill level change.

**Line 3425-3427 mitigates this:** If `currentDrillLevel !== 'contact'`, it just closes without validation. So this is intentional. **Not actually redundant.**

### Multiple ways to open contact modal:
1. **Line 2357:** `addFromSearch()` calls `openContactModal(null)`
2. **Line 1213:** FAB button `onclick="openContactModal(null)"`
3. **Line 7462:** Command palette entry

**Not redundant — same action, multiple entry points (acceptable).**

### Modal open pattern is inconsistent:
- **Line 2375:** `classList.add('open')` in `openContactModal()`
- **Line 4024:** `classList.add('open')` in `openProposalModal()`
- **Line 5265, 5363:** `className = 'modal-overlay open'` (overwrites class)

**Issue:** Creating modals dynamically (lines 5265, 5363) uses direct `className` assignment, which overwrites any existing classes. Could lose state if multiple classes present. Better to use `classList.add()`.

### Two distinct payment-recording flows:
1. **Line 3083-3110:** `confirmPayment()` — full flow: validate method, save to DB, fire Meta event, advance stage, render UI
2. **Line 3142-3155:** `collectPayment()` — simpler: insert payment, update quote_amount, fire Meta event, render

**Issue:** These are almost identical. `collectPayment()` is only called from one place (line 3142 ref). Could be merged with a flag parameter to reduce duplication.

### Invoice link generation duplicated (Lines 3157-3186 vs 3188-3218):
- **copyInvoiceLink()** — creates unpaid invoice, returns link
- **copyReceiptLink()** — creates or finds paid invoice, returns link

Both check if invoice exists, create if not. **Acceptable (different status logic).**

### Contact panel state reset happens in two places:
1. **Line 2496-2549:** `openPanel()` resets drill, archive state, details collapse
2. **Line 3399-3402:** `cancelPanel()` just calls `closePanel()` + `loadContacts()`

If user is on a drill level and presses overlay cancel, it closes the panel but doesn't reset state for next open. **Minor issue:** When re-opening, previous drill level state (e.g., 'messages') persists until explicitly reset.

---

## 3. UX FRICTION POINTS

### Tap Target Too Small: Undo Payment Button (Line 3116-3132)
The "undo payment" uses a two-tap confirmation pattern:
- First tap: changes text to "Sure?" (button text changes)
- Second tap: actually deletes
- 3-second timeout to reset

**Issue:** Button selector uses string matching on `onclick` attribute (line 3126), which is fragile. Also the confirmation state is only visual (text change) — not obvious to user. Better: show explicit "Confirm?" button or use a modal.

### Quick Actions (QA) Panel Hidden by Default (Line 1694-1710)
QA buttons exist but aren't highlighted. Users must know to click buttons to reveal inline editor.
**Friction:** If QA buttons are secondary, they shouldn't be in the primary message thread. Consider: move to dedicated "Actions" section or make always-visible.

### Search Results → Add Lead Flow (Line 2218)
Search shows "Add New Lead" button but only after search. New users might not discover this.
**Friction:** Button buried in search results. Consider: prominent "Create Lead" in empty state.

### Proposal Modal Has Two Save Buttons (Lines 1532, 1537)
- Line 1532: "Copy Link" button (in footer)
- Line 1537: "Create & Get Link" button (separate, below)

**Friction:** Two CTAs doing nearly the same thing. User must understand difference. **Better:** Combine into one primary action.

### Invoice Editing Requires Re-rendering (Line 3072-3083)
Adding invoice line items requires clicking "+ Add Line Item" and re-rendering entire table. No inline editing.
**Friction:** Three clicks minimum to add a line. Consider: inline form on first interaction.

### Payment Method Selection (Line 2989-3004)
`selectPayMethod(method)` updates UI but doesn't persist selection. User must re-select on next payment.
**Friction:** State lost on page reload or panel re-open. Consider: store in localStorage.

### Permission/Jurisdiction Modal (Lines 1733-1745)
Jurisdiction view modal is separate from contact panel. Must close this to access contact.
**Friction:** Two-level nesting (contact panel → jurisdiction modal) requires closing jurisdiction to interact with contact info.

### Calendar Event Creation (Line 4359)
Requires clicking day cell to open modal. No quick "+" button visible on days.
**Friction:** Subtle affordance. Consider: visible "+ Event" button on each day.

---

## 4. VISUAL CLUTTER

### Too Many Secondary Buttons in Quote Builder (Lines 1361-1387)
- Two amp buttons (30A, 50A) — duplicates selection
- Multiple feature toggles (cord, main breaker, twin/quad)
- All take up horizontal space, creating button soup

**Issue:** Desktop view shows all options; mobile might wrap awkwardly. Consider: condensed button groups or tabs instead of inline toggles.

### Proposal Cards Show Too Much (Lines 2556-2575)
Each proposal card displays: status badge, amp type, surge label, POM label, price, AND a "View" button. Cards feel cramped.
**Clutter:** Reduce to: status badge + price, with click-to-expand for details.

### Kanban Column Headers Redundant (Lines 7122-7131)
Each column shows:
1. Column name (label)
2. Item count
3. "NEXT" arrow
4. Next action hint

On a narrow screen (4-5 columns), this wastes horizontal space.
**Clutter:** Move "Next Action" hint to tooltip or below column name on hover.

### Notification Pop Has Multiple Content Types (Lines 820+)
Notification center shows: approved proposals, paid invoices, inbound messages, all in one scrollable list.
**Clutter:** All categories visible at once. Consider: tabs or filter chips to hide less-relevant items.

### Panel Details Toggle Shows Too Much Preview (Lines 2544-2549)
When collapsed, details show notes preview (first 50 chars). But if notes are long, text overflows.
**Clutter:** Truncate to one line max, add ellipsis.

### Quick Actions (QA) Buttons All Visible at Once (Lines 1694-1710)
Five buttons (quote, schedule, materials, status, note) visible even if not all needed for current contact state.
**Clutter:** Show only contextually relevant actions (e.g., hide "Schedule" if already scheduled).

### Tab Badges Compete for Attention (Lines 1249-1250)
Gold badges on Invoices and red badges on Messages — both bright colors.
**Clutter:** Badges are visually equal; user can't prioritize which tab to check first. Consider: use same color for both, let count speak.

---

## 5. MOBILE ISSUES

### Kanban Columns Overflow Horizontally on Mobile (Line 7083+)
Kanban renders 9 columns side-by-side. On iPhone, only 1-2 visible without horizontal scroll.
**Issue:** Users must scroll left/right, breaking vertical scroll habit. Consider: collapse to fewer columns on mobile, or switch to vertical list view.

### Modal Max-Width Too Large (Line 385)
```css
.modal { max-width: 480px; }
```
On iPhone SE (375px width), modal is `480px - padding` = overflows. With `padding: 20px`, modal is `375 - 40 = 335px` actual. Tight but OK.

**Actually fine:** `padding:20px` + `max-width:480px` respects viewport. Issue is if content inside assumes more width.

### Proposal Form Buttons Stack Awkwardly (Lines 1461-1462)
Two amp buttons with `flex:1` will wrap on narrow screens.
**Mobile issue:** At 375px width with 12px padding, 2 buttons might force single-line layout. Test on iPhone.

### Calendar Grid Too Dense (Lines 347-351)
`grid-template-columns: repeat(5, 1fr)` creates 5-day columns. On 375px phone, each day is ~65px wide.
**Issue:** Day cell height is `min-height:120px`, but content (day number + events) doesn't scale. Text might overflow.
**Line 487:** Responsive rule only at `max-width:700px`. Add rule for `max-width:480px` to reduce height further.

### Payment Method Selection Not Touch-Friendly (Line 2989-3004)
Buttons are small and might have <44px height. WCAG recommends 44x44px minimum.
**Issue:** Check actual tap target size; if <44px, increase padding.

### Address Dropdown Hard to Select on Mobile (Line 412)
Dropdown has `max-height:220px` fixed. On phone with 667px height, dropdown takes 1/3 of screen.
**Issue:** Can't see contact info while selecting address. Consider: modal address picker instead of dropdown.

### Messages Panel Text Input (Line 1723)
Textarea has `min-height:48px; max-height:120px`. On phone, might push send button off-screen.
**Issue:** Safe-area-inset padding (line 233) only applied to `.msg-compose-foot`. If textarea expands, send button stays visible but might need scroll. Test on iPhone with keyboard visible.

### Tab Bar Overflow (Line 554)
Tab bar has `overflow-x:auto` but no visual scroll indicator. Might not be obvious tabs are scrollable.
**Issue:** On mobile with many tabs (if custom tabs added), not obvious they scroll.

### Panel Max-Width (Line 300)
```css
.side-panel { max-width: 480px; }
```
On iPhone (375px), this is fine. But leaves ~45px margin on each side when panel fully open. Might feel like wasted space.
**Fix:** Use `max-width: 100%` on mobile, keep 480px max on desktop.

---

## 6. PSYCHOLOGICAL HIERARCHY GAPS

### "Create & Get Link" vs "Copy Link" Buttons Unclear (Lines 1532, 1537)
Primary CTA is "Create & Get Link" (navy background, prominent). But "Copy Link" (lighter) appears first in HTML.
**Hierarchy issue:** User attention drawn to first button, but primary action is second. Reorder in HTML to "Copy Link" first (secondary), then "Create & Get Link" (primary).

### Quote Builder Total Not Emphasized Enough (Line 1346)
`.qb-big` shows $1,197 in medium gold text. But it's clickable (copy to clipboard) without affordance.
**Hierarchy:** Price should be most prominent element; consider larger font, more prominent placement.

### Invoice "Mark all read" Button Obscured (Line 1207)
In notification center, "Mark all read" is small and at top-right. Users might miss it.
**Hierarchy:** Should be more prominent if it's a key action.

### Archived Contacts Visually De-emphasized (Line 2260)
Archived rows have `opacity:.5`. But they're still clickable and take up space.
**Hierarchy:** Should be hidden by default or in separate section. Currently, archived contacts clutter active view.

### Delete Contact Buried in Details Toggle (Lines 1661, 3531)
To delete a contact, must: open panel → click "details" → scroll down → click "Archive".
**Hierarchy:** Delete is tertiary action, but requires 3 clicks. Consider: one-click in panel menu.

### "Got It" Button in Approval Notification (Line 1810)
Button is gray/secondary style, might be missed. This is a celebration moment — should be prominent.
**Hierarchy:** Consider: gold button, larger, center-aligned.

### Quick Actions (QA) Buttons All Equal Priority (Lines 1694-1710)
Five buttons look identical. But "Schedule" and "Status" might be more important than "Note".
**Hierarchy:** Use color/emphasis to guide. E.g., "Schedule" in navy, others in outline.

### Kanban Column Totals Hidden Until Hover (Line 7133)
Column totals only appear if `totalVal > 0`. On empty columns, no total shown.
**Hierarchy:** Totals are important for pipeline value assessment. Always show (even as $0).

---

## 7. TOP 10 SURGICAL FIXES (Ranked by Impact-to-Effort)

### FIX #1: Remove Console.log from fireMetaEvent (Line 2104) ⭐⭐⭐⭐⭐
**Impact:** Removes debug leak; production-ready.
**Effort:** 1 line.
**Change:**
```javascript
// Line 2104 — BEFORE:
if (!META_CAPI_TOKEN) { console.log('[Meta CAPI] Skipped — no token (needs backend proxy)'); return; }

// AFTER:
if (!META_CAPI_TOKEN) return;
```
**Why:** Clean, silent failure. No debug noise in production.

---

### FIX #2: Fix onclick Injection in Invoice Button (Line 3033) ⭐⭐⭐⭐
**Impact:** Eliminates XSS risk if contactId ever contains quotes.
**Effort:** 4 lines.
**Change:**
```javascript
// Line 3033 — BEFORE:
el.innerHTML = '<button class="btn btn-outline" style="width:100%;margin-bottom:8px;min-height:44px" onclick="copyInvoiceLink(\'' + contactId + '\')">Copy Invoice Link</button>';

// AFTER:
const btn = document.createElement('button');
btn.className = 'btn btn-outline';
btn.style.cssText = 'width:100%;margin-bottom:8px;min-height:44px';
btn.textContent = 'Copy Invoice Link';
btn.addEventListener('click', () => copyInvoiceLink(contactId));
el.innerHTML = '';
el.appendChild(btn);
```
**Why:** No string injection; safe regardless of contactId content.

---

### FIX #3: Batch setAttribute Calls for Inspection Back Button (Lines 2465-2468) ⭐⭐⭐⭐
**Impact:** Cleaner code; prevents second setAttribute overwriting first.
**Effort:** 3 lines.
**Change:**
```javascript
// Lines 2465-2468 — BEFORE:
if (prevLevel === 'payment') {
  inspBackBtn.textContent = '← Payment';
  inspBackBtn.setAttribute('onclick', "drillTo('payment')");
} else {
  inspBackBtn.textContent = '← Proposal';
  inspBackBtn.setAttribute('onclick', "drillTo('proposal')");
}

// AFTER:
const targetLevel = prevLevel === 'payment' ? 'payment' : 'proposal';
const targetLabel = prevLevel === 'payment' ? '← Payment' : '← Proposal';
inspBackBtn.textContent = targetLabel;
inspBackBtn.onclick = () => drillTo(targetLevel);
```
**Why:** Uses `.onclick` property instead of `.setAttribute()`; avoids redundant attribute set.

---

### FIX #4: Hide Console.warn in Production (Line 4947) ⭐⭐⭐
**Impact:** Cleaner browser console.
**Effort:** 1 line.
**Change:**
```javascript
// Line 4947 — BEFORE:
if (error) { console.warn('Jurisdictions load failed:', error.message); return; }

// AFTER:
if (error) { /* Jurisdictions load failed silently */ return; }
```
**Why:** Non-blocking error; silent is fine.

---

### FIX #5: Combine Payment Confirmation Flows (Lines 3083-3155) ⭐⭐⭐⭐⭐
**Impact:** Reduces duplication; single source of truth for payment recording.
**Effort:** 10 lines refactored.
**Change:**
```javascript
// Lines 3083-3155 — BEFORE: Two separate functions (confirmPayment, collectPayment)

// AFTER: Merge into one
async function recordPayment(contactId, amount, method = 'Manual') {
  if (!method) { showToast('Select a payment method', 'error'); return; }
  if (amount <= 0) { showToast('Enter an amount', 'error'); return; }
  
  const { error } = await db.from('payments').insert([{ 
    contact_id: contactId, amount, method, status: 'completed' 
  }]);
  if (error) { showToast('Payment failed: ' + error.message, 'error'); return; }
  
  await db.from('contacts').update({ quote_amount: amount }).eq('id', contactId);
  const c = allContacts.find(x => x.id === contactId);
  if (c) {
    c.quote_amount = amount;
    const np = (c.name || '').split(' ');
    fireMetaEvent('Purchase', { 
      email: c.email, phone: c.phone, 
      fn: np[0]||'', ln: np.slice(1).join(' ')||'' 
    }, { currency: 'USD', value: amount });
  }
  
  if (method !== 'Manual') {
    await db.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method })
      .eq('contact_id', contactId).eq('status', 'unpaid');
    await autoProgressStage(contactId, 9);
  }
  
  showToast(method + ' payment of $' + amount.toLocaleString() + ' recorded', 'success');
  renderPaymentDrill();
}

// Then call confirmPayment() and collectPayment() as thin wrappers
async function confirmPayment() {
  const method = _selectedPayMethod;
  const contactId = currentPanelContactId;
  const amount = parseFloat(document.getElementById('pay-amount-input')?.value) || 0;
  _selectedPayMethod = null;
  await recordPayment(contactId, amount, method);
}

async function collectPayment(contactId, amount) {
  await recordPayment(contactId, amount, 'Manual');
}
```
**Why:** Eliminates duplicate Meta event firing, invoice update, and UI refresh logic.

---

### FIX #6: Store Payment Method Selection in SessionStorage (Line 3084) ⭐⭐⭐
**Impact:** Remembers user's method choice across panel re-opens.
**Effort:** 2 lines per save.
**Change:**
```javascript
// Line 3004 — selectPayMethod:
function selectPayMethod(method) {
  _selectedPayMethod = method;
  sessionStorage.setItem('lastPaymentMethod', method); // ADD
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-method="${method}"]`)?.classList.add('active');
}

// Line 3084 — confirmPayment:
async function confirmPayment() {
  const method = _selectedPayMethod || sessionStorage.getItem('lastPaymentMethod'); // ADD
  if (!method) { showToast('Select a payment method', 'error'); return; }
  // ...
}
```
**Why:** Reduces friction; pre-selects user's previous choice.

---

### FIX #7: Add responsive rule for calendar on mobile (Line 487) ⭐⭐⭐
**Impact:** Calendar readable on small phones.
**Effort:** 5 CSS lines.
**Change:**
```css
/* Line 487 area — BEFORE: Only rule for max-width:700px */

/* AFTER: Add rule for mobile */
@media(max-width:480px){
  .cal-day{min-height:160px}
  .cal-event{font-size:10px;padding:2px 5px}
  .cal-day-head{padding:2px 3px 1px;font-size:11px}
  .cal-day-num{font-size:12px}
}
```
**Why:** Makes calendar text and day cells readable on iPhone SE.

---

### FIX #8: Reorder Modal Buttons for Correct CTA Priority (Lines 1532, 1537) ⭐⭐⭐⭐
**Impact:** Guides user to primary action.
**Effort:** Reorder HTML, update logic.
**Change:**
```html
<!-- Lines 1532-1537 — BEFORE: Copy Link first, Create second -->
<button class="btn btn-primary" style="width:100%" onclick="copyProposalLink()">Copy Link</button>
<!-- ... -->
<button class="btn btn-primary" id="p-create-btn" onclick="saveProposal()">Create & Get Link</button>

<!-- AFTER: Create first (primary), Copy second (secondary) -->
<button class="btn btn-primary" id="p-create-btn" onclick="saveProposal()">Create & Get Link</button>
<button class="btn btn-outline" style="width:100%" onclick="copyProposalLink()">Copy Link</button>
```
**Why:** Primary action is visually prominent first; user sees it before secondary.

---

### FIX #9: Unhide Kanban Column Totals Even When $0 (Line 7133) ⭐⭐⭐
**Impact:** Pipeline visibility; easier to see empty vs. active columns.
**Effort:** 1 line.
**Change:**
```javascript
// Line 7133 — BEFORE:
${totalVal > 0 ? `<div class="kanban-col-total"><b>$${totalVal.toLocaleString()}</b></div>` : ''}

// AFTER:
<div class="kanban-col-total" ${totalVal === 0 ? 'style="opacity:.5"' : ''}><b>$${totalVal.toLocaleString()}</b></div>
```
**Why:** Always show total; de-emphasize with opacity if zero. User sees at-a-glance pipeline value.

---

### FIX #10: Contextually Show/Hide Quick Actions (Lines 1694-1710) ⭐⭐⭐⭐⭐
**Impact:** Reduces visual clutter; guides user to most relevant actions.
**Effort:** 15 lines logic + CSS.
**Change:**
```javascript
// Add logic before rendering QA buttons:
function shouldShowQA(actionType, contactId) {
  const c = allContacts.find(x => x.id === contactId);
  if (!c) return false;
  
  switch(actionType) {
    case 'quote': return !proposalMap[contactId]?.length; // Show if no proposal yet
    case 'schedule': return c.stage >= 3 && c.stage <= 7; // Show only mid-pipeline
    case 'materials': return c.stage >= 3; // Show after initial contact
    case 'status': return true; // Always show
    case 'note': return true; // Always show
    default: return true;
  }
}

// Then in rendering (around line 1694):
const qaActions = [
  { name: 'quote', title: 'Build a quick quote' },
  { name: 'schedule', title: 'Schedule install' },
  { name: 'materials', title: 'Set inlet, panel' },
  { name: 'status', title: 'Change stage' },
  { name: 'note', title: 'Add a note' },
];

let qaHtml = '';
qaActions.forEach(qa => {
  if (shouldShowQA(qa.name, currentPanelContactId)) {
    qaHtml += `<button class="qa-btn" data-qa="${qa.name}" onclick="qaToggle('${qa.name}')" title="${qa.title}">…</button>`;
  }
});
// Render qaHtml in the QA section
```
**Why:** Users only see relevant actions; reduces cognitive load.

---

## SUMMARY

**Total Bugs:** 6 (1 critical console.log, 2 onclick injection risks, 1 setAttribute redundancy, 2 console.warn)

**Total Redundant Paths:** 2 (payment recording flows, modal open patterns)

**Total Friction Points:** 7 (undo UX, hidden search CTA, proposal modals, calendar event, etc.)

**Total Visual Clutter:** 7 (button soup, too many badges, etc.)

**Total Mobile Issues:** 8 (kanban horizontal scroll, calendar density, tap targets, etc.)

**Total Hierarchy Gaps:** 8 (button order, deleted buried, etc.)

**Actionable Fixes:** 10 surgical changes, all <50 lines, focusing on the highest impact-to-effort ratio.

**Top Priority:** Fix #1 (console.log) and Fix #5 (merge payment flows) will have the biggest impact on code quality and maintainability.

