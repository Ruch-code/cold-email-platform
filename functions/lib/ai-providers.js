/**
 * Multi-Provider AI Service
 * Supports: OpenAI, Experiential Labs, freellmapi
 */

const EXPERIENTIAL_BASE = 'https://platform.experientiallabs.ai/v1';
const FREELLM_BASE = 'https://api.freellmapi.xyz/v1'; // Update if different

const PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: {
      default: 'gpt-4o-mini',
      chat: 'gpt-4o-mini',
    },
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  experiential: {
    baseUrl: EXPERIENTIAL_BASE,
    models: {
      'gpt-6-astra': 'gpt-6-astra',
      'gpt-5.6-luna': 'gpt-5.6-luna',
      'deepseek-v4-flash': 'deepseek-v4-flash',
      'qwen3.8-27b': 'qwen3.8-27b',
    },
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  freellm: {
    baseUrl: FREELLM_BASE,
    models: {
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4-turbo': 'gpt-4-turbo',
      'claude-3.5-sonnet': 'claude-3.5-sonnet',
      'claude-3-haiku': 'claude-3-haiku',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'llama-3.1-70b': 'llama-3.1-70b',
      'llama-3.1-8b': 'llama-3.1-8b',
      'mixtral-8x7b': 'mixtral-8x7b',
      'qwen-2.5-72b': 'qwen-2.5-72b',
    },
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
};

function getProviderConfig(provider) {
  return PROVIDERS[provider] || PROVIDERS.openai;
}

async function callAI({ provider, model, messages, temperature = 0.5, maxTokens = 2000, apiKey }) {
  const config = getProviderConfig(provider);
  const url = `${config.baseUrl}/chat/completions`;
  
  const body = {
    model: model || config.models.default,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: config.headers(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`${provider} API error: ${response.status} - ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Try multiple providers in order until one succeeds
 */
async function callAIWithFallback(providerConfigs, { messages, temperature = 0.5, maxTokens = 2000 }) {
  let lastError;
  
  for (const config of providerConfigs) {
    if (!config.apiKey) continue;
    
    try {
      const result = await callAI({
        provider: config.provider,
        model: config.model,
        messages,
        temperature,
        maxTokens,
        apiKey: config.apiKey,
      });
      return { content: result, provider: config.provider, model: config.model };
    } catch (err) {
      lastError = err;
      console.warn(`${config.provider} (${config.model}) failed:`, err.message);
      continue;
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

/**
 * Build provider chain from environment variables
 * Priority order (first working one wins)
 */
function buildProviderChain(env) {
  const chain = [];
  
  // Experiential Labs models (higher priority for quality)
  if (env.EXPERIENTIAL_API_KEY) {
    chain.push(
      { provider: 'experiential', model: 'gpt-6-astra', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'gpt-5.6-luna', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'deepseek-v4-flash', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'qwen3.8-27b', apiKey: env.EXPERIENTIAL_API_KEY },
    );
  }
  
  // freellmapi (free tier with many models)
  if (env.FREELLM_API_KEY) {
    chain.push(
      { provider: 'freellm', model: 'gpt-4o', apiKey: env.FREELLM_API_KEY },
      { provider: 'freellm', model: 'claude-3.5-sonnet', apiKey: env.FREELLM_API_KEY },
      { provider: 'freellm', model: 'gemini-1.5-pro', apiKey: env.FREELLM_API_KEY },
      { provider: 'freellm', model: 'gpt-4o-mini', apiKey: env.FREELLM_API_KEY },
      { provider: 'freellm', model: 'claude-3-haiku', apiKey: env.FREELLM_API_KEY },
      { provider: 'freellm', model: 'gemini-1.5-flash', apiKey: env.FREELLM_API_KEY },
    );
  }
  
  // OpenAI fallback
  if (env.OPENAI_API_KEY) {
    chain.push(
      { provider: 'openai', model: 'gpt-4o-mini', apiKey: env.OPENAI_API_KEY },
      { provider: 'openai', model: 'gpt-3.5-turbo', apiKey: env.OPENAI_API_KEY },
    );
  }
  
  return chain;
}

module.exports = {
  callAI,
  callAIWithFallback,
  buildProviderChain,
  PROVIDERS,
};