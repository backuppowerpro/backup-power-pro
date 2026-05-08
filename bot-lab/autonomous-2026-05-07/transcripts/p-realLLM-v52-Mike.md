# Persona transcript — Mike (+18005550402)

_Generated 2026-05-08T02:36:39Z_

## Init
{"ok":true,"id":"48dbe694-28c6-4922-a28f-4abb4ea5cfc8","bot_state":"AWAIT_240V","err":null}

## Turn 1 — inbound
> hey looking to get an inlet installed, got a honda 5500

```json
{
  "prev": "AWAIT_240V",
  "next": "AWAIT_240V",
  "label": "asking_clarifying_technical",
  "sent": true,
  "intent": "customer asked an OFF-TOPIC technical question at AWAIT_240V; defer to Key (he can walk through it on the call) and continue with the current state's ask. Zero em-dashes."
}
```

**Bot:** Good question, that's a Key call, he can walk through it on the call. Just confirming, does your Honda have a 240V outlet on it? Either 4-prong twist-lock or 50-amp 4-prong. If unsure, a quick pic of the outlets works.

## Turn 2 — inbound
> yeah it's just a regular plug, the household type

```json
{
  "prev": "AWAIT_240V",
  "next": "DISQUALIFIED_120V",
  "label": "gen_120v",
  "sent": true,
  "intent": "KEY-VOICE: hedged soft DQ. Frame as \"looks like / from what I can see\" rather than absolute. Offer future-install. Verbatim Key pattern + v10.1.3 hedge: \"Got it, {gen_brand_model}. Looks like that one outputs 120 volts only and would not work with our setup. If you upgrade to a 240V generator down the road, we would be happy to help with the install then.\" DO NOT proactively offer generator recommendations, wait for customer to ask."
}
```

**Bot:** Mike, sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.

## Turn 3 — inbound
> 120 only I think

```json
{
  "prev": null,
  "next": null,
  "label": null,
  "sent": null,
  "intent": null
}
```

**Bot:** Mike, sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.

## Final transcript

**[outbound]** Good question, that's a Key call, he can walk through it on the call. Just confirming, does your Honda have a 240V outlet on it? Either 4-prong twist-lock or 50-amp 4-prong. If unsure, a quick pic of the outlets works.

**[outbound]** Mike, sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.


## Final contact state
{
  "phone": "+18005550402",
  "messages": []
}
