export interface ExternalServiceErrorContext {
  provider: string;
  operation: string;
  retryable: boolean;
  statusCode?: number;
  requestId?: string;
}

export class ExternalServiceError extends Error {
  public readonly context: ExternalServiceErrorContext;

  public constructor(message: string, context: ExternalServiceErrorContext, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExternalServiceError";
    this.context = context;
  }
}
