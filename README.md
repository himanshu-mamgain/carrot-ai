# 🥕 Carrot AI

[![npm version](https://img.shields.io/npm/v/carrot-ai.svg)](https://www.npmjs.com/package/carrot-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Carrot AI** is a premium, agentic AI SDK designed for high-performance Llama applications. It seamlessly bridges **AWS Bedrock** and **Ollama**, providing a unified interface for streaming, parallel tool execution, and advanced memory management.

## ✨ Features

- 🌊 **Streaming Support**: Real-time response streaming for ultra-low perceived latency.
- ⚡ **Parallel Tooling**: Execute multiple tool calls simultaneously to speed up complex workflows.
- 🧠 **Memory Management**: Built-in `ConversationHistory` for automatic context pruning and message handling.
- 🛡️ **Type Safety**: Native Zod validation for tool parameters and full TypeScript support.
- 📊 **Audit Ready**: Integrated token usage tracking and performance metrics.
- 🌍 **Cloud & Local**: Switch between AWS Bedrock (Production) and Ollama (Local Dev) with zero code changes.

## 🚀 Installation

```bash
npm install carrot-ai
```

## 🛠️ Quick Start

### Basic Chat

```typescript
import { CarrotAI } from 'carrot-ai';

const carrot = new CarrotAI({
  provider: 'bedrock',
  bedrock: { region: 'us-east-1' }
});

const response = await carrot.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.content);
```

### Local Dev (Ollama)

```typescript
const carrot = new CarrotAI({
  provider: 'ollama' 
});

const response = await carrot.chat({
  messages: [{ role: 'user', content: 'Hello from local Llama!' }],
  model: 'llama3'
});
```

#### 🛠️ Local Setup (Ollama)
1. **Install Ollama**: Download from [ollama.com](https://ollama.com/).
2. **Download Model**: Run `ollama pull llama3` in your terminal.
3. **Run**: Ensure Ollama is running on your machine (automatically starts on port 11434).


### Real-time Streaming

```typescript
for await (const chunk of carrot.chatStream({
  messages: [{ role: 'user', content: 'Tell me a long story.' }]
})) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

## 🧠 Advanced Usage: Agents & Memory

Carrot AI Agents are autonomous and can use tools to perform complex tasks.

```typescript
import { CarrotAgent, tool, ConversationHistory } from 'carrot-ai';
import { z } from 'zod';

const searchTool = tool({
  name: 'web_search',
  description: 'Search the web for current events',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    return { results: [`Information about ${query}`] };
  },
});

const agent = new CarrotAgent({
  tools: [searchTool],
  memory: new ConversationHistory({ maxMessages: 50 }),
  systemPrompt: 'You are a research assistant.'
});

const result = await agent.run('Who won the world cup in 2022?');
```

## 📊 Observability

Track token usage across your application easily:

```typescript
const carrot = new CarrotAI({
  provider: 'bedrock',
  onUsage: (usage) => {
    console.log(`Used ${usage.totalTokens} tokens`);
  }
});
```

## 🛡️ Error Handling

Carrot AI provides specific error classes for granular control:

```typescript
try {
  await carrot.chat({ ... });
} catch (error) {
  if (error instanceof CarrotAuthError) {
    // Handle invalid credentials
  } else if (error instanceof CarrotRateLimitError) {
    // Handle throttling
  }
}
```

## 📜 License

MIT © [Himanshu Mamgain](https://github.com/himanshu-mamgain)
