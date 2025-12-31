import { z } from 'zod';

export type ProviderType = 'bedrock' | 'ollama';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

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
  systemInstruction?: string;
  onUsage?: (usage: Usage) => void;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface Message {
  role: MessageRole;
  content: string | ToolResult[];
  toolCalls?: ToolCall[];
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
  systemInstruction?: string;
  tools?: ToolDefinition[];
  onUsage?: (usage: Usage) => void;
}

export interface ChatResponse {
  content: string;
  role: 'assistant';
  usage: Usage;
  model: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition<P extends z.ZodTypeAny = any> {
  name: string;
  description: string;
  parameters: P;
  execute: (args: z.infer<P>) => Promise<any>;
}

export interface StreamEvent {
  type: 'content' | 'tool_call' | 'usage' | 'done';
  content?: string;
  toolCall?: ToolCall;
  usage?: Usage;
}

export type ChatStream = AsyncIterable<StreamEvent>;
