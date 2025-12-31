import pRetry from 'p-retry';
import { CarrotConfig, ChatOptions, ChatResponse, Message } from './types';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

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
      messages, 
      retries = 3, 
      fallbackModels = [] 
    } = options;

    const runWithRetry = async (currentModel: string) => {
      return pRetry(
        async () => {
          if (this.config.provider === 'bedrock') {
            return await this.invokeBedrock(currentModel, options);
          } else {
            return await this.invokeOllama(currentModel, options);
          }
        },
        {
          retries: retries,
          onFailedAttempt: (error: any) => {
            console.warn(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
          },
        }
      );
    };

    try {
      return await runWithRetry(model);
    } catch (error) {
      if (fallbackModels.length > 0) {
        console.warn(`Primary model ${model} failed after retries. Trying fallbacks...`);
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

  private async invokeBedrock(modelId: string, options: ChatOptions): Promise<ChatResponse> {
    if (!this.bedrockClient) throw new Error('Bedrock client not initialized');
    
    const prompt = this.formatLlamaPrompt(options.messages);
    
    const payload = {
      prompt,
      max_gen_len: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await this.bedrockClient.send(command);
    const decodedResponse = new TextDecoder().decode(response.body);
    const result = JSON.parse(decodedResponse);

    return {
      content: result.generation,
      role: 'assistant',
      model: modelId,
      usage: {
        inputTokens: result.prompt_token_count || 0,
        outputTokens: result.generation_token_count || 0,
        totalTokens: (result.prompt_token_count || 0) + (result.generation_token_count || 0),
      }
    };
  }

  private async invokeOllama(modelId: string, options: ChatOptions): Promise<ChatResponse> {
    const baseUrl = this.config.ollama?.baseUrl || 'http://localhost:11434';
    
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 0.9,
          num_predict: options.maxTokens || 2048,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      content: result.message.content,
      role: 'assistant',
      model: modelId,
      usage: {
        inputTokens: result.prompt_eval_count || 0,
        outputTokens: result.eval_count || 0,
        totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
      }
    };
  }

  private formatLlamaPrompt(messages: Message[]): string {
    let prompt = '<|begin_of_text|>';
    for (const msg of messages) {
      prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    }
    prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';
    return prompt;
  }
}
