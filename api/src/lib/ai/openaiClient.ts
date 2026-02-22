export type AiProvider = 'openai' | 'azure';

export type OpenAIClientAdapter = {
  provider: AiProvider;
  modelOrDeployment: string;
  requestUrl: string;
  headers: Record<string, string>;
};

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const getOpenAIClient = (): OpenAIClientAdapter => {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const openAiModel = process.env.TIME_RESOLVE_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

  if (azureEndpoint) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY is not configured');

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || openAiModel;
    if (!deployment) throw new Error('AZURE_OPENAI_DEPLOYMENT is not configured');

    const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || '2025-03-01-preview';
    const endpointRoot = trimSlash(azureEndpoint);
    return {
      provider: 'azure',
      modelOrDeployment: deployment,
      requestUrl: `${endpointRoot}/openai/responses?api-version=${encodeURIComponent(apiVersion)}`,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  return {
    provider: 'openai',
    modelOrDeployment: openAiModel,
    requestUrl: 'https://api.openai.com/v1/responses',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
};
