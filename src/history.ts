import { Message } from './types';

export interface HistoryOptions {
  maxMessages?: number;
  maxTokens?: number; // Not implemented yet without a tokenizer, but placeholder
}

export class ConversationHistory {
  private messages: Message[] = [];
  private maxMessages: number;

  constructor(options: HistoryOptions = {}) {
    this.maxMessages = options.maxMessages || 100;
  }

  addMessage(message: Message) {
    this.messages.push(message);
    this.prune();
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clear() {
    this.messages = [];
  }

  private prune() {
    if (this.messages.length > this.maxMessages) {
      // Keep system messages if they exist at the start
      const systemMessages = this.messages.filter(m => m.role === 'system');
      const otherMessages = this.messages.filter(m => m.role !== 'system');
      
      const toKeep = this.maxMessages - systemMessages.length;
      if (toKeep > 0) {
        this.messages = [...systemMessages, ...otherMessages.slice(-toKeep)];
      } else {
        this.messages = systemMessages.slice(-this.maxMessages);
      }
    }
  }

  toJSON() {
    return this.messages;
  }
}
