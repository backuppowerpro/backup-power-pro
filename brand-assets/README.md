# BPP Brand Assets

Reusable brand artifacts that aren't email templates or full PDFs. Live at the seams of the customer journey.

## Asset index

| File | Purpose | Where it lives |
|------|---------|----------------|
| `email-signature.html` | HTML signature for Key (and future BPP staff) — pasteable into Gmail, Apple Mail, Resend defaults | Bottom of every personal email Key sends |

## Email signature setup

**Gmail:**
1. Open `email-signature.html` in Chrome
2. Select all (⌘A) on the rendered preview
3. Copy (⌘C)
4. Gmail → Settings → See all settings → Signature → paste
5. Set "Signature defaults" to insert on new mail + reply/forward
6. Save

**Apple Mail:**
1. Open the file in Safari, select-all + copy as before
2. Mail → Preferences → Signatures → drag the copied content into the signature pane
3. Important: uncheck "Always match my default message font" (otherwise it strips the BPP styling)

**Resend (transactional from the send-email edge function):**
- The signature is rendered as the bottom block of every transactional email automatically — no manual paste needed
- See `supabase/functions/send-email/index.ts` for the dispatch pattern

## TWEAK spots

Search the file for `TWEAK:` comments. Common per-staff edits:
- Avatar image URL (currently a Gravatar placeholder)
- Name + title
- Phone (defaults to BPP main line (864) 863-7800)
- Email address
