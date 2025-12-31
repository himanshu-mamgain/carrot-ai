# 🥕 Carrot AI

[![npm version](https://img.shields.io/npm/v/carrot-ai.svg)](https://www.npmjs.com/package/carrot-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Carrot AI** is a powerful, lightweight, and agentic AI SDK designed to bring the power of Llama models to your local applications via AWS Bedrock. Built with robustness and developer experience in mind, Carrot AI provides a seamless interface for chat, tool-calling, and autonomous agents.

## ✨ Features

- 🤖 **Agentic by Design**: Native support for tool calling and structured outputs.
- 🦙 **Llama Powered**: Optimized for Meta's Llama 3/3.1 models.
- 🌍 **Cloud & Local**: Works with **AWS Bedrock** (Cloud) and **Ollama** (Local).
- 🛡️ **Robustness**: Built-in fallback mechanisms and advanced retry logic (exponential backoff).
- ⚙️ **Fine-grained Control**: Easy adjustment of temperature, top-p, max tokens, and more.
- 📦 **TypeScript First**: Fully typed for a superior developer experience.

## 🚀 Installation

```bash
npm install carrot-ai
```

## 🛠️ Quick Start

### Option 1: Using AWS Bedrock (Cloud)

```typescript
import { CarrotAI } from 'carrot-ai';

const carrot = new CarrotAI({
  provider: 'bedrock',
  bedrock: {
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
  }
});

const response = await carrot.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Option 2: Using Ollama (Local)

```typescript
import { CarrotAI } from 'carrot-ai';

const carrot = new CarrotAI({
  provider: 'ollama',
  ollama: {
    baseUrl: 'http://localhost:11434' // Optional, defaults to localhost
  }
});

const response = await carrot.chat({
  messages: [{ role: 'user', content: 'Hello from local Llama!' }],
  model: 'llama3' // Default for Ollama
});
```

#### 🛠️ Local Setup (Ollama)
1. **Install Ollama**: Download from [ollama.com](https://ollama.com/).
2. **Download Model**: Run `ollama pull llama3` in your terminal.
3. **Run**: Ensure Ollama is running on your machine (it starts automatically on port 11434).



## 🧠 Advanced Usage: Agents & Tools

Carrot AI makes it easy to create agents that can perform tasks using external tools.

```typescript
import { CarrotAgent, tool } from 'carrot-ai';
import { z } from 'zod';

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get the current weather in a given location',
  parameters: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  }),
  execute: async ({ location }) => {
    return { temperature: '22°C', condition: 'Sunny' };
  },
});

const agent = new CarrotAgent({
  tools: [weatherTool],
});

const result = await agent.run('What is the weather in London?');
console.log(result);
```

## 🛡️ Fallback & Retry Logic

Carrot AI automatically handles transient network errors and rate limits. You can also configure fallbacks:

```typescript
const response = await carrot.chat({
  messages: [...],
  fallbackModels: ['meta.llama3-8b-instruct-v1:0'],
  retries: 3
});
```

## 📄 Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `string` | `meta.llama3-70b-instruct-v1:0` | The model ID to use |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `maxTokens` | `number` | `2048` | Maximum tokens to generate |
| `topP` | `number` | `0.9` | Nucleus sampling factor |
| `stopSequences` | `string[]` | `[]` | Tokens that stop generation |

## 📜 License

MIT © [Himanshu Mamgain](https://github.com/himanshu-mamgain)
