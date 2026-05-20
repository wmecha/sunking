import { isSyncEnabled as isComposioSyncEnabled } from './composio';
import { isGoogleSheetsSyncConfigured } from './google-sheets';

export type SheetSyncProvider = 'disabled' | 'composio' | 'google_service_account';

export function getSheetSyncProvider(): SheetSyncProvider {
  const configured = process.env.SHEET_SYNC_PROVIDER?.trim().toLowerCase();
  if (configured === 'disabled' || configured === 'off') return 'disabled';
  if (configured === 'google' || configured === 'google_service_account') return 'google_service_account';
  if (configured === 'composio') return 'composio';

  if (isGoogleSheetsSyncConfigured()) return 'google_service_account';
  if (isComposioSyncEnabled()) return 'composio';
  return 'disabled';
}

export function isSheetSyncEnabled(): boolean {
  const provider = getSheetSyncProvider();
  if (provider === 'google_service_account') return isGoogleSheetsSyncConfigured();
  if (provider === 'composio') return isComposioSyncEnabled();
  return false;
}

export function getSheetSyncDisabledReason(): string {
  return (
    'Sheet sync disabled. Set SHEET_SYNC_PROVIDER=google_service_account with GOOGLE_SERVICE_ACCOUNT_JSON ' +
    'or GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, or set SHEET_SYNC_PROVIDER=composio with Composio credentials.'
  );
}
