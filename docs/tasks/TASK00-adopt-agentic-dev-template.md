Adopt the development workflow from the sibling repository `../agentic-dev-template` into this existing project.

First inspect both repositories and identify reusable tooling, agent instructions, skills, quality checks, and documentation conventions.

Constraints:
- Preserve the existing application architecture and behavior.
- Preserve pnpm, Vitest, TypeScript, and existing tests.
- Do not copy the template's application fixture, Vite setup, or package.json wholesale.
- Adapt reusable tooling to this repository instead of replacing existing configuration.
- Preserve existing ADRs and documentation.
- Do not change production code unless strictly necessary.
- Do not weaken existing quality checks.
- Do not modify the source template repository.

Before making changes:
1. Propose a minimal migration plan.
2. List files to add, modify, and leave unchanged.
3. Identify conflicts and unnecessary tooling.

Wait for approval before implementing.