// Client-safe constants + types for admin access actions. These MUST live outside access-actions.ts:
// that file is 'use server', and a server-action module may export ONLY async functions - a runtime
// `const` export there is a hard 500 on every action in the file (it broke the passcode gate).

// Teammate roles an operator can provision. Members (subscriber/free) self-sign-up, so they are not
// offered here. coach = full console; assistant_coach = drafts + approval gate; operator = /admin.
export const TEAMMATE_ROLES = ['coach', 'assistant_coach', 'operator'] as const;
export type TeammateRole = (typeof TEAMMATE_ROLES)[number];

export type AccessResult = { ok: boolean; error?: string };
export type InviteResult = { ok: boolean; error?: string; status?: 'created' | 'updated' };
export type ResendResult = { ok: boolean; error?: string };
