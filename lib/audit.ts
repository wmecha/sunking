import getDb from './db';

export async function logAction(
  action: string,
  details?: Record<string, unknown>,
  entityType?: string,
  entityId?: string
) {
  try {
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO audit_logs (action, entity_type, entity_id, details, performed_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [
        action,
        entityType ?? null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
      ],
    });
  } catch (err) {
    // Audit failures should never crash the main flow
    console.warn('[audit] Failed to log action:', err);
  }
}
