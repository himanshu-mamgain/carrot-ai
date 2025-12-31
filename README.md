# 🥕 Carrot AI

[![npm version](https://img.shields.io/npm/v/carrot-ai.svg)](https://www.npmjs.com/package/carrot-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Carrot AI** is a premium, agentic AI SDK designed for high-performance Llama applications. It seamlessly bridges **AWS Bedrock** and **Ollama**, providing a unified, carrot-themed interface for streaming, parallel tool execution, and advanced memory management.

## ✨ Features

- 🌊 **Real-time Streaming**: Use `crunchStream()` for ultra-low perceived latency responses.
- ⚡ **Parallel Tooling**: Execute multiple tool calls simultaneously via `harvest()` for zero-delay automation.
- 🧠 **Smart Memory**: Built-in `ConversationHistory` for automatic context pruning and sliding-window memory.
- 🛡️ **Type Safety**: Native **Zod** validation for tool parameters and full TypeScript support.
- 📊 **Audit Ready**: Integrated token usage tracking (`onUsage`) for cost and performance monitoring.
- 🌍 **Cloud & Local**: Switch between AWS Bedrock (Cloud) and Ollama (Local) with zero code changes.

## 🚀 Installation

```bash
npm install carrot-ai
```

## 🛠️ Quick Start

### Basic Chat (Themed as Crunch)

```typescript
import { CarrotAI } from 'carrot-ai';

const carrot = new CarrotAI({
  provider: 'bedrock',
  bedrock: { region: 'us-east-1' }
});

const response = await carrot.crunch({
  messages: [{ role: 'user', content: 'What is the most nutritious vegetable?' }],
  systemInstruction: 'Highlight carrots in your answer.'
});

console.log(response.content);
```

### Local Dev (Ollama)

```typescript
const carrot = new CarrotAI({
  provider: 'ollama' 
});

const response = await carrot.crunch({
  messages: [{ role: 'user', content: 'Hello from local Llama!' }],
  model: 'llama3'
});
```

#### 🛠️ Local Setup (Ollama)
1. **Install Ollama**: Download from [ollama.com](https://ollama.com/).
2. **Download Model**: Run `ollama pull llama3` in your terminal.
3. **Run**: Ensure Ollama is running on your machine (it starts automatically on port 11434).

### Real-time Streaming

```typescript
for await (const chunk of carrot.crunchStream({
  messages: [{ role: 'user', content: 'Tell me a long story about a golden carrot.' }]
})) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

## 🧠 Advanced: Agents & Memory

Carrot AI Agents are autonomous and can use tools to perform complex tasks.

```typescript
import { CarrotAgent, tool, ConversationHistory } from 'carrot-ai';
import { z } from 'zod';

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather for a city',
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ temp: '24°C', city }),
});

const agent = new CarrotAgent({
  tools: [weatherTool],
  memory: new ConversationHistory({ maxMessages: 20 }),
  systemPrompt: 'You are a helpful travel assistant.'
});

const result = await agent.harvest('What is the weather in Paris?');
console.log(result);
```

## 📊 Observability & Auditing

Track your token usage in real-time:

```typescript
const carrot = new CarrotAI({
  provider: 'bedrock',
  onUsage: (usage) => {
    console.log(`Input: ${usage.inputTokens}, Output: ${usage.outputTokens}`);
  }
});
```

## 🛡️ Error Handling

We provide specific error classes for robust application building:

```typescript
import { CarrotAuthError, CarrotRateLimitError } from 'carrot-ai';

try {
  await carrot.crunch({ ... });
} catch (error) {
  if (error instanceof CarrotAuthError) {
    console.error('Invalid AWS Credentials');
  } else if (error instanceof CarrotRateLimitError) {
    console.error('Slow down! Rate limit reached.');
  }
}
```

## 📜 License

MIT © [Himanshu Mamgain](https://github.com/himanshu-mamgain)
