/**
 * Multi-Provider AI Service
 * Supports: OpenAI, Experiential Labs, freellmapi, Mistral, Cohere, NVIDIA, Z.ai, Hugging Face, GitHub Models
 */

const EXPERIENTIAL_BASE = 'https://platform.experientiallabs.ai/v1';
const FREELLM_BASE = 'https://api.freellmapi.xyz/v1';
const MISTRAL_BASE = 'https://api.mistral.ai/v1';
const COHERE_BASE = 'https://api.cohere.ai/v1';
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const ZAI_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const HF_BASE = 'https://api-inference.huggingface.co/models';
const GITHUB_MODELS_BASE = 'https://models.inference.ai.azure.com';

const PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: { default: 'gpt-4o-mini', chat: 'gpt-4o-mini' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  experiential: {
    baseUrl: EXPERIENTIAL_BASE,
    models: { 'gpt-6-astra': 'gpt-6-astra', 'gpt-5.6-luna': 'gpt-5.6-luna', 'deepseek-v4-flash': 'deepseek-v4-flash', 'qwen3.8-27b': 'qwen3.8-27b' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  freellm: {
    baseUrl: FREELLM_BASE,
    models: { 'gpt-4o': 'gpt-4o', 'gpt-4o-mini': 'gpt-4o-mini', 'gpt-4-turbo': 'gpt-4-turbo', 'claude-3.5-sonnet': 'claude-3.5-sonnet', 'claude-3-haiku': 'claude-3-haiku', 'gemini-1.5-pro': 'gemini-1.5-pro', 'gemini-1.5-flash': 'gemini-1.5-flash', 'llama-3.1-70b': 'llama-3.1-70b', 'llama-3.1-8b': 'llama-3.1-8b', 'mixtral-8x7b': 'mixtral-8x7b', 'qwen-2.5-72b': 'qwen-2.5-72b' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  mistral: {
    baseUrl: MISTRAL_BASE,
    models: { 'mistral-large-latest': 'mistral-large-latest', 'mistral-small-latest': 'mistral-small-latest', 'mistral-nemo': 'mistral-nemo', 'codestral': 'codestral' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  cohere: {
    baseUrl: COHERE_BASE,
    models: { 'command-r-plus': 'command-r-plus', 'command-r': 'command-r', 'command-light': 'command-light' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  nvidia: {
    baseUrl: NVIDIA_BASE,
    models: { 'nvidia/nemotron-3-ultra': 'nvidia/nemotron-3-ultra', 'nvidia/llama-3.1-nemotron-70b-instruct': 'nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-70b-instruct': 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct': 'meta/llama-3.1-8b-instruct', 'nvidia/nemotron-3-8b': 'nvidia/nemotron-3-8b' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  zai: {
    baseUrl: ZAI_BASE,
    models: { 'glm-4': 'glm-4', 'glm-4-flash': 'glm-4-flash', 'glm-4-air': 'glm-4-air', 'glm-4-long': 'glm-4-long' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  hf: {
    baseUrl: HF_BASE,
    models: { 'meta-llama/Meta-Llama-3.1-70B-Instruct': 'meta-llama/Meta-Llama-3.1-70B-Instruct', 'meta-llama/Meta-Llama-3.1-8B-Instruct': 'meta-llama/Meta-Llama-3.1-8B-Instruct', 'mistralai/Mistral-Nemo-Instruct-2407': 'mistralai/Mistral-Nemo-Instruct-2407', 'Qwen/Qwen2.5-72B-Instruct': 'Qwen/Qwen2.5-72B-Instruct', 'microsoft/Phi-3.5-mini-instruct': 'microsoft/Phi-3.5-mini-instruct', 'google/gemma-2-27b-it': 'google/gemma-2-27b-it' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    // HF uses different endpoint format
    getUrl: (model) => `${HF_BASE}/${model}`,
  },
  github: {
    baseUrl: GITHUB_MODELS_BASE,
    models: { 'gpt-4o': 'gpt-4o', 'gpt-4o-mini': 'gpt-4o-mini', 'gpt-4-turbo': 'gpt-4-turbo', 'meta-llama-3.1-70b-instruct': 'meta-llama-3.1-70b-instruct', 'meta-llama-3.1-8b-instruct': 'meta-llama-3.1-8b-instruct', 'mistral-large': 'mistral-large', 'mistral-nemo': 'mistral-nemo', 'phi-3.5-mini': 'phi-3.5-mini', 'cohere-command-r-plus': 'cohere-command-r-plus' },
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
};

function getProviderConfig(provider) {
  return PROVIDERS[provider] || PROVIDERS.openai;
}

async function callAI({ provider, model, messages, temperature = 0.5, maxTokens = 2000, apiKey }) {
  const config = getProviderConfig(provider);
  
  // Handle HF special URL format
  const url = config.getUrl ? config.getUrl(model) : `${config.baseUrl}/chat/completions`;
  
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

function buildProviderChain(env) {
  const chain = [];
  
  // 1. Experiential Labs (highest quality)
  if (env.EXPERIENTIAL_API_KEY) {
    chain.push(
      { provider: 'experiential', model: 'gpt-6-astra', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'gpt-5.6-luna', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'deepseek-v4-flash', apiKey: env.EXPERIENTIAL_API_KEY },
      { provider: 'experiential', model: 'qwen3.8-27b', apiKey: env.EXPERIENTIAL_API_KEY },
    );
  }
  
  // 2. freellmapi (34+ free models)
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
  
  // 3. Mistral (free tier: 1B tokens/mo)
  if (env.MISTRAL_API_KEY) {
    chain.push(
      { provider: 'mistral', model: 'mistral-large-latest', apiKey: env.MISTRAL_API_KEY },
      { provider: 'mistral', model: 'mistral-small-latest', apiKey: env.MISTRAL_API_KEY },
      { provider: 'mistral', model: 'mistral-nemo', apiKey: env.MISTRAL_API_KEY },
    );
  }
  
  // 4. Cohere (free: 100M tokens/mo)
  if (env.COHERE_API_KEY) {
    chain.push(
      { provider: 'cohere', model: 'command-r-plus', apiKey: env.COHERE_API_KEY },
      { provider: 'cohere', model: 'command-r', apiKey: env.COHERE_API_KEY },
    );
  }
  
  // 5. NVIDIA (free via NGC)
  if (env.NVIDIA_API_KEY) {
    chain.push(
      { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra', apiKey: env.NVIDIA_API_KEY },
      { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct', apiKey: env.NVIDIA_API_KEY },
    );
  }
  
  // 6. Z.ai / Zhipu GLM (free tier)
  if (env.ZAI_API_KEY) {
    chain.push(
      { provider: 'zai', model: 'glm-4', apiKey: env.ZAI_API_KEY },
      { provider: 'zai', model: 'glm-4-flash', apiKey: env.ZAI_API_KEY },
    );
  }
  
  // 7. Hugging Face (free inference)
  if (env.HF_API_KEY) {
    chain.push(
      { provider: 'hf', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct', apiKey: env.HF_API_KEY },
      { provider: 'hf', model: 'Qwen/Qwen2.5-72B-Instruct', apiKey: env.HF_API_KEY },
      { provider: 'hf', model: 'mistralai/Mistral-Nemo-Instruct-2407', apiKey: env.HF_API_KEY },
    );
  }
  
  // 8. GitHub Models (free with GitHub token)
  if (env.GITHUB_MODELS_API_KEY) {
    chain.push(
      { provider: 'github', model: 'gpt-4o', apiKey: env.GITHUB_MODELS_API_KEY },
      { provider: 'github', model: 'meta-llama-3.1-70b-instruct', apiKey: env.GITHUB_MODELS_API_KEY },
      { provider: 'github', model: 'mistral-large', apiKey: env.GITHUB_MODELS_API_KEY },
    );
  }
  
  // 9. OpenAI fallback
  if (env.OPENAI_API_KEY) {
    chain.push(
      { provider: 'openai', model: 'gpt-4o-mini', apiKey: env.OPENAI_API_KEY },
      { provider: 'openai', model: 'gpt-3.5-turbo', apiKey: env.OPENAI_API_KEY },
    );
  }
  
  return chain;
}

module.exports = { callAI, callAIWithFallback, buildProviderChain, PROVIDERS };