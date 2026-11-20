# Checkbox inputs and canonical site routes

## Goal

Address review threads 4566427331 and 4566427088 without expanding compiler authority or changing hosted UI flows.

1. Reproduce false checkbox input and dotted-route failures with meaningful regression checks.
2. Make SemanticActor and the guard accept the desired boolean checkbox state, defaulting to true for existing one-argument calls. Bind confirmation to that state, reject non-booleans and verify both states in a real browser.
3. Share one bounded canonical pathname schema across observed pages, navigation destinations and operation routes. Accept dotted, encoded and ordinary URL path characters while rejecting origins, queries, fragments, malformed escapes and normalization aliases. Exercise compilation, navigation, contracts and persistence reload.
4. Run typechecks, unit/browser checks and CI; update GSD evidence and reply separately in each review thread. No new tooling or deployment is required.
