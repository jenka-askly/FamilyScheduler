import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ParsedModelResponseSchema, type ParsedModelResponse } from '../actions/schema.js';
import { buildParserSystemPrompt, buildParserUserPrompt } from './prompts.js';
import { type OpenAiContextEnvelope } from './buildContext.js';
import { appendLine, ensureDirExists } from '../logging/ndjsonLogger.js';
import { redactSecrets } from '../logging/redact.js';

export type ParserContext = OpenAiContextEnvelope;
type ParseOptions = { traceId: string; sessionIdHash: string };

const truncate = (value: string, maxChars: number): string => value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;

const apiRootLogDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.local/logs');

const isOpenAiLogEnabled = (): boolean => (process.env.OPENAI_LOG_ENABLED ?? 'false').toLowerCase() === 'true';

const getOpenAiLogPath = (): string => {
  const configuredDir = process.env.OPENAI_LOG_DIR ? path.resolve(process.env.OPENAI_LOG_DIR) : apiRootLogDir;
  return path.join(configuredDir, 'openai.ndjson');
};

export const parseToActions = async (input: string, context: ParserContext, options: ParseOptions): Promise<ParsedModelResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const maxContextChars = Number(process.env.OPENAI_MAX_CONTEXT_CHARS ?? '40000');
  const contextText = truncate(JSON.stringify(context, null, 2), Number.isFinite(maxContextChars) ? maxContextChars : 40000);
  const messages = [
    { role: 'system', content: buildParserSystemPrompt() },
    { role: 'user', content: buildParserUserPrompt(input, contextText) }
  ];
  const loggingEnabled = isOpenAiLogEnabled();
  const startedAt = Date.now();

  if (loggingEnabled) {
    const logFilePath = getOpenAiLogPath();
    await ensureDirExists(path.dirname(logFilePath));
    await appendLine(logFilePath, redactSecrets({
      type: 'openai_request',
      traceId: options.traceId,
      sessionIdHash: options.sessionIdHash,
      model,
      messages,
      contextEnvelope: context,
      ts: new Date().toISOString()
    }));
  }

  console.info(JSON.stringify({ traceId: options.traceId }), 'openai request start');
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
      messages
    })
  });

  console.info(JSON.stringify({ traceId: options.traceId, status: response.status, latencyMs: Date.now() - startedAt }), 'openai request end');

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
  console.info(JSON.stringify({ traceId: options.traceId, stage: 'openai_raw_response', rawModelResponse: rawContent }));
  let parsed: ParsedModelResponse | undefined;
  let validationErrors: string[] | undefined;
  try {
    parsed = ParsedModelResponseSchema.parse(parsedJson);
  } catch (error) {
    validationErrors = [error instanceof Error ? error.message : 'unknown validation error'];
    console.warn(JSON.stringify({ traceId: options.traceId, stage: 'openai_schema_validation', validationErrors }));
    throw error;
  } finally {
    if (loggingEnabled) {
      const logFilePath = getOpenAiLogPath();
      await appendLine(logFilePath, redactSecrets({
        type: 'openai_response',
        traceId: options.traceId,
        sessionIdHash: options.sessionIdHash,
        rawText: rawContent,
        parsed: parsedJson,
        validationErrors,
        latencyMs: Date.now() - startedAt,
        ts: new Date().toISOString()
      }));
    }
  }

  if (!parsed) throw new Error('OpenAI parse response validation failed');
  return parsed;
};
