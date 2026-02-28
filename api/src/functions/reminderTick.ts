import { type InvocationContext, type Timer } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { createStorageAdapter } from '../lib/storage/storageFactory.js';
import { getRecentEvents, appendEvent } from '../lib/appointments/appointmentEvents.js';
import { listDueReminderIndexEntries, removeReminderIndexEntry } from '../lib/appointments/reminderIndex.js';
import { getUserPrefs } from '../lib/prefs/userPrefs.js';
import { normalizeEmail } from '../lib/auth/requireMembership.js';
import { sendEmail } from '../lib/email/acsEmail.js';

const minuteIso = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:00.000Z`;
};

const deriveReminderState = (events: Array<{ type: string; payload: Record<string, unknown>; tsUtc: string }>): Map<string, { dueAtIso: string; offsetMinutes: number; message?: string; status: 'scheduled' | 'canceled' | 'sent' | 'failed' }> => {
  const map = new Map<string, { dueAtIso: string; offsetMinutes: number; message?: string; status: 'scheduled' | 'canceled' | 'sent' | 'failed' }>();
  for (const event of [...events].reverse()) {
    const reminderId = typeof event.payload.reminderId === 'string' ? event.payload.reminderId : '';
    if (!reminderId) continue;
    if (event.type === 'REMINDER_SCHEDULED') {
      map.set(reminderId, {
        dueAtIso: typeof event.payload.dueAtIso === 'string' ? event.payload.dueAtIso : '',
        offsetMinutes: typeof event.payload.offsetMinutes === 'number' ? event.payload.offsetMinutes : 0,
        ...(typeof event.payload.message === 'string' && event.payload.message.trim() ? { message: event.payload.message.trim() } : {}),
        status: 'scheduled'
      });
    }
    if (event.type === 'REMINDER_CANCELED' && map.has(reminderId)) map.get(reminderId)!.status = 'canceled';
    if (event.type === 'REMINDER_SENT' && map.has(reminderId)) map.get(reminderId)!.status = event.payload.deliveryStatus === 'failed' ? 'failed' : 'sent';
  }
  return map;
};

const buildEmailContent = (title: string, dateText: string, timeText: string, location: string, message: string, link: string) => {
  const subject = `[Yapper] Reminder: ${title} (${dateText})`;
  const plainText = [
    'This is a reminder for:',
    `${title}`,
    '',
    `Time: ${dateText} ${timeText}`,
    `Location: ${location}`,
    ...(message ? ['', 'Message:', message] : []),
    '',
    'Do not reply to this email.',
    `Open in Yapper: ${link}`
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><h2 style="margin:0 0 12px">Appointment reminder</h2><p style="margin:0 0 8px"><strong>${title}</strong></p><p style="margin:0 0 8px"><strong>Time:</strong> ${dateText} ${timeText}</p><p style="margin:0 0 16px"><strong>Location:</strong> ${location}</p>${message ? `<p style="margin:0 0 8px"><strong>Message:</strong></p><blockquote style="margin:0 0 16px;padding:8px 12px;border-left:3px solid #ddd;color:#333">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote>` : ''}<p style="margin:0 0 16px"><a href="${link}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;font-weight:600">Open in Yapper</a></p><p style="margin:0;font-size:12px;color:#666">Do not reply to this email.</p></div>`;
  return { subject, plainText, html };
};

export async function reminderTick(_timer: Timer, context: InvocationContext): Promise<void> {
  const traceId = randomUUID();
  const now = new Date();
  const dueIsos = [minuteIso(new Date(now.getTime() - 60_000)), minuteIso(now)];
  const dueEntries = await listDueReminderIndexEntries(dueIsos);
  if (dueEntries.length === 0) return;

  const storage = createStorageAdapter();
  for (const entry of dueEntries) {
    try {
      const loaded = await storage.load(entry.groupId);
      const appointment = loaded.state.appointments.find((item) => item.id === entry.appointmentId);
      if (!appointment) {
        await removeReminderIndexEntry(entry);
        continue;
      }
      const recent = await getRecentEvents(entry.groupId, entry.appointmentId, 500);
      const reminderState = deriveReminderState(recent.events);
      const reminder = reminderState.get(entry.reminderId);
      if (!reminder || reminder.status !== 'scheduled') {
        await removeReminderIndexEntry(entry);
        continue;
      }

      const title = (appointment.title || 'Appointment').trim();
      const dateText = appointment.date || 'Date TBD';
      const timeText = appointment.startTime ? `${appointment.startTime}${appointment.durationMins ? ` · ${appointment.durationMins} min` : ''}` : (appointment.isAllDay ? 'All day' : 'Time TBD');
      const location = appointment.locationDisplay || appointment.location || 'No location provided';
      const linkBase = process.env.WEB_BASE_URL?.replace(/\/$/, '') || '';
      const appLink = linkBase ? `${linkBase}/#/g/${encodeURIComponent(entry.groupId)}?appointmentId=${encodeURIComponent(entry.appointmentId)}` : `/#/g/${encodeURIComponent(entry.groupId)}?appointmentId=${encodeURIComponent(entry.appointmentId)}`;
      const content = buildEmailContent(title, dateText, timeText, location, reminder.message ?? '', appLink);

      const recipients = loaded.state.people
        .filter((person) => person.status === 'active' && Boolean(person.email))
        .map((person) => ({ personId: person.personId, display: person.name?.trim() || undefined, email: normalizeEmail(person.email ?? '') }))
        .filter((person) => person.email);

      const eligible: typeof recipients = [];
      const excluded: Array<{ personId?: string; email?: string; reason: string }> = [];
      for (const recipient of recipients) {
        const prefs = await getUserPrefs(storage, recipient.email, traceId);
        if (prefs.emailUpdatesEnabled === false) {
          excluded.push({ personId: recipient.personId, email: recipient.email, reason: 'opted_out' });
          continue;
        }
        if (prefs.mutedGroupIds.includes(entry.groupId)) {
          excluded.push({ personId: recipient.personId, email: recipient.email, reason: 'muted_group' });
          continue;
        }
        eligible.push(recipient);
      }

      const failedRecipients: Array<{ email: string; display?: string; personId?: string; errorMessage?: string }> = [];
      let sentCount = 0;
      for (const recipient of eligible) {
        try {
          await sendEmail({ to: recipient.email, subject: content.subject, plainText: content.plainText, html: content.html });
          sentCount += 1;
        } catch (error) {
          failedRecipients.push({ email: recipient.email, display: recipient.display, personId: recipient.personId, errorMessage: error instanceof Error ? error.message : String(error) });
        }
      }

      const sentAt = new Date().toISOString();
      const deliveryStatus = sentCount === 0 ? 'failed' : (failedRecipients.length ? 'partial' : 'sent');
      await appendEvent(entry.groupId, entry.appointmentId, {
        id: randomUUID(),
        tsUtc: sentAt,
        type: 'REMINDER_SENT',
        actor: { kind: 'SYSTEM', email: 'system@yapper.local' },
        payload: {
          reminderId: entry.reminderId,
          sentAt,
          deliveryStatus,
          recipientCountSelected: eligible.length,
          recipientCountSent: sentCount,
          failedRecipients,
          excludedRecipients: excluded,
          subject: content.subject
        }
      }, { idempotencyKey: `reminder-send:${entry.reminderId}` });

      await removeReminderIndexEntry(entry);
    } catch (error) {
      context.log(JSON.stringify({ event: 'reminder_tick_item_failed', traceId, reminderId: entry.reminderId, groupId: entry.groupId, appointmentId: entry.appointmentId, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}
