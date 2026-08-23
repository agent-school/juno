/**
 * Typed error taxonomy for the Juno browser layer.
 *
 * Raw Playwright errors never escape the package public API: boundary modules
 * (`session.ts`, `actor.ts`) map them onto these classes.
 */

/**
 * Base class for the grounding failure family — Phase 2's safety guard
 * catches this family to intercept every fail-safe grounding outcome.
 */
export class GroundingError extends Error {
  /** Semantic description of the attempted reference — never raw eN ids (T-1-09). */
  readonly refDescription: string;

  constructor(message: string, refDescription: string) {
    super(message);
    this.name = 'GroundingError';
    this.refDescription = refDescription;
  }
}

/** Zero matches (or an action timeout) for a strict locator / aria-ref action. */
export class GroundingTimeout extends GroundingError {
  readonly code = 'GROUNDING_TIMEOUT' as const;

  constructor(message: string, refDescription: string) {
    super(message, refDescription);
    this.name = 'GroundingTimeout';
  }
}

/** A semantic reference matched more than one element (strict-mode violation). */
export class AmbiguousReference extends GroundingError {
  readonly code = 'AMBIGUOUS_REFERENCE' as const;

  constructor(message: string, refDescription: string) {
    super(message, refDescription);
    this.name = 'AmbiguousReference';
  }
}

/** A reference no longer resolves to the semantic identity it was captured with. */
export class StaleReference extends GroundingError {
  readonly code = 'STALE_REFERENCE' as const;

  constructor(message: string, refDescription: string) {
    super(message, refDescription);
    this.name = 'StaleReference';
  }
}

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
