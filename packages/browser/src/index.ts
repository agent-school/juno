export { BrowserSession, validateUrl } from './session.js';
export type { BrowserSessionOptions } from './session.js';
export {
  InvalidUrlError,
  ProfileInUseError,
  SnapshotParseError,
  UnsafeProfileDirError,
} from './errors.js';
export { assertDedicatedProfileDir, resolveProfileDir } from './profile.js';
export { parseAriaYaml } from './parse-yaml.js';
export { SemanticPageReader } from './reader.js';
export { SemanticActor } from './actor.js';
export type { SemanticActorOptions } from './actor.js';
export {
  BoxSchema,
  PageTreeSchema,
  SnapshotNodeSchema,
} from './snapshot-schema.js';
export type { Box, PageTree, SnapshotNode } from './snapshot-schema.js';
export {
  describeRef,
  resolveEphemeralRef,
  resolveSemanticRef,
  toGroundingError,
  validateFresh,
} from './refs.js';
export type {
  AnyRef,
  EphemeralRef,
  RefIdentity,
  ScopeEntry,
  SemanticRef,
} from './refs.js';
export {
  AmbiguousReference,
  GroundingError,
  GroundingTimeout,
  StaleReference,
} from './errors.js';
