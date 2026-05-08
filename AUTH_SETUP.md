# Auth0 setup — turning on real faculty logins

When the env vars below are unset (today's state on Render), the app stays in
"mock-admin" mode: every request is treated as the same anonymous administrator
and the curl/Playwright test path keeps working. To switch on real faculty
logins, do the following.

## 1. Create the Auth0 application + API

1. Sign up at <https://auth0.com> (free tier covers ≤7,500 monthly active users).
2. **Create an Application**
   - Type: **Single Page Application**
   - Name: e.g. `Curriculum Generator (Production)`
3. In Application → **Settings**, set:
   - **Allowed Callback URLs**:
     `https://curriculum-frontend-xfyx.onrender.com, http://localhost:3000`
   - **Allowed Logout URLs**: same list
   - **Allowed Web Origins**: same list
   - Save changes.
4. **Create an API**
   - Applications → APIs → Create API
   - Name: `Curriculum Generator API`
   - Identifier (audience): a URL that doesn't have to resolve, e.g.
     `https://api.curriculum.agi-academy.com`
   - Signing algorithm: RS256
   - Save.
5. From these you'll need:
   - `AUTH0_DOMAIN` — e.g. `agi-academy.us.auth0.com` (top of the Application settings)
   - `AUTH0_CLIENT_ID` — Application → Settings → Client ID
   - `AUTH0_AUDIENCE` — the API identifier you set in step 4

## 2. Set env vars on Render

### Backend service (`curriculum-api-bsac`)

| Var                          | Value                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| `AUTH0_DOMAIN`               | the domain from step 5                                        |
| `AUTH0_AUDIENCE`             | the API identifier from step 5                                |
| `FACULTY_ALLOWLIST_ENFORCED` | `true` (rejects logins from emails that haven't been invited) |

### Frontend service (`curriculum-frontend-xfyx`)

| Var                           | Value              |
| ----------------------------- | ------------------ |
| `NEXT_PUBLIC_AUTH0_DOMAIN`    | the domain         |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | the Client ID      |
| `NEXT_PUBLIC_AUTH0_AUDIENCE`  | the API identifier |

After saving, Render will redeploy each service. The frontend now shows a
**Sign in** screen on every protected route; the backend rejects requests
without a valid bearer token.

## 3. Invite faculty

Go to <https://curriculum-frontend-xfyx.onrender.com/admin/faculty> (signed in
as administrator) and use the form to invite each faculty member by email.
Each invitee gets a record with role=faculty + a `pending:<email>`
placeholder; the placeholder is promoted to their real Auth0 sub on first
login.

## 4. First-time signup flow for faculty

By default the Auth0 SPA application uses Auth0's hosted Universal Login
page. Faculty should:

1. Click **Sign in** on the curriculum app.
2. On the Auth0 page, choose **Sign up** (or use a social login if you've
   enabled one in Auth0 → Authentication → Social).
3. Use the email exactly as entered in the Faculty Management page.
4. After signup, they're redirected back; their record is auto-promoted and
   they land on `/workflow`.

## 5. Sanity checks after enabling

```bash
# 1. The frontend root should show a "Sign in" page (no longer the workflow list)
curl -s -o /dev/null -w "%{http_code}\n" https://curriculum-frontend-xfyx.onrender.com/
# Expect: 200 (HTML for the login screen)

# 2. The backend should reject unauthenticated calls
curl -s -o /dev/null -w "%{http_code}\n" https://curriculum-api-bsac.onrender.com/api/v3/workflow
# Expect: 401

# 3. With FACULTY_ALLOWLIST_ENFORCED=true, a non-invited email gets rejected
#    on first login. Confirm by signing in with a fresh email — the page
#    should show a "not invited" error.
```

## 6. Reverting

If anything breaks and you need the old behaviour back:

1. **Remove or unset** the four `*_AUTH0_*` env vars on the frontend service.
2. **Remove or unset** `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` on the backend.
3. Render redeploys; both services fall back to mock-admin mode automatically.

This is the same fallback the dev environment uses, so the path is
well-tested.

## 7. Updating the E2E suite for the live environment

The Playwright suite in `e2e/` runs against the deployed app. Once Auth0 is
on, the unauthenticated tests will need a bearer token — set
`E2E_AUTH_TOKEN` to a valid Auth0 access token (from a test account
invited via the admin page) when invoking the workflow.

```bash
gh workflow run e2e.yml -f e2e_auth_token=<token>
```

(That input doesn't yet exist on the workflow file — add it to
`.github/workflows/e2e.yml` when you flip the switch.)
