import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  generateSuggestionCandidates,
  isTitleIntentMessage,
  shouldResolveAppointmentTimeFromDiscussionMessage,
  type SuggestionParsingHelpers
} from './appointmentSuggestions.ts';

const baseHelpers = (resolved: { date?: string; startTime?: string; displayTime?: string } | null): SuggestionParsingHelpers => ({
  resolveWhen: async () => resolved,
  createClientRequestId: () => 'req-1'
});

const context = { appointmentId: 'appt-1', appointmentCode: 'APPT-1' };

describe('generateSuggestionCandidates', () => {
  it('builds title suggestion for explicit title command', async () => {
    const result = await generateSuggestionCandidates({ messageText: 'change title to Title 99', appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers(null) });
    assert.equal(result[0]?.action.type, 'set_appointment_desc');
  });

  it('builds date suggestion when parser resolves date', async () => {
    const result = await generateSuggestionCandidates({ messageText: 'tomorrow', appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers({ date: '2026-01-03' }) });
    assert.equal(result[0]?.action.type, 'set_appointment_date');
  });

  it('builds time suggestion when parser resolves time', async () => {
    const result = await generateSuggestionCandidates({ messageText: 'at 3pm', appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers({ startTime: '15:00' }) });
    assert.equal(result[0]?.action.type, 'set_appointment_start_time');
  });

  it('builds location suggestion from explicit phrase', async () => {
    const result = await generateSuggestionCandidates({ messageText: 'at Home', appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers(null) });
    assert.equal(result[0]?.action.type, 'set_appointment_location');
  });

  it('builds constraint suggestion for can\'t cue', async () => {
    const result = await generateSuggestionCandidates({ messageText: "I can't do evenings", appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers(null) });
    assert.equal(result[0]?.action.type, 'add_constraint');
    if (result[0]?.action.type === 'add_constraint') {
      assert.equal(result[0].action.value, 'evenings');
    }
  });

  it('returns empty for random chat', async () => {
    const result = await generateSuggestionCandidates({ messageText: 'nice weather today', appointmentDetailContext: context, sessionUserEmail: 'me@example.com', parsingHelpers: baseHelpers(null) });
    assert.deepEqual(result, []);
  });

  it('does not resolve when for title intent messages', async () => {
    const calls: string[] = [];
    const result = await generateSuggestionCandidates({
      messageText: 'change title to Team Sync',
      appointmentDetailContext: context,
      sessionUserEmail: 'me@example.com',
      parsingHelpers: {
        resolveWhen: async (message) => {
          calls.push(message);
          return { date: '2026-01-03' };
        },
        createClientRequestId: () => 'req-1'
      }
    });
    assert.equal(calls.length, 0);
    assert.equal(result[0]?.action.type, 'set_appointment_desc');
  });
});

describe('discussion intent gates', () => {
  it('recognizes supported title intent variants', () => {
    assert.equal(isTitleIntentMessage('change title to xyz'), true);
    assert.equal(isTitleIntentMessage('update title to xyz'), true);
    assert.equal(isTitleIntentMessage('rename to xyz'), true);
    assert.equal(isTitleIntentMessage('call it xyz'), true);
  });

  it('allows time/date intent through resolve gate', () => {
    assert.equal(shouldResolveAppointmentTimeFromDiscussionMessage('tomorrow at 3pm'), true);
    assert.equal(shouldResolveAppointmentTimeFromDiscussionMessage('2026-01-03 15:00'), true);
  });

  it('blocks non-time/date chat from resolve gate', () => {
    assert.equal(shouldResolveAppointmentTimeFromDiscussionMessage('change title to xyz'), false);
    assert.equal(shouldResolveAppointmentTimeFromDiscussionMessage('let us discuss agenda'), false);
  });
});
