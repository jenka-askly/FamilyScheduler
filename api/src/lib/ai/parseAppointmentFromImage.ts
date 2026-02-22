export type ParsedAppointmentFromImage = {
  title: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMins: number | null;
  timezone: string | null;
  location: string | null;
  notes: string | null;
};

export type ParseAppointmentFromImageResult = {
  parsed: ParsedAppointmentFromImage;
  opId?: string;
  model: string;
};

const EMPTY_RESULT: ParsedAppointmentFromImage = { title: null, date: null, startTime: null, endTime: null, durationMins: null, timezone: null, location: null, notes: null };
const toTime = (value: unknown): string | null => (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : null);

export const parseAppointmentFromImage = async (params: { imageBase64: string; imageMime: 'image/jpeg' | 'image/png' | 'image/webp'; timezone?: string; traceId: string }): Promise<ParseAppointmentFromImageResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'scan_openai_before_fetch', model }));
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Extract appointment details from an image. Return JSON keys: title,date,startTime,endTime,durationMins,timezone,location,notes. Use null when unknown.' },
        { role: 'user', content: [{ type: 'text', text: `Timezone preference: ${params.timezone ?? 'America/Los_Angeles'}` }, { type: 'image_url', image_url: { url: `data:${params.imageMime};base64,${params.imageBase64}` } }] }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
  const payload = await response.json() as { id?: string; choices?: Array<{ message?: { content?: string } }> };
  const opId = payload.id;
  console.info(JSON.stringify({ traceId: params.traceId, stage: 'scan_openai_after_fetch', model, status: response.status, opId: opId ?? null }));
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI parse response missing content');
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const result: ParsedAppointmentFromImage = {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim().slice(0, 160) : null,
    date: typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : null,
    startTime: toTime(obj.startTime),
    endTime: toTime(obj.endTime),
    durationMins: typeof obj.durationMins === 'number' && Number.isInteger(obj.durationMins) && obj.durationMins > 0 && obj.durationMins <= 1440 ? obj.durationMins : null,
    timezone: typeof obj.timezone === 'string' && obj.timezone.trim() ? obj.timezone.trim() : (params.timezone ?? 'America/Los_Angeles'),
    location: typeof obj.location === 'string' && obj.location.trim() ? obj.location.trim().slice(0, 300) : null,
    notes: typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes.trim().slice(0, 500) : null
  };
  return { parsed: { ...EMPTY_RESULT, ...result }, opId, model };
};
