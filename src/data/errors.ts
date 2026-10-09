/** One error type for everything that can go wrong between the app and its backend. */
export type ErrorKind =
  | 'offline' // no connection, or the request never arrived
  | 'timeout'
  | 'auth' // signed out, session expired, wrong credentials
  | 'duplicate' // unique constraint: the word already exists
  | 'conflict' // the row changed elsewhere since it was loaded
  | 'rate_limit'
  | 'validation' // the server rejected the input
  | 'not_configured' // backend or AI service not set up (yet)
  | 'not_found'
  | 'server'

export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    /** Machine-readable detail, e.g. "invalid_credentials" or "multiple_words". */
    readonly code: string = kind,
    message: string = code,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** Worth trying again later without the user changing anything. */
  get transient(): boolean {
    return this.kind === 'offline' || this.kind === 'timeout' || this.kind === 'server' || this.kind === 'rate_limit'
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof Error && err.name === 'AbortError') return new AppError('timeout', 'aborted')
  return new AppError('server', 'unexpected', err instanceof Error ? err.message : String(err))
}
