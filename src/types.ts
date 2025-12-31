import { z } from 'zod';

export type ProviderType = 'bedrock' | 'ollama';

export interface CarrotConfig {
  provider: ProviderType;
  bedrock?: {
    region?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
  };
  ollama?: {
    baseUrl?: string;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  model?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  retries?: number;
  fallbackModels?: string[];
}

export interface ChatResponse {
  content: string;
  role: 'assistant';
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ToolDefinition<P extends z.ZodTypeAny = any> {
  name: string;
  description: string;
  parameters: P;
  execute: (args: z.infer<P>) => Promise<any>;
}
