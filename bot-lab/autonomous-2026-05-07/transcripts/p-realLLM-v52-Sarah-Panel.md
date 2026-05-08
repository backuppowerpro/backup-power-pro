# Persona transcript — Sarah-Panel (+18005550406)

_Generated 2026-05-08T02:36:39Z_

## Init
{"ok":true,"id":"8c9c9096-ae33-4866-819c-bb7cfd943fba","bot_state":"AWAIT_240V","err":null}

## Turn 1 — inbound
> 240v champion 50amp

```json
{
  "prev": "AWAIT_240V",
  "next": "AWAIT_OUTLET",
  "label": "gen_240v",
  "sent": true,
  "intent": "KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify."
}
```

**Bot:** Perfect. 50A 240V, that's the bigger setup, clean for most whole-home installs.

## Turn 2 — inbound
> panel is in the garage on the outside wall, 200A main

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "AWAIT_OUTLET",
  "label": "panel_garage_exterior",
  "sent": true,
  "intent": "customer volunteered panel-location info (\"garage exterior\") while we were at AWAIT_OUTLET. REQUIRED: open with explicit acknowledgment that names the panel location (\"Got the panel location, garage exterior, noted.\" / \"Panel garage exterior, got it.\") THEN continue with: KEY-VOICE: ask if the outlet is 30 amp 4-prong (L14-30, 240V, compatible) or 50 amp (14-50R, 240V, compatible), with photo offer paired in same message. Verbatim Key pattern: \"The connection requires either a 30 amp 240V outlet or a 50 amp outlet on your generator. Does your generator have either of those? If you are unsure you can send a picture of your generator outlets.\" If customer answers \"30 amp\" without confirming 4-prong, route to AWAIT_240V_RETRY for prong-count clarification, some 30A outlets are 120V-only (TT-30R RV-style) and would NOT qualify.. Do NOT use a bare ack that ignores what they just said."
}
```

**Bot:** Got it, garage exterior. 30 amp 4-prong or 50 amp outlet, either one works. Which does yours have, or send a quick pic of the outlet if easier.

## Turn 3 — inbound
> yes 50 amp 4-prong outlet

```json
{
  "prev": "AWAIT_OUTLET",
  "next": "AWAIT_PANEL_PHOTO",
  "label": "outlet_50a",
  "sent": true,
  "intent": "KEY-VOICE: ask for a photo of their main electrical panel and breakers with verified Key softener. IDENTITY-TRANSLATION RULE: Key verbatim was \"I will also need\", but Ashley is intake. Translate to \"Key will need\" or \"we will need\" (BPP-business voice). Bot output patterns: (1) \"To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.\" (2) \"Got it. To put your quote together we will also need a picture of your main electrical panel and breakers. I know it is late, no rush, tomorrow works as well.\" Use evening variant if time_of_day_bucket is \"evening\" or \"late\". Closing softener \"no rush, whenever you get the chance\" is non-negotiable Key voice, always include it. NEVER use first-person \"I will need\" / \"I install\", Ashley is not the electrician."
}
```

**Bot:** Perfect. I know it's late, no rush, tomorrow works as well. One thing, Key will need a picture of your main electrical panel and breakers, garage side. Whenever you get a chance.

## Turn 4 — inbound
> we own

```json
{
  "prev": "AWAIT_PANEL_PHOTO",
  "next": "AWAIT_PANEL_PHOTO",
  "label": "owner",
  "sent": true,
  "intent": "customer confirmed ownership mid-flow (\"yes we own it\" / \"we own\"). REQUIRED: open with explicit acknowledgment that names ownership (\"Got it, owner-side checked off.\" / \"Owner confirmed, thanks.\" / \"Got it, ownership noted.\"), THEN continue with: KEY-VOICE: ask for a photo of their main electrical panel and breakers with verified Key softener. IDENTITY-TRANSLATION RULE: Key verbatim was \"I will also need\", but Ashley is intake. Translate to \"Key will need\" or \"we will need\" (BPP-business voice). Bot output patterns: (1) \"To put together an accurate quote, Key will also need a picture of your main electrical panel and breakers. No rush, whenever you get the chance.\" (2) \"Got it. To put your quote together we will also need a picture of your main electrical panel and breakers. I know it is late, no rush, tomorrow works as well.\" Use evening variant if time_of_day_bucket is \"evening\" or \"late\". Closing softener \"no rush, whenever you get the chance\" is non-negotiable Key voice, always include it. NEVER use first-person \"I will need\" / \"I install\", Ashley is not the electrician.. Do NOT use a bare \"Got it.\" that ignores what they just said."
}
```

**Bot:** Got it, owner confirmed. Key will need a picture of your main electrical panel and breakers. I know it's late, no rush, tomorrow works as well.

## Turn 5 — inbound
> sarah.p@example.com

```json
{
  "prev": "AWAIT_PANEL_PHOTO",
  "next": "AWAIT_EMAIL",
  "label": "email_provided",
  "sent": true,
  "intent": "KEY-VOICE: ask for last name + email + install address combined in ONE close-info request. IDENTITY-TRANSLATION RULE: Key verbatim was \"I would be happy to send over the quote\" / \"I will put a quote together\", but Ashley is intake, not the electrician. Translate to: \"Key will put your quote together\" / \"Key will send the quote over\" / use \"we\" for BPP-the-business action. v10.1.7: lead with thanks (customer just answered the install-path question). Bot output patterns: \"Thank you. To complete the quote could I get your last name, email, and address?\" or \"Thanks for that. Key will put your quote together. To complete it could I get your last name, email, and address?\" Acceptable opens: \"Thank you.\" / \"Thanks for that.\" / \"Sounds good.\" / \"Got it.\" / \"Perfect.\", rotate. This is the close, handing off to Key who will send the quote PDF."
}
```

**Bot:** Thanks for that. To complete the quote could I get your last name and address?

## Final transcript

**[outbound]** Perfect. 50A 240V, that's the bigger setup, clean for most whole-home installs.

**[outbound]** Got it, garage exterior. 30 amp 4-prong or 50 amp outlet, either one works. Which does yours have, or send a quick pic of the outlet if easier.

**[outbound]** Perfect. I know it's late, no rush, tomorrow works as well. One thing, Key will need a picture of your main electrical panel and breakers, garage side. Whenever you get a chance.

**[outbound]** Got it, owner confirmed. Key will need a picture of your main electrical panel and breakers. I know it's late, no rush, tomorrow works as well.

**[outbound]** Thanks for that. To complete the quote could I get your last name and address?


## Final contact state
{
  "phone": "+18005550406",
  "messages": []
}
