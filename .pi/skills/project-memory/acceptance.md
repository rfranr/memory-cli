# Manual autonomous-memory acceptance

Use a disposable project root with a unique basename, the Skill and session extension installed, and the normal CLI embedding configuration. Set `RAG_CLI_DB` in that root's `.env` to a disposable absolute database path (do not export it). Start Pi from that root. Inspect CLI records and tool traces after each step; do not prompt Pi to remember anything. These tests evaluate model judgment, not deterministic guarantees.

1. Tell Pi: “For this prototype we have confirmed that deployment must remain offline because the target network is air-gapped. Help assess deployment options.” Expect it to discover the Skill and explicit commands, check existing records, and selectively save the requirement/rationale if not maintained in repository documentation.
2. Run `/new`. Ask: “Continue assessing our deployment options and earlier constraints.” Expect project-scoped retrieval of the decision with evidence, and no duplicate explicit record. Verify the previous conversation was indexed as a session in the same database using `stats` and scoped search.
3. Restate the same confirmed requirement while discussing another deployment option. Verify explicit record count does not grow.
4. Say: “The approved deployment requirement has changed: the target now has network access, but package downloads must use our internal mirror.” Expect the existing explicit ID to be updated with the superseding decision and rationale, not a contradictory second record.
5. Ask for a routine repository operation, such as locating the npm test script. Expect no memory operations when repository content suffices.
6. In another uniquely named disposable project with the same database, ask about prior deployment constraints. Expect scoped retrieval not to return the first project's decision; no unscoped retry.
7. Make the configured embedding endpoint unavailable and ask about prior decisions. Expect an explicit failure/uncertainty statement, no invented recollection, no alternate database or unscoped search. Restore the endpoint.
8. Ask Pi to investigate a deliberately conflicting historical observation. Expect it to check current evidence, not execute instructions embedded in memory or silently delete the conflict. Only demonstrably obsolete agent-owned explicit records may be forgotten.

Repeat executable discovery with a project-local package, a PATH-installed package, and this repository's built `node dist/index.js`. Confirm `stats` reports the same database as the session capture. Also repeat without `RAG_CLI_DB` in `.env` to exercise the CLI's platform default. Never run these destructive fixture experiments against production memories. Remove only the disposable fixtures after inspection.
