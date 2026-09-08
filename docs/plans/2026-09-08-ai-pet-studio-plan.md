# AI Pet Studio implementation plan

## Step 1: Provider and durable avatar

- Output: validated generation request, OpenAI provider adapter, atomic PNG and
  metadata store, and focused tests.
- Test: mocked provider calls, invalid response rejection, save/reload/reset.

## Step 2: Authenticated host routes

- Output: status, avatar, generation, reset, and demo-state routes registered
  through DSH Connection; credential resolution and concurrency lock.
- Test: host helpers and full package syntax checks.

## Step 3: Studio interface

- Output: in-app modal with name, prompt, style, preview states, progress,
  missing-key guidance, generate, and restore-default actions.
- Test: DSH Web visual inspection and interaction checks.

## Step 4: Publication artifact

- Output: versioned documentation and a new installable `.tgz`.
- Test: complete test suite, `npm pack`, offline unpack verification.

