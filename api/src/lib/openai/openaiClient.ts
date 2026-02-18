import { ParsedModelResponseSchema, type ParsedModelResponse } from '../actions/schema.js';
import { buildParserSystemPrompt, buildParserUserPrompt } from './prompts.js';

export type ParserContext = {
  peopleNames: string[];
  appointmentsSummary: string[];
  availabilitySummary: string[];
  timezoneName: string;
};

const truncate = (value: string, maxChars: number): string => value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;

export const parseToActions = async (input: string, context: ParserContext): Promise<ParsedModelResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const maxContextChars = Number(process.env.OPENAI_MAX_CONTEXT_CHARS ?? '8000');
  const contextText = truncate(JSON.stringify(context, null, 2), Number.isFinite(maxContextChars) ? maxContextChars : 8000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildParserSystemPrompt() },
        { role: 'user', content: buildParserUserPrompt(input, contextText) }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI parse request failed with status ${response.status}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI parse response missing content');
  }

  const parsedJson = JSON.parse(rawContent) as unknown;
  return ParsedModelResponseSchema.parse(parsedJson);
};
