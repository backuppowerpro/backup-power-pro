# Summary 05-01: Modal Component + Add/Edit Person

## Status: COMPLETE

## Files Created
- `client/src/components/Modal.jsx` — reusable bottom-sheet/modal with Escape key + backdrop click close
- `client/src/components/AddPersonModal.jsx` — POST /api/people form (name, phone, email, stage select, notes)
- `client/src/components/EditPersonModal.jsx` — PATCH /api/people/:id form (name, phone, email, notes)

## Files Modified
- `client/src/components/PersonCard.jsx` — added Pencil button + EditPersonModal render for active cards
- `client/src/pages/Pipeline.jsx` — added FAB (fixed bottom-24 right-4) + AddPersonModal

## Commits
- feat(05-01): Modal.jsx — reusable bottom-sheet/modal
- feat(05-01): AddPersonModal — name/phone/email/stage/notes form
- feat(05-01): EditPersonModal — name/phone/email/notes edit form
- feat(05-01): PersonCard — add edit pencil button + EditPersonModal
- feat(05-01): Pipeline page — Add Person FAB + modal

## Notes
- Stage dropdown in AddPersonModal uses STAGES array — all 9 stages available
- EditPersonModal does not expose stage change (use ↕ move menu for that)
- Modal is mobile-first: bottom-sheet on mobile, centered dialog on sm+
