import 'server-only'

/**
 * What is left of the old cross-firm admin panel.
 *
 * `createUser`, `listAdminUsers`, `blockUser` and `unblockUser` lived here and
 * were deleted: the three-tier split (docs/superpowers/specs/2026-07-27-
 * tenancy-and-three-tier-admin-design.md) moved people management INTO the firm
 * — `lib/people.ts`, owner-gated, scoped to the caller's own workspace — and
 * left these with zero callers.
 *
 * They are gone rather than kept "just in case", for two reasons. CLAUDE.md is
 * explicit: *"The platform tier manages firms, not people — resist re-adding a
 * cross-firm create-user route, which is the thing the tier split exists to
 * remove."* A working `createUser({ workspaceId, role })` sitting in the tree is
 * that route, one import away. And it was the only one of the three
 * user-creation paths that was NOT transactional — `people.ts::createPerson` and
 * `platform/firms.ts::createFirm` both wrap the user + membership inserts in
 * `db.transaction`, while this one did two bare inserts, so a failure on the
 * second left a user with no membership: unable to sign in, with their email
 * address permanently taken.
 *
 * `listAdminUsers` also carried the unscoped `sessions` aggregate that
 * `lib/people.ts` had copied (see AUDIT.md B5) — deleting it removed one of the
 * two copies outright.
 *
 * The two survivors below are the ones with live callers.
 */

/** Pure guard, unit-tested: blocking yourself locks you out of the only
 *  surface that could unblock you. Used by lib/people.ts::setPersonBlocked. */
export function wouldBlockSelf(actorId: string, targetId: string): boolean {
  return actorId === targetId
}

/** Used by lib/people.ts::createPerson and lib/platform/firms.ts::createFirm. */
export function generateTempPassword(): string {
  // 18 URL-safe chars from crypto randomness. Shown once to whoever created the
  // account and handed over out of band; the holder must change it on first
  // sign-in (users.must_change_password).
  return Buffer.from(crypto.getRandomValues(new Uint8Array(14))).toString('base64url')
}
