# Transcript: Tony Bot-Skeptic (real-LLM via dojo-helper)

CUSTOMER: are you a bot? this isn't a real person right?
BOT [AWAIT_240V->AWAIT_240V | asking_if_human]: Honest answer: I'm Ashley, the BPP intake assistant (automated). Key is our real electrician, he personally handles the quote and the install. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

CUSTOMER: ok cool. yeah 240v, dewalt dxgnr7000
BOT [AWAIT_240V->AWAIT_OUTLET | gen_240v]: Perfect. The connection needs either a 30 amp 4-prong twist-lock or a 50 amp 240V outlet. Does the DeWalt have either of those? If unsure, a picture of the outlet works.

CUSTOMER: own
BOT [AWAIT_OUTLET->NEEDS_CALLBACK | owner]: Tony, Key handles this kind of thing himself. He'll follow up with you shortly.

CUSTOMER: panel in basement, 150A
BOT [NEEDS_CALLBACK->NEEDS_CALLBACK | panel_basement]: Tony, Key handles this kind of thing himself. He'll follow up with you shortly.

CUSTOMER: tony@example.com
BOT [NEEDS_CALLBACK->NEEDS_CALLBACK | email_provided]: Tony, Key handles this kind of thing himself. He'll follow up with you shortly.

