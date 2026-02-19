import { randomUUID } from 'node:crypto';
import { normalizeLocation } from './normalize.js';

export type ParsedLocation = {
  name: string;
  address: string;
  directions: string;
  display: string;
  mapQuery: string;
};

const maxLen = {
  name: 200,
  address: 300,
  directions: 300,
  display: 600,
  mapQuery: 300
};

const clamp = (value: unknown, limit: number): string => typeof value === 'string' ? value.trim().slice(0, limit) : '';

const fallbackLocation = (raw: string): ParsedLocation => {
  const normalized = normalizeLocation(raw);
  return { name: '', address: '', directions: '', display: normalized.display, mapQuery: normalized.mapQuery };
};

const modelForLocation = (): string => process.env.LOCATION_AI_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const shouldLogRawLocation = (): boolean => (process.env.LOCATION_AI_LOG_RAW ?? 'false').toLowerCase() === 'true';

const prompt = (raw: string): string => `Return strict JSON with exactly keys: name, address, directions, display, mapQuery.\nRules:\n- Extract the best street address portion if present.\n- Keep directions/instructions separate from address.\n- Do not invent missing address parts; if absent use empty string.\n- display should be multi-line: first line name + optional directions, second line address.\n- mapQuery should prioritize address if present; otherwise use name.\nInput:\n${raw}`;

export const aiParseLocation = async (raw: string): Promise<ParsedLocation> => {
  const traceId = randomUUID();
  const trimmedRaw = raw.trim();
  if (!trimmedRaw) return fallbackLocation(raw);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackLocation(raw);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelForLocation(),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You normalize appointment location text into structured JSON fields.' },
          { role: 'user', content: prompt(trimmedRaw) }
        ]
      })
    });

    if (!response.ok) throw new Error(`location_ai_http_${response.status}`);

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('location_ai_empty_content');

    if (shouldLogRawLocation()) {
      console.info(JSON.stringify({ traceId, stage: 'location_ai_raw_response', rawLocation: trimmedRaw, rawModelResponse: rawContent }));
    } else {
      console.info(JSON.stringify({ traceId, stage: 'location_ai_raw_response', rawLocationLength: trimmedRaw.length, rawModelResponseLength: rawContent.length }));
    }

    const parsed = JSON.parse(rawContent) as Record<string, unknown>;

    const name = clamp(parsed.name, maxLen.name);
    const address = clamp(parsed.address, maxLen.address);
    const directions = clamp(parsed.directions, maxLen.directions);
    const displayRaw = clamp(parsed.display, maxLen.display);
    const mapQueryRaw = clamp(parsed.mapQuery, maxLen.mapQuery);

    const firstLine = [name, directions].filter(Boolean).join(' — ').trim();
    const display = (displayRaw || [firstLine, address].filter(Boolean).join('\n')).trim().slice(0, maxLen.display);
    const mapQuery = (mapQueryRaw || address || name).trim().slice(0, maxLen.mapQuery);

    if (!display && !mapQuery && !name && !address && !directions) return fallbackLocation(raw);

    return { name, address, directions, display, mapQuery };
  } catch (error) {
    console.warn(JSON.stringify({ traceId, stage: 'location_ai_parse_failed', error: error instanceof Error ? error.message : 'unknown', rawLocationLength: trimmedRaw.length }));
    return fallbackLocation(raw);
  }
};
