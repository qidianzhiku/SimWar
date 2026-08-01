# A5 Compatibility Contract

`contracts/schemas/a5-compatibility.v1.json` publishes closed JSON-internal exchange shapes for `ExactRef`, `ModeBinding`, `EvidenceArtifact`, `ProvenanceEdge`, `DecisionThreadRef`, and the three `DomainEventEnvelope` variants. The schema fixture set is validated by `npm run test:contract`.

The contract accepts immutable exact references only: identity and tenant fields reject indirection tokens, and versions reject `x` or `*` segments at every depth. The JSON Schema validates closed object shapes, discriminators, exact-reference structure, and the three event variants. Same-tenant provenance and exact evidence/event/decision-thread alias traceability are semantic rules enforced by the pure `@simwar/shared-contracts` validators and their focused tests; no schema runtime, custom AJV keyword, resolver, or writer is introduced.

`A5DomainEventType` is the narrow A5 event discriminator exported from the shared-contracts barrel. It deliberately does not claim or replace any broader domain-event type.

This is validation-only compatibility metadata. It introduces no routes, resolver, writer, graph authority, mode runtime, truth, settlement, score, rank, replay, database, or external-AI authority.
