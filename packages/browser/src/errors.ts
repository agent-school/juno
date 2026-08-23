/**
 * Typed error taxonomy for the Juno browser layer.
 *
 * Raw Playwright errors never escape the package public API: boundary modules
 * (`session.ts`, later `actor.ts`) map them onto these classes.
 */
export class ProfileInUseError extends Error {
  readonly code = 'PROFILE_IN_USE' as const;

  constructor(message = 'Juno is already running with this profile.') {
    super(message);
    this.name = 'ProfileInUseError';
  }
}

export class InvalidUrlError extends Error {
  readonly code = 'INVALID_URL' as const;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export class SnapshotParseError extends Error {
  readonly code = 'SNAPSHOT_PARSE' as const;

  /** Zod issues (schema rejection) or the underlying YAML parse error, when available. */
  readonly issues: unknown;

  constructor(
    message: string,
    options: { issues?: unknown; cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = 'SnapshotParseError';
    this.issues = options.issues ?? null;
  }
}
