# Agents Guidelines

## Code Style
- Write terse, functional, mutation-free code
- Extract reusable logic into composable functions
- Extract constants into `constants/` files, utils into `utils/` files
- Reuse existing code where possible
- No `any` ever. No `as unknown as Type` casts. Prefer concrete types; use `unknown` only when type is truly unknown
- Leverage Effect modules: `Option`, `Array`, `Record`, etc.
- Consult https://effect.website/llms.txt for Effect questions

## Server (packages/server)
- Handle errors generously — create as many error classes as needed, handle inline
- Never use catchAll, handle all errors individually and manually.
- Handle all errors inline and handle all effect parsing (schema.decode/encode etc) inline without creating any helper functions i.e never use const unauthorized = new Unauthorized({ message: "Unauthorized", cause: null }) this kind of abstraction or any kind of abstraction for error handling at all. Always handle errors directly using catchTag and explictly.
- Never throw raw `Error`; use tagged errors:
- Run typecheck after every task

```ts
export class MyError extends Schema.TaggedError<MyError>("MyError")("MyError", {
  message: Schema.String,
  cause: Schema.Unknown,
}) {}
```

- Use `sqlClient.transaction` for DB transactions (see site repo for pattern)
- Run `pnpm dbmate new <description>` for new migrations
- Avoid `Effect.tryPromise` for DB queries; use ORM client APIs directly

## Package Management
- Use `pnpm` only. Never `npm` or `yarn`

## Exports
- Never use `export * from "./module"`
- Always use explicit named exports

## Frontend (packages/admin)

### React Patterns
- Never use `useEffect`
- Use `useMemo` for derived state
- Handle side effects in event handlers, not during render
- Wrapper components fetch data → pass as props to presentation components
- Handle loading states in wrappers, not presentation components
- Use `React.memo` for expensive dumb components

### Directory Structure
- `src/components/`: Dumb, reusable, props-only. No business logic
- `src/components/ui/`: shadcn/ui components
- `src/containers/`: Smart components with business logic and state
  - Containers must be named `FooBarContainer` (and file should be `FooBarContainer.tsx`)
  - Can have own `components/` subdirectory for container-specific components
- `src/layouts/`: Page layouts and layout-specific components
- `src/constants/`, `src/utils/`, `src/hooks/`, `src/lib/`

### Component Rules
**Dumb (`src/components/`)**: Pure functions, no API calls, no state, typed props, follow theme variables
**Smart (`src/containers/`)**: Business logic, state, data fetching, orchestrate interactions

## General Rules
- Never delete/remove unstaged work not part of your task — ask first
- Never run destructive git operations unless explicitly asked

# Extra
- Oracle bundles a prompt plus the right files so another AI (GPT 5 Pro + more) can answer. Use when stuck/bugs/reviewing.
- Run `npx -y @steipete/oracle --help` once per session before first use.

## Flow & Runtime
- Use repo's package manager/runtime; no swaps w/o approval.
- Use Codex background for long jobs; tmux only for interactive/persistent (debugger/server).

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Projects`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Commit helper on PATH: `committer` (bash). Prefer it; if repo has `./scripts/committer`, use that.
- Don't delete/rename unexpected stuff; stop + ask.
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; if Git auto-stashes during pull/rebase, that's fine (hint, not hard guardrail).
- If user types a command ("pull and push"), that's consent for that command.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent: check `git status/diff` before edits; ship small commits.

### Commit Messages
- Use Conventional Commits (`fix:`, `feat:`, `chore:`, `refactor:`, `fix(ci):`, etc.)
- Subject line: short, user-facing impact (not implementation detail)
- Body: 2 lines explaining behavior change + why it matters for users/business

Example:
```text
fix: keep Service Request 'Added By' tied to the creator

Service Requests now persist immutable creator metadata (createdById/createdByName) at creation time and never mutate it on update. This restores legacy auditing semantics so "Added By" does not change when a request is edited or re-opened.
```

Example:
```text
fix(admin): allow clearing Service Request optional fields on edit

Editing a Service Request now sends explicit nulls for cleared fields (onSiteContactNotes, contactNumber, closedAt, siteVisitWindow) so updates persist correctly. This restores the ability to remove stale details and re-open a request without workarounds.
```

## Language/Stack Notes
- Swift: use workspace helper/daemon; validate `swift build` + tests; keep concurrency attrs right.
- TypeScript: use repo PM; run `docs:list`; keep files small; follow existing patterns.

## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.
