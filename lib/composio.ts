/**
 * Composio SDK singleton — used for server-side Google Sheets sync.
 *
 * Env vars (set on Vercel):
 *   COMPOSIO_API_KEY    — your Composio API key
 *   COMPOSIO_USER_ID    — the user_id that owns the Google Sheets connection
 *                         (typically your email address, e.g. admin@wallacemecha.com)
 *
 * Throws a clear error if not configured so the calling endpoint can return 503.
 */
import { Composio } from '@composio/core';

let _client: Composio | null = null;

export function getComposio(): Composio {
  if (_client) return _client;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY is not set — Google Sheet sync is disabled.');
  }
  _client = new Composio({ apiKey });
  return _client;
}

export function getComposioUserId(): string {
  const userId = process.env.COMPOSIO_USER_ID;
  if (!userId) {
    throw new Error(
      'COMPOSIO_USER_ID is not set — must be the user_id used in Composio for your Google Sheets connection.',
    );
  }
  return userId;
}

/** True if both env vars are present — used to hide the Sync UI when sync is disabled. */
export function isSyncEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY && process.env.COMPOSIO_USER_ID);
}
