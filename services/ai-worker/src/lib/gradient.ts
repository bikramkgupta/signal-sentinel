/**
 * Gradient AI Client (DigitalOcean)
 *
 * OpenAI-compatible API client for DigitalOcean's serverless inference.
 * Endpoint: https://inference.do-ai.run/v1
 * Docs: https://docs.digitalocean.com/products/gradient-ai-platform/how-to/use-serverless-inference/
 */

export interface GradientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GradientClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Load Gradient configuration from environment variables.
 */
export function loadGradientConfig(): GradientConfig {
  const baseUrl = process.env.GRADIENT_BASE_URL;
  const apiKey = process.env.GRADIENT_API_KEY;
  const model = process.env.GRADIENT_MODEL;

  if (!baseUrl) {
    throw new Error('GRADIENT_BASE_URL environment variable is required');
  }
  if (!apiKey) {
    throw new Error('GRADIENT_API_KEY environment variable is required');
  }
  if (!model) {
    throw new Error('GRADIENT_MODEL environment variable is required');
  }

  return { baseUrl, apiKey, model };
}

/**
 * Validate Gradient API connection by making a test call.
 * Throws if the API key is invalid or the service is unreachable.
 */
export async function validateGradientConnection(config?: GradientConfig): Promise<void> {
  const cfg = config ?? loadGradientConfig();

  console.log(`Validating Gradient AI connection...`);
  console.log(`  Base URL: ${cfg.baseUrl}`);
  console.log(`  Model: ${cfg.model}`);
  console.log(`  API Key: ${cfg.apiKey.substring(0, 10)}...${cfg.apiKey.substring(cfg.apiKey.length - 4)}`);

  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gradient API validation failed (${response.status}): ${errorText}`);
  }

  await response.json();
  console.log(`  Validation successful! Model responded.`);
}

/**
 * Create a Gradient AI client.
 */
export function createGradientClient(config?: GradientConfig): GradientClient {
  const cfg = config ?? loadGradientConfig();

  async function chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<string> {
    const { maxTokens = 1024, temperature = 0.7 } = options;

    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gradient API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Gradient API returned no choices');
    }

    return data.choices[0].message.content;
  }

  return { chat };
}
