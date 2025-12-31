import { z } from 'zod';
import { CarrotAI } from './client';
import { Message, ToolDefinition } from './types';

export function tool<P extends z.ZodTypeAny>(definition: ToolDefinition<P>): ToolDefinition<P> {
  return definition;
}

export interface AgentConfig {
  ai: CarrotAI;
  tools?: ToolDefinition[];
  systemPrompt?: string;
}

export class CarrotAgent {
  private ai: CarrotAI;
  private tools: ToolDefinition[];
  private systemPrompt: string;

  constructor(config: AgentConfig) {
    this.ai = config.ai;
    this.tools = config.tools || [];
    this.systemPrompt = config.systemPrompt || "You are a helpful assistant with access to tools. If you need to use a tool, output a JSON block like: {\"tool\": \"tool_name\", \"parameters\": {...}}";
  }

  async run(prompt: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: prompt }
    ];

    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      const response = await this.ai.chat({ messages });
      const content = response.content;

      // Check for tool call
      const toolCall = this.parseToolCall(content);
      if (toolCall) {
        const tool = this.tools.find(t => t.name === toolCall.tool);
        if (tool) {
          try {
            const toolResult = await tool.execute(toolCall.parameters);
            messages.push({ role: 'assistant', content });
            messages.push({ role: 'user', content: `Tool result: ${JSON.stringify(toolResult)}` });
            iterations++;
            continue;
          } catch (error) {
            messages.push({ role: 'assistant', content });
            messages.push({ role: 'user', content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}` });
            iterations++;
            continue;
          }
        }
      }

      return content;
    }

    return "Max iterations reached.";
  }

  private buildSystemPrompt(): string {
    let prompt = this.systemPrompt + "\n\nAvailable tools:\n";
    for (const tool of this.tools) {
      prompt += `- ${tool.name}: ${tool.description}. Parameters: ${JSON.stringify(tool.parameters._def)}\n`;
    }
    return prompt;
  }

  private parseToolCall(content: string): { tool: string; parameters: any } | null {
    try {
      // Look for JSON block
      const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Failed to parse
    }
    return null;
  }
}
