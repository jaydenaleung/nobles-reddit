import type { Transaction, WriteBatch } from 'firebase-admin/firestore';
import { FieldValue, db } from './admin';

export interface AuditInput {
  actorUid: string;
  actorEmail: string;
  action: string;
  contentKey?: string;
  target?: string;
  reason: string;
}

function entry(input: AuditInput) {
  return { ...input, createdAt: FieldValue.serverTimestamp() };
}

/**
 * The audit log is append-only: functions only ever create entries, and the
 * rules let no client write. Use `auditIn` to make the entry part of the
 * transaction or batch it records, so one cannot happen without the other.
 */
export function auditIn(writer: Transaction | WriteBatch, input: AuditInput): void {
  (writer as Transaction).create(db.collection('auditLog').doc(), entry(input));
}

export async function auditNow(input: AuditInput): Promise<void> {
  await db.collection('auditLog').doc().create(entry(input));
}
