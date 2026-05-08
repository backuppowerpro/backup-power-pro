# Persona transcript — Brian (+18005550403)

_Generated 2026-05-08T02:36:39Z_

## Init
{"ok":true,"id":"a827c551-e986-404a-9f8b-a4d7cef5972a","bot_state":"AWAIT_240V","err":null}

## Turn 1 — inbound
> 240v generac 7500

```json
{
  "prev": "AWAIT_240V",
  "next": "AWAIT_OUTLET",
  "label": "gen_240v",
  "sent": true,
  "intent": "KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify."
}
```

**Bot:** Perfect. Just to confirm, does it have a 30 amp or 50 amp 240V outlet on it? If you're unsure, send a pic of the outlets whenever you get a chance.

## Turn 2 — inbound
> yeah we own it

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "AWAIT_OUTLET",
  "label": "owner",
  "sent": true,
  "intent": "customer confirmed ownership mid-flow (\"yes we own it\" / \"we own\"). REQUIRED: open with explicit acknowledgment that names ownership (\"Got it, owner-side checked off.\" / \"Owner confirmed, thanks.\" / \"Got it, ownership noted.\"), THEN continue with: KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify.. Do NOT use a bare \"Got it.\" that ignores what they just said."
}
```

**Bot:** Got it, owner confirmed. The connection requires either a 30 amp 4-prong or 50 amp outlet, both 240V. Does your generator have either of those? If unsure, a picture of the outlet works.

## Turn 3 — inbound
> actually never mind, changed my mind on this

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "POSTPONED",
  "label": "customer_changed_mind",
  "sent": true,
  "intent": "KEY-VOICE: customer withdrew mid-flow (\"never mind\" / \"changed my mind\"). Accept gracefully, no push-back, no asking why, no apology stacking. Leave a clean re-entry door: \"no problem, just text us if you ever pick this back up.\" Premium posture."
}
```

**Bot:** Brian, no rush, text me back whenever you're ready and we'll pick up where we left off.

## Final transcript

**[outbound]** Perfect. Just to confirm, does it have a 30 amp or 50 amp 240V outlet on it? If you're unsure, send a pic of the outlets whenever you get a chance.

**[outbound]** Got it, owner confirmed. The connection requires either a 30 amp 4-prong or 50 amp outlet, both 240V. Does your generator have either of those? If unsure, a picture of the outlet works.

**[outbound]** Brian, no rush, text me back whenever you're ready and we'll pick up where we left off.


## Final contact state
{
  "phone": "+18005550403",
  "messages": []
}
