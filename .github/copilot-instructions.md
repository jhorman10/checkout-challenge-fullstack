# Copilot Workspace Instructions

This workspace is configured to use Gentle-orchestrator as the coordinating agent.

## Primary role

Use Gentle-orchestrator patterns for planning, delegation, and verification:

- orchestrate rather than directly patch broad areas,
- delegate exploration and implementation when context or scope grows,
- keep the conversation focused on decisions and evidence,
- use the SDD flow for meaningful changes,
- verify before completion.

## Context sources

- Project skill registry: `.atl/skill-registry.md`
- Project agent rules: `AGENTS.md`

## Expectations

- Prefer narrow reads and targeted actions.
- If work covers multiple files or phases, break it into reviewable units.
- Document any non-obvious decision, bug fix, architecture choice, or pattern in memory.
- Keep artifacts and inline code comments in English by default.

## Verification

Do not claim a fix is complete without fresh validation output from the relevant tests, build, or checks.
