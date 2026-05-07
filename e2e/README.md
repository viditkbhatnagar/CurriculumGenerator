# Curriculum Generator — E2E tests

Playwright suite that drives a real Chromium against a deployed instance and verifies the user-visible flows we care about.

## What's covered

- **Faculty admin UI** — invite a faculty member, see them in the list, revoke them.
- **Step 14 (Course Syllabus)** — sidebar nav, form pre-fill from saved inputs, click Generate, preview renders with schedule + outcomes, DOCX export endpoint returns a valid Word file.
- **Step 10 regression** — module list still loads after the Step 14 schema bump, "View Details" still shows the lesson panel.

The Applied AI prompt change isn't covered here because it only surfaces in newly-regenerated lesson plans (15–20 min per module, real OpenAI spend). Verify it manually by clicking Regenerate Module on any unregenerated module.

## Run locally

```bash
cd e2e
npm install
npm run install-browsers   # one-time, ~300MB download
npm test
```

By default this hits `https://curriculum-frontend-xfyx.onrender.com`. Override:

```bash
E2E_FRONTEND_URL=http://localhost:3000 \
E2E_API_URL=http://localhost:4000 \
npm test
```

## CI

`.github/workflows/e2e.yml` runs the suite on a nightly cron (02:00 UTC) and on manual `workflow_dispatch`. We don't run on every push/PR because Render takes 3–7 min to deploy after a push, so push-triggered E2E would test stale code.

To trigger after a deploy:

```bash
gh workflow run e2e.yml
```

## Environment variables

| Var                        | Purpose                                                                                                    | Default                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `E2E_FRONTEND_URL`         | Frontend base URL                                                                                          | `https://curriculum-frontend-xfyx.onrender.com` |
| `E2E_API_URL`              | Backend base URL                                                                                           | `https://curriculum-api-bsac.onrender.com`      |
| `E2E_AUTH_TOKEN`           | Bearer token (for environments where Auth0 is enforced; leave unset against the default mock-admin deploy) | ``                                              |
| `E2E_SYLLABUS_WORKFLOW_ID` | Workflow at `currentStep=13` with `step13` approved                                                        | `69df99d849f3cbb71b41d901` (airline)            |

## Test fixture dependency

The Step 14 + regression tests require a workflow that has reached step 13. They `test.skip()` cleanly if no such workflow exists at the configured ID, so the suite remains green when the fixture rotates — failures should mean _the feature broke_, not _the test data was deleted_.

If the fixture workflow gets deleted, point `E2E_SYLLABUS_WORKFLOW_ID` at any other workflow with `currentStep=13`.

## Reports + traces

After a run:

```bash
npm run report   # opens the HTML report in a browser
```

Failed tests retain a Playwright trace (open with `npx playwright show-trace test-results/.../trace.zip`) and a video. Screenshots are kept for failures only.
