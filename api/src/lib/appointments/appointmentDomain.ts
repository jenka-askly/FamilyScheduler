import { randomUUID } from 'node:crypto';

export type ReconciliationStatus = 'reconciled' | 'unreconciled';

export type Constraint = {
  id: string;
  type: string;
  field: 'title' | 'time' | 'location' | 'general';
  operator?: 'equals' | 'contains' | 'not_contains' | 'required';
  value: string;
  active: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type Suggestion = {
  id: string;
  proposerEmail: string;
  field: 'title' | 'time' | 'location';
  value: string;
  active: boolean;
  status: 'active' | 'applied' | 'dismissed' | 'not_selected' | 'expired';
  conflicted: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  expiresAtUtc: string;
  reactions: Array<{ email: string; reaction: 'up' | 'down'; tsUtc: string }>;
};

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

export const ensureAppointmentDoc = (raw: Record<string, unknown>, actorEmail: string): Record<string, unknown> => {
  const now = new Date().toISOString();
  const reconciliation = asRecord(raw.reconciliation);
  const constraints = asRecord(raw.constraints);
  const suggestions = asRecord(raw.suggestions);
  const notification = asRecord(raw.notification);
  return {
    ...raw,
    reconciliation: {
      status: reconciliation.status === 'reconciled' ? 'reconciled' : 'unreconciled',
      reasons: Array.isArray(reconciliation.reasons) ? reconciliation.reasons : ['Time is required.'],
      updatedAtUtc: asString(reconciliation.updatedAtUtc) || now,
      updatedBy: asString(reconciliation.updatedBy) || actorEmail
    },
    constraints: {
      byMember: asRecord(constraints.byMember)
    },
    suggestions: {
      byField: asRecord(suggestions.byField)
    },
    notification: {
      latest: asRecord(notification.latest)
    }
  };
};

const getFieldValue = (doc: Record<string, unknown>, field: string): string => {
  if (field === 'title') return asString(doc.title).trim();
  if (field === 'location') return asString(doc.locationDisplay || doc.location || doc.locationRaw).trim();
  if (field === 'time') return asString(doc.startTime || asRecord(doc.time).resolved ? JSON.stringify(asRecord(doc.time).resolved) : '').trim();
  return '';
};

export const evaluateReconciliation = (docRaw: Record<string, unknown>, actorEmail: string): { status: ReconciliationStatus; reasons: string[]; doc: Record<string, unknown> } => {
  const doc = ensureAppointmentDoc(docRaw, actorEmail);
  const reasons: string[] = [];
  const startTime = asString(doc.startTime);
  const timeIntent = asRecord(asRecord(doc.time).intent);
  if (!startTime && asString(timeIntent.status) !== 'resolved') reasons.push('Time is required.');

  const byMember = asRecord(asRecord(doc.constraints).byMember);
  for (const [memberEmail, rawConstraints] of Object.entries(byMember)) {
    if (!Array.isArray(rawConstraints)) continue;
    for (const raw of rawConstraints) {
      const c = asRecord(raw);
      if (c.active === false) continue;
      const field = asString(c.field) || 'general';
      const value = asString(c.value);
      const operator = asString(c.operator) || 'contains';
      const fieldValue = getFieldValue(doc, field);
      if (!value) continue;
      if (operator === 'equals' && fieldValue && fieldValue !== value) reasons.push(`${memberEmail} requires ${field} to equal "${value}".`);
      if (operator === 'contains' && fieldValue && !fieldValue.toLowerCase().includes(value.toLowerCase())) reasons.push(`${memberEmail} prefers ${field} to include "${value}".`);
      if (operator === 'not_contains' && fieldValue && fieldValue.toLowerCase().includes(value.toLowerCase())) reasons.push(`${memberEmail} must not have ${field} including "${value}".`);
      if (operator === 'required' && !fieldValue) reasons.push(`${memberEmail} requires ${field}.`);
    }
  }

  const status: ReconciliationStatus = reasons.length === 0 ? 'reconciled' : 'unreconciled';
  return {
    status,
    reasons,
    doc: {
      ...doc,
      reconciliation: {
        status,
        reasons,
        updatedAtUtc: new Date().toISOString(),
        updatedBy: actorEmail
      }
    }
  };
};

export const activeConstraintsForMember = (docRaw: Record<string, unknown>, memberEmail: string): Constraint[] => {
  const doc = ensureAppointmentDoc(docRaw, memberEmail);
  const byMember = asRecord(asRecord(doc.constraints).byMember);
  const list = byMember[memberEmail];
  if (!Array.isArray(list)) return [];
  return list.map((entry) => asRecord(entry) as unknown as Constraint).filter((entry) => entry.active !== false);
};

export const upsertConstraintForMember = (
  docRaw: Record<string, unknown>,
  memberEmail: string,
  input: { constraintId?: string; field: Constraint['field']; operator: NonNullable<Constraint['operator']>; value: string; type?: string }
): { doc: Record<string, unknown>; added: Constraint; removed?: Constraint } => {
  const doc = ensureAppointmentDoc(docRaw, memberEmail);
  const byMember = asRecord(asRecord(doc.constraints).byMember);
  const current = Array.isArray(byMember[memberEmail]) ? [...(byMember[memberEmail] as Record<string, unknown>[])] : [];
  const now = new Date().toISOString();
  let removed: Constraint | undefined;
  if (input.constraintId) {
    const idx = current.findIndex((entry) => asString(asRecord(entry).id) === input.constraintId);
    if (idx >= 0) {
      removed = asRecord(current[idx]) as unknown as Constraint;
      current.splice(idx, 1);
    }
  }
  const added: Constraint = {
    id: input.constraintId || randomUUID(),
    type: input.type || 'structured',
    field: input.field,
    operator: input.operator,
    value: input.value,
    active: true,
    createdAtUtc: removed?.createdAtUtc || now,
    updatedAtUtc: now
  };
  current.push(added as unknown as Record<string, unknown>);
  byMember[memberEmail] = current;
  return { doc: { ...doc, constraints: { byMember } }, added, removed };
};

export const removeConstraintForMember = (docRaw: Record<string, unknown>, memberEmail: string, constraintId: string): { doc: Record<string, unknown>; removed: Constraint | null } => {
  const doc = ensureAppointmentDoc(docRaw, memberEmail);
  const byMember = asRecord(asRecord(doc.constraints).byMember);
  const current = Array.isArray(byMember[memberEmail]) ? [...(byMember[memberEmail] as Record<string, unknown>[])] : [];
  const idx = current.findIndex((entry) => asString(asRecord(entry).id) === constraintId);
  if (idx < 0) return { doc, removed: null };
  const removed = asRecord(current[idx]) as unknown as Constraint;
  current.splice(idx, 1);
  byMember[memberEmail] = current;
  return { doc: { ...doc, constraints: { byMember } }, removed };
};

export const materialEventTypes = new Set([
  'FIELD_CHANGED', 'CONSTRAINT_ADDED', 'CONSTRAINT_REMOVED', 'RECONCILIATION_CHANGED',
  'SUGGESTION_CREATED', 'SUGGESTION_DISMISSED', 'SUGGESTION_APPLIED', 'SUGGESTION_REACTED', 'SUGGESTION_REACTION',
  'PROPOSAL_PAUSED', 'PROPOSAL_RESUMED', 'PROPOSAL_EDITED', 'PROPOSAL_APPLIED',
  'NOTIFICATION_SENT'
]);

export const expireSuggestions = (docRaw: Record<string, unknown>): Record<string, unknown> => {
  const doc = ensureAppointmentDoc(docRaw, 'system@local');
  const byField = asRecord(asRecord(doc.suggestions).byField);
  const nowMs = Date.now();
  for (const [field, list] of Object.entries(byField)) {
    if (!Array.isArray(list)) continue;
    byField[field] = list.map((s) => {
      const entry = asRecord(s);
      const expiresAt = Date.parse(asString(entry.expiresAtUtc));
      if (entry.active !== false && Number.isFinite(expiresAt) && expiresAt < nowMs) {
        return { ...entry, active: false, status: 'expired', updatedAtUtc: new Date().toISOString() };
      }
      return entry;
    });
  }
  return { ...doc, suggestions: { byField } };
};

export const activeSuggestionsByField = (docRaw: Record<string, unknown>, field: Suggestion['field']): Suggestion[] => {
  const doc = expireSuggestions(docRaw);
  const byField = asRecord(asRecord(doc.suggestions).byField);
  const list = byField[field];
  if (!Array.isArray(list)) return [];
  return list.map((entry) => asRecord(entry) as unknown as Suggestion).filter((entry) => entry.active !== false && entry.status === 'active');
};

export const newSuggestion = (params: { proposerEmail: string; field: 'title' | 'time' | 'location'; value: string; conflicted?: boolean }): Suggestion => {
  const now = new Date();
  return {
    id: randomUUID(), proposerEmail: params.proposerEmail, field: params.field, value: params.value, conflicted: Boolean(params.conflicted),
    active: true, status: 'active', createdAtUtc: now.toISOString(), updatedAtUtc: now.toISOString(),
    expiresAtUtc: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), reactions: []
  };
};
