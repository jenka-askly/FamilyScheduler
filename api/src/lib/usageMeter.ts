import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

export type UsageMeterRecord = {
  windowStartISO: string;
  requests: number;
  tokensIn?: number;
  tokensOut?: number;
  lastSuccessAtISO?: string;
  lastErrorAtISO?: string;
  lastErrorSummary?: string;
};

export type UsageState = 'unknown' | 'ok' | 'warning' | 'limit_reached';

export type UsageResponsePayload = {
  usageState: UsageState;
  usageSummary: string;
  updatedAt: string;
};

type MeterUsage = { input_tokens?: unknown; output_tokens?: unknown; prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };

export type UsageMeterStore = {
  trackingAvailable: boolean;
  load: () => Promise<UsageMeterRecord | null>;
  update: (updater: (current: UsageMeterRecord | null) => UsageMeterRecord) => Promise<UsageMeterRecord>;
};

const DEFAULT_USAGE_BLOB_NAME = 'familyscheduler/usage/meter.json';

let singleton: UsageMeterStore | null = null;
let testOverride: UsageMeterStore | null = null;

const isHttpStatus = (error: unknown, statuses: number[]): boolean => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : NaN;
  return Number.isFinite(statusCode) && statuses.includes(statusCode);
};

const streamToText = async (readable: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
};

const todayWindowStart = (now = new Date()): string => now.toISOString().slice(0, 10);

const ensureWindow = (record: UsageMeterRecord | null, nowIso: string): UsageMeterRecord => {
  const windowStartISO = todayWindowStart(new Date(nowIso));
  if (!record || record.windowStartISO !== windowStartISO) {
    return { windowStartISO, requests: 0, tokensIn: 0, tokensOut: 0 };
  }
  return {
    ...record,
    tokensIn: typeof record.tokensIn === 'number' ? record.tokensIn : 0,
    tokensOut: typeof record.tokensOut === 'number' ? record.tokensOut : 0
  };
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
};

export const extractTokenUsage = (usage: MeterUsage | undefined): { tokensIn?: number; tokensOut?: number } => {
  if (!usage) return {};
  const tokensIn = toNumber(usage.input_tokens) ?? toNumber(usage.prompt_tokens);
  const tokensOut = toNumber(usage.output_tokens) ?? toNumber(usage.completion_tokens);
  if (tokensIn !== undefined || tokensOut !== undefined) return { tokensIn, tokensOut };
  const total = toNumber(usage.total_tokens);
  return total === undefined ? {} : { tokensIn: total };
};

class AzureUsageMeterStore implements UsageMeterStore {
  readonly trackingAvailable = true;
  private readonly blobClient;

  constructor(accountUrl: string, containerName: string, blobName: string) {
    const credential = new DefaultAzureCredential();
    const serviceClient = new BlobServiceClient(accountUrl, credential);
    this.blobClient = serviceClient.getContainerClient(containerName).getBlockBlobClient(blobName);
  }

  async load(): Promise<UsageMeterRecord | null> {
    try {
      const response = await this.blobClient.download();
      if (!response.readableStreamBody) return null;
      const raw = await streamToText(response.readableStreamBody);
      return JSON.parse(raw) as UsageMeterRecord;
    } catch (error) {
      if (isHttpStatus(error, [404])) return null;
      throw error;
    }
  }

  async update(updater: (current: UsageMeterRecord | null) => UsageMeterRecord): Promise<UsageMeterRecord> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let etag: string | null = null;
      let current: UsageMeterRecord | null = null;
      try {
        const response = await this.blobClient.download();
        etag = response.etag ?? null;
        if (response.readableStreamBody) {
          const raw = await streamToText(response.readableStreamBody);
          current = JSON.parse(raw) as UsageMeterRecord;
        }
      } catch (error) {
        if (!isHttpStatus(error, [404])) throw error;
      }

      const next = updater(current);
      const body = `${JSON.stringify(next, null, 2)}\n`;
      try {
        await this.blobClient.upload(body, Buffer.byteLength(body), {
          blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
          conditions: etag ? { ifMatch: etag } : { ifNoneMatch: '*' }
        });
        return next;
      } catch (error) {
        if (isHttpStatus(error, [409, 412])) continue;
        throw error;
      }
    }
    throw new Error('usage meter update conflict');
  }
}

