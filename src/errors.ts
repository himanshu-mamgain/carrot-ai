export class CarrotError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'CarrotError';
  }
}

export class CarrotAuthError extends CarrotError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'CarrotAuthError';
  }
}

export class CarrotRateLimitError extends CarrotError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'CarrotRateLimitError';
  }
}

export class CarrotToolError extends CarrotError {
  constructor(message: string, public readonly toolName: string) {
    super(`Error in tool "${toolName}": ${message}`, 'TOOL_ERROR');
    this.name = 'CarrotToolError';
  }
}

export class CarrotValidationError extends CarrotError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'CarrotValidationError';
  }
}
