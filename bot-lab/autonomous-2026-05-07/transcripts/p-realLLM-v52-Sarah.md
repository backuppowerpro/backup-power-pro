# Persona transcript — Sarah (+18005550401)

_Generated 2026-05-08T02:36:39Z_

## Init
{"ok":true,"id":"2fdcb546-4ab4-4b96-9091-ba0022f55538","bot_state":"AWAIT_240V","err":null}

## Turn 1 — inbound
> 240v champion 8500 50amp

```json
{
  "prev": "AWAIT_240V",
  "next": "AWAIT_OUTLET",
  "label": "gen_240v",
  "sent": true,
  "intent": "KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify."
}
```

**Bot:** Champion 8500, solid unit. 50A 240V, perfect.

## Turn 2 — inbound
> yes we own it

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "AWAIT_OUTLET",
  "label": "owner",
  "sent": true,
  "intent": "customer confirmed ownership mid-flow (\"yes we own it\" / \"we own\"). REQUIRED: open with explicit acknowledgment that names ownership (\"Got it, owner-side checked off.\" / \"Owner confirmed, thanks.\" / \"Got it, ownership noted.\"), THEN continue with: KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify.. Do NOT use a bare \"Got it.\" that ignores what they just said."
}
```

**Bot:** Owner confirmed. The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.

## Turn 3 — inbound
> ok here's the panel info — main breaker is 200A, panel is in the garage

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "AWAIT_OUTLET",
  "label": "panel_garage_exterior",
  "sent": true,
  "intent": "customer volunteered panel-location info (\"garage exterior\") while we were at AWAIT_OUTLET. REQUIRED: open with explicit acknowledgment that names the panel location (\"Got the panel location, garage exterior, noted.\" / \"Panel garage exterior, got it.\") THEN continue with: KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify.. Do NOT use a bare ack that ignores what they just said."
}
```

**Bot:** Panel in the garage, 200A, got it. Does your generator have a 30 amp or 50 amp 240V outlet? If unsure, send a picture of the outlets whenever you get a chance.

## Turn 4 — inbound
> sarah@example.com

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "NEEDS_CALLBACK",
  "label": "email_provided",
  "sent": true,
  "intent": "KEY-VOICE: warmly acknowledge and tell them Key will reach out personally shortly. No specific time. No \"y'all\" / \"holler\". Use \"let me have Key follow up\" or similar polite-professional phrasing."
}
```

**Bot:** Sarah, Key handles this kind of thing himself. He'll follow up with you shortly.

## Turn 5 — inbound
> 123 Main St, Greenville SC 29601

```json
{
  "prev": null,
  "next": null,
  "label": null,
  "sent": null,
  "intent": null
}
```

**Bot:** Sarah, Key handles this kind of thing himself. He'll follow up with you shortly.

## Turn 6 — inbound
> great thanks

```json
{
  "prev": null,
  "next": null,
  "label": null,
  "sent": null,
  "intent": null
}
```

**Bot:** Sarah, Key handles this kind of thing himself. He'll follow up with you shortly.

## Final transcript

**[outbound]** Champion 8500, solid unit. 50A 240V, perfect.

**[outbound]** Owner confirmed. The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.

**[outbound]** Panel in the garage, 200A, got it. Does your generator have a 30 amp or 50 amp 240V outlet? If unsure, send a picture of the outlets whenever you get a chance.

**[outbound]** Sarah, Key handles this kind of thing himself. He'll follow up with you shortly.


## Final contact state
{
  "phone": "+18005550401",
  "messages": []
}
