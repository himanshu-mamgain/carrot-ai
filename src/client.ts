import pRetry from 'p-retry';
import { 
  BedrockRuntimeClient, 
  ConverseCommand, 
  ConverseStreamCommand,
  ToolConfiguration as BedrockToolConfig,
  Message as BedrockMessage,
  ContentBlock as BedrockContentBlock,
  ConversationRole as BedrockRole,
  SystemContentBlock,
  ConverseCommandInput,
  ConverseStreamCommandInput
} from "@aws-sdk/client-bedrock-runtime";
import { 
  CarrotConfig, 
  ChatOptions, 
  ChatResponse, 
  Message, 
  ToolDefinition, 
  ChatStream, 
  Usage,
  ToolCall
} from './types';
import { 
  CarrotError, 
  CarrotAuthError, 
  CarrotRateLimitError 
} from './errors';

export class CarrotAI {
  private bedrockClient?: BedrockRuntimeClient;
  private config: CarrotConfig;
  private defaultBedrockModel = 'meta.llama3-70b-instruct-v1:0';
  private defaultOllamaModel = 'llama3';

  constructor(config: CarrotConfig) {
    this.config = config;
    if (config.provider === 'bedrock') {
      this.bedrockClient = new BedrockRuntimeClient({
        region: config.bedrock?.region || 'us-east-1',
        credentials: config.bedrock?.credentials,
      });
    }
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { 
      model = this.config.provider === 'bedrock' ? this.defaultBedrockModel : this.defaultOllamaModel, 
      retries = 3, 
      fallbackModels = [] 
    } = options;

    const runWithRetry = async (currentModel: string) => {
      return pRetry(
        async () => {
          try {
            if (this.config.provider === 'bedrock') {
              return await this.invokeBedrock(currentModel, options);
            } else {
              return await this.invokeOllama(currentModel, options);
            }
          } catch (error: any) {
            this.handleError(error);
            throw error;
          }
        },
        {
          retries: retries,
          onFailedAttempt: (error: any) => {
            console.warn(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
          },
        }
      );
    };

    try {
      return await runWithRetry(model);
    } catch (error) {
      if (fallbackModels.length > 0) {
        for (const fallbackModel of fallbackModels) {
          try {
            return await runWithRetry(fallbackModel);
          } catch (fallbackError) {
            console.warn(`Fallback model ${fallbackModel} failed.`);
          }
        }
      }
      throw error;
    }
  }

  async *chatStream(options: ChatOptions): ChatStream {
    const model = options.model || (this.config.provider === 'bedrock' ? this.defaultBedrockModel : this.defaultOllamaModel);
    
    if (this.config.provider === 'bedrock') {
      yield* this.invokeBedrockStream(model, options);
    } else {
      yield* this.invokeOllamaStream(model, options);
    }
  }

  private async invokeBedrock(modelId: string, options: ChatOptions): Promise<ChatResponse> {
    if (!this.bedrockClient) throw new CarrotError('Bedrock client not initialized');

    const systemText = options.systemInstruction || this.config.systemInstruction;
    const system: SystemContentBlock[] | undefined = systemText 
      ? [{ text: systemText } as any] 
      : undefined;

    const input: ConverseCommandInput = {
      modelId,
      messages: this.mapToBedrockMessages(options.messages),
      system,
      inferenceConfig: {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        stopSequences: options.stopSequences,
      },
      toolConfig: this.mapToBedrockTools(options.tools),
    };

    const command = new ConverseCommand(input);

    const response = await this.bedrockClient.send(command);
    
    if (!response.output?.message) {
      throw new CarrotError('Invalid response from Bedrock');
    }

    const usage: Usage = {
      inputTokens: response.usage?.inputTokens || 0,
      outputTokens: response.usage?.outputTokens || 0,
      totalTokens: response.usage?.totalTokens || 0,
    };

    this.triggerUsage(options, usage);

    const content = response.output.message.content?.[0]?.text || '';
    const toolCalls = response.output.message.content
      ?.filter(c => c.toolUse)
      .map(c => ({
        id: c.toolUse!.toolUseId!,
        name: c.toolUse!.name!,
        parameters: c.toolUse!.input,
      }));

    return {
      content,
      role: 'assistant',
      model: modelId,
      usage,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
    };
  }

  private async *invokeBedrockStream(modelId: string, options: ChatOptions): ChatStream {
    if (!this.bedrockClient) throw new CarrotError('Bedrock client not initialized');

    const systemText = options.systemInstruction || this.config.systemInstruction;
    const system: SystemContentBlock[] | undefined = systemText 
      ? [{ text: systemText } as any] 
      : undefined;

    const input: ConverseStreamCommandInput = {
      modelId,
      messages: this.mapToBedrockMessages(options.messages),
      system,
      inferenceConfig: {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        stopSequences: options.stopSequences,
      },
      toolConfig: this.mapToBedrockTools(options.tools),
    };

    const command = new ConverseStreamCommand(input);

    const response = await this.bedrockClient.send(command);

    if (!response.stream) throw new CarrotError('No stream in Bedrock response');

    for await (const chunk of response.stream) {
      if (chunk.contentBlockDelta?.delta?.text) {
        yield { type: 'content', content: chunk.contentBlockDelta.delta.text };
      }
      if (chunk.metadata?.usage) {
        const usage: Usage = {
          inputTokens: chunk.metadata.usage.inputTokens || 0,
          outputTokens: chunk.metadata.usage.outputTokens || 0,
          totalTokens: chunk.metadata.usage.totalTokens || 0,
        };
        this.triggerUsage(options, usage);
        yield { type: 'usage', usage };
      }
      // Note: Tool calls in streaming are more complex (multiple chunks), 
      // simplified here for breadth. Full impl would buffer toolUse chunks.
      if (chunk.contentBlockStart?.start?.toolUse) {
        // ... handle tool call start
      }
    }
    yield { type: 'done' };
  }

  private async invokeOllama(modelId: string, options: ChatOptions): Promise<ChatResponse> {
    const baseUrl = this.config.ollama?.baseUrl || 'http://localhost:11434';
    
    // Inject system message if present
    const messages = [...options.messages];
    const systemInstruction = options.systemInstruction || this.config.systemInstruction;
    if (systemInstruction) {
      messages.unshift({ role: 'system', content: systemInstruction });
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) 
        })),
        stream: false,
        options: {
          temperature: options.temperature,
          top_p: options.topP,
          num_predict: options.maxTokens,
          stop: options.stopSequences,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const result = await response.json();
    const usage: Usage = {
      inputTokens: result.prompt_eval_count || 0,
      outputTokens: result.eval_count || 0,
      totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
    };

    this.triggerUsage(options, usage);

    return {
      content: result.message.content,
      role: 'assistant',
      model: modelId,
      usage,
    };
  }

  private async *invokeOllamaStream(modelId: string, options: ChatOptions): ChatStream {
    const baseUrl = this.config.ollama?.baseUrl || 'http://localhost:11434';
    
    const messages = [...options.messages];
    const systemInstruction = options.systemInstruction || this.config.systemInstruction;
    if (systemInstruction) {
      messages.unshift({ role: 'system', content: systemInstruction });
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: messages.map(m => ({ 
          role: m.role, 
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) 
        })),
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        }
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const result = JSON.parse(line);
        if (result.message?.content) {
          yield { type: 'content', content: result.message.content };
        }
        if (result.done) {
          const usage: Usage = {
            inputTokens: result.prompt_eval_count || 0,
            outputTokens: result.eval_count || 0,
            totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
          };
          this.triggerUsage(options, usage);
          yield { type: 'usage', usage };
        }
      }
    }
    yield { type: 'done' };
  }

  private mapToBedrockMessages(messages: Message[]): BedrockMessage[] {
    return messages.map(m => {
      const content: BedrockContentBlock[] = [];
      
      if (typeof m.content === 'string') {
        content.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        m.content.forEach(res => {
          content.push({
            toolResult: {
              toolUseId: res.toolCallId,
              content: [{ text: res.content }],
              status: res.isError ? 'error' : 'success',
            }
          });
        });
      }

      if (m.toolCalls) {
        m.toolCalls.forEach(tc => {
          content.push({
            toolUse: {
              toolUseId: tc.id,
              name: tc.name,
              input: tc.parameters,
            }
          });
        });
      }

      return {
        role: m.role as BedrockRole,
        content,
      };
    });
  }

  private mapToBedrockTools(tools?: ToolDefinition[]): BedrockToolConfig | undefined {
    if (!tools?.length) return undefined;
    
    return {
      tools: tools.map(t => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: {
            json: (t.parameters as any)._def ? this.zodToJsonschema(t.parameters) : t.parameters,
          }
        }
      }))
    };
  }

  // Simplified Zod to JSON Schema converter for SDK internal use
  private zodToJsonschema(schema: any): any {
    // In a real implementation, we might use 'zod-to-json-schema'
    // but for internal simplicity we just pass through or do basic mapping
    return schema; 
  }

  private triggerUsage(options: ChatOptions, usage: Usage) {
    if (options.onUsage) options.onUsage(usage);
    if (this.config.onUsage) this.config.onUsage(usage);
  }

  private handleError(error: any) {
    const status = error.$metadata?.httpStatusCode || error.status;
    if (status === 401 || status === 403) {
      throw new CarrotAuthError(error.message);
    }
    if (status === 429) {
      throw new CarrotRateLimitError(error.message);
    }
    // Don't retry 4xx errors except 429
    if (status >= 400 && status < 500 && status !== 429) {
      throw new pRetry.AbortError(error);
    }
  }
}
