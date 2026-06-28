export class CoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}

export class NotFoundCoreError extends CoreError {
  constructor(entity: string, id: string | number) {
    super('NOT_FOUND', `${entity} with id ${String(id)} was not found`);
    this.name = 'NotFoundCoreError';
  }
}

export class ValidationCoreError extends CoreError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationCoreError';
  }
}
