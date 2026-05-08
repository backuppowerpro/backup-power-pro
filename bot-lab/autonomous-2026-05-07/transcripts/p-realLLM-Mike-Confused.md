# Transcript: Mike Confused (real-LLM via dojo-helper)

CUSTOMER: I think it's like 5500 watts? small honda generator
BOT [AWAIT_240V->AWAIT_240V | asking_clarifying_technical]: Good question, that one's a Key call, he can walk through it on the call. Just confirming the generator has a 240V outlet on it, either the 4-prong twist-lock or the 50-amp. A pic of the generator's outlet works too if easier.

CUSTOMER: honestly not sure, has a regular looking outlet
BOT [AWAIT_240V->CLARIFY_240V | gen_unsure]: No problem, no rush. You can send a picture of the outlets whenever you get a chance. I know it's late, tomorrow works as well.

CUSTOMER: looks like a normal three prong like a dryer outlet
BOT [CLARIFY_240V->DISQUALIFIED_120V | outlet_30a_3prong]: Mike, sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.

CUSTOMER: oh ok so that won't work?
BOT [None->None | None]: Mike, sounds like the generator is a 120V model, which won't work for a whole-home connection. If you ever upgrade to a 240V unit we'd be happy to help.

