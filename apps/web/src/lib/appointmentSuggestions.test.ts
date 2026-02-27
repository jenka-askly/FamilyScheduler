import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { generateSuggestionCandidates, type SuggestionParsingHelpers } from './appointmentSuggestions.ts';

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
});
