import { z } from 'zod';
import { CarrotAI } from './client';
import { Message, ToolDefinition, ToolResult } from './types';
import { ConversationHistory } from './history';
import { CarrotValidationError, CarrotToolError } from './errors';

export function tool<P extends z.ZodTypeAny>(definition: ToolDefinition<P>): ToolDefinition<P> {
  return definition;
}

export interface AgentConfig {
  ai: CarrotAI;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  memory?: ConversationHistory;
}

export class CarrotAgent {
  private ai: CarrotAI;
  private tools: ToolDefinition[];
  private systemPrompt: string;
  private memory: ConversationHistory;

  constructor(config: AgentConfig) {
    this.ai = config.ai;
    this.tools = config.tools || [];
    this.systemPrompt = config.systemPrompt || "You are a helpful assistant.";
    this.memory = config.memory || new ConversationHistory({ maxMessages: 20 });
  }

  async run(prompt: string): Promise<string> {
    this.memory.addMessage({ role: 'user', content: prompt });

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const response = await this.ai.chat({
        messages: this.memory.getMessages(),
        systemInstruction: this.systemPrompt,
        tools: this.tools,
      });

      // Add assistant response to history
      this.memory.addMessage({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return response.content;
      }

      // Parallel tool execution
      const toolResults = await Promise.all(
        response.toolCalls.map(async (tc): Promise<ToolResult> => {
          const tool = this.tools.find(t => t.name === tc.name);
          if (!tool) {
            return {
              toolCallId: tc.id,
              content: `Error: Tool "${tc.name}" not found.`,
              isError: true,
            };
          }

          try {
            // Runtime Zod Validation
            const validatedParams = tool.parameters.parse(tc.parameters);
            const result = await tool.execute(validatedParams);
            return {
              toolCallId: tc.id,
              content: JSON.stringify(result),
            };
          } catch (error: any) {
            if (error instanceof z.ZodError) {
              return {
                toolCallId: tc.id,
                content: `Validation Error: ${error.errors.map(e => e.message).join(', ')}`,
                isError: true,
              };
            }
            return {
              toolCallId: tc.id,
              content: error instanceof Error ? error.message : String(error),
              isError: true,
            };
          }
        })
      );

      // Add tool results to history
      this.memory.addMessage({
        role: 'user', // In Bedrock Converse, tool results are often submitted as user role or specialized tool role
        content: toolResults,
      });

      iterations++;
    }

    return "Max iterations reached.";
  }

  getHistory() {
    return this.memory.getMessages();
  }
}
