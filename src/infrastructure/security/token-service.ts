import crypto from 'node:crypto';

/**
 * Cryptographic token service for invitations, email verification, password reset, and sessions.
 * Never stores raw tokens in the database; only SHA-256 hex digests are persisted.
 */

export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