const createStore = (): UsageMeterStore => {
  if (testOverride) return testOverride;
  if (singleton) return singleton;
  const accountUrl = process.env.STORAGE_ACCOUNT_URL?.trim();
  const containerName = process.env.STATE_CONTAINER?.trim();
  if (!accountUrl || !containerName) {
    singleton = {
      trackingAvailable: false,
      async load() { return null; },
      async update(updater) { return updater(null); }
    };
    return singleton;
  }
  singleton = new AzureUsageMeterStore(accountUrl, containerName, process.env.USAGE_BLOB_NAME?.trim() || DEFAULT_USAGE_BLOB_NAME);
  return singleton;
};

export const setUsageMeterStoreForTests = (store: UsageMeterStore | null): void => {
  testOverride = store;
  singleton = null;
};

export const recordUsageSuccess = async (usage?: MeterUsage): Promise<void> => {
  const store = createStore();
  if (!store.trackingAvailable) return;
  const nowIso = new Date().toISOString();
  const { tokensIn, tokensOut } = extractTokenUsage(usage);
  await store.update((current) => {
    const baseline = ensureWindow(current, nowIso);
    return {
      ...baseline,
      requests: baseline.requests + 1,
      tokensIn: (baseline.tokensIn ?? 0) + (tokensIn ?? 0),
      tokensOut: (baseline.tokensOut ?? 0) + (tokensOut ?? 0),
      lastSuccessAtISO: nowIso
    };
  });
};

export const recordUsageError = async (summary: string): Promise<void> => {
  const store = createStore();
  if (!store.trackingAvailable) return;
  const nowIso = new Date().toISOString();
  await store.update((current) => {
    const baseline = ensureWindow(current, nowIso);
    return {
      ...baseline,
      lastErrorAtISO: nowIso,
      lastErrorSummary: summary.slice(0, 200)
    };
  });
};

const formatK = (value: number): string => value >= 1000 ? `${Math.round(value / 100) / 10}k` : `${value}`;

export const buildUsageResponse = (record: UsageMeterRecord | null, trackingAvailable: boolean, now = new Date()): UsageResponsePayload => {
  const nowIso = now.toISOString();
  if (!record && !trackingAvailable) {
    return { usageState: 'unknown', usageSummary: 'usage tracking unavailable', updatedAt: nowIso };
  }

  const dailyReqLimit = Math.max(1, Number(process.env.USAGE_DAILY_REQUEST_LIMIT ?? '200'));
  const dailyTokenLimit = Math.max(1, Number(process.env.USAGE_DAILY_TOKEN_LIMIT ?? '200000'));
  const baseline = ensureWindow(record, nowIso);
  const totalTokens = (baseline.tokensIn ?? 0) + (baseline.tokensOut ?? 0);
  const hasTokens = totalTokens > 0 || !!record?.tokensIn || !!record?.tokensOut;

  const reqRatio = baseline.requests / dailyReqLimit;
  const tokenRatio = hasTokens ? totalTokens / dailyTokenLimit : 0;
  const recentError = baseline.lastErrorAtISO ? (now.getTime() - Date.parse(baseline.lastErrorAtISO)) <= 30 * 60 * 1000 : false;
  const limitReached = reqRatio >= 1 || (hasTokens && tokenRatio >= 1);

  const usageState: UsageState = limitReached ? 'limit_reached' : (reqRatio >= 0.7 || tokenRatio >= 0.7 || recentError ? 'warning' : 'ok');
  const tokenSummary = hasTokens ? `, ${formatK(totalTokens)}/${formatK(dailyTokenLimit)} tokens` : '';
  const errorSummary = baseline.lastErrorSummary ? `, last error: ${baseline.lastErrorSummary}` : '';

  return {
    usageState,
    usageSummary: `${baseline.requests}/${dailyReqLimit} req${tokenSummary}${errorSummary}`,
    updatedAt: nowIso
  };
};

export const readUsageResponse = async (): Promise<UsageResponsePayload> => {
  const store = createStore();
  const record = await store.load();
  return buildUsageResponse(record, store.trackingAvailable, new Date());
};
