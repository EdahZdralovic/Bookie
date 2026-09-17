# JWT login and registration

Bookie implements local email/password authentication with signed JWT cookies,
PostgreSQL session revocation, EJS login/registration/account pages, and logout.
No OAuth provider is needed. Passwords and JWTs are never returned in JSON or
stored in browser localStorage.

## Setup

From `backend/`:

```sh
npm install
npm run auth:setup
npm run db:local:start
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

`auth:setup` creates `.env` from the example when needed and generates a random
JWT_SECRET without printing it. Existing configured secrets are preserved. A missing,
placeholder or shorter-than-32-character secret prevents startup with a clear
configuration exception. The current workspace is already configured.

Open `/login` or `/register`. A successful login or registration redirects to
`/account`, a protected page with the current user's details. Header navigation
shows the signed-in name and a POST logout form. Existing demo credentials in the
README still work; the stronger password rule applies to new registrations.

Authenticated users can open `/profile` to change their avatar URL and saved genre
and language interests. Only the current user's own profile is loaded or changed.
Active sellers also see `/books/new`, where they can publish a listing. Buyers,
administrators, anonymous users and inactive sellers cannot publish books.

## Registration contract

| Field | Server and browser rule |
| --- | --- |
| firstName, lastName | Required, up to 80 characters, Unicode letters/marks, spaces, period, hyphen or apostrophe |
| email | Required valid email shape, up to 254 characters; trimmed/lowercased; database uniqueness enforced |
| password | Required, at least 8 characters, one uppercase letter and one digit; at most 72 UTF-8 bytes to avoid bcrypt truncation |
| repeatPassword | Required, must exactly match password; not stored |
| role | Explicit BUYER or SELLER selection; ADMIN rejected |
| cityId | Required active city |
| genreIds | At least one active genre, maximum 50 submitted IDs |
| languageIds | At least one active language, maximum 50 submitted IDs |

All fields on the registration page are required. The city and interests are
chosen from database lookups. Registration creates the user, interests, cart and
session in a single transaction. Deactivated or missing lookup IDs are rejected.

The browser shows live password requirements, matching feedback, show/hide controls,
a summary and field-specific errors. The server independently validates every
submission. Failed forms preserve safe input and selections, but never password
values. Forms remain functional without JavaScript.

All exception messages live in `backend/src/constants/exceptions.js`. The backend
uses their named constants; the browser receives the same strings through escaped
EJS data attributes. UI copy lives in `constants/auth-text.js`; password/session/role
settings in `constants/auth.js`; HTTP status constants in `constants/http.js`.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | /login | Login form with CSRF token; signed-in users redirect to account |
| POST | /login | Validate credentials and account, issue JWT cookie, redirect to account |
| GET | /register | Registration form with active lookup options and CSRF token |
| POST | /register | Validate and create account/session transactionally, redirect to account |
| GET | /account | Authenticated account page |
| GET | /api/auth/me | Public user projection as JSON; 401/403 when unauthorized |
| POST | /logout | Revoke current token digest, clear auth/CSRF cookies, redirect to login |

POST requests require the CSRF hidden field `_csrf` or `X-CSRF-Token` header,
matching the signed CSRF cookie. API clients must first obtain cookies and a token
from a form page. Selection IDs are submitted as decimal strings (or arrays of
strings for interests). JSON requests receive structured exception responses:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Check the marked fields and try again.",
    "fields": {
      "repeatPassword": "Lozinke se ne podudaraju."
    }
  }
}
```

HTML validation errors render the same form with HTTP 422. Duplicate email uses
409; bad credentials or invalid/expired/revoked login uses 401; blocked/inactive/
archived accounts and CSRF violations use 403. Rate limits return 429 with Retry-After.
Malformed/oversized requests use 400/413, database connection failures 503, and
unexpected errors a generic 500. Unknown emails and incorrect passwords share the
same login message. Account-state detail is revealed only after password verification
or verification of an existing session. Raw exception details are not sent to clients.

## Token and authorization behavior

- JWTs use HS256 with an explicit verification algorithm, issuer and audience.
  Claims contain subject, unique token ID, issuance and expiration, not credentials.
- Lifetime is two hours with no refresh-token mechanism. Expiry requires another login.
- Cookies are HttpOnly, SameSite=Lax and path `/`; production adds Secure and the
  `__Host-` prefix. Use HTTPS in production.
- Session stores only the token's SHA-256 digest, expiry and revocation timestamp.
  Each authenticated request checks the signature, database session and current
  account status. Logout rejects replay immediately.
- Permanent and active temporary blocks, inactivity and archiving deny access and
  revoke existing sessions when encountered. Expired temporary blocks are reactivated
  with a conditional database update. Future admin moderation must also revoke sessions
  when applying a block so a block removed before another request cannot leave a prior
  session valid. The admin moderation workflow remains outside this login feature.
- `authenticate.middleware.js` loads the user. `authorize.middleware.js` provides
  authentication and role guards. Resource ownership checks remain in the future
  book/order/chat services.
- Signed double-submit CSRF tokens are bound to the current auth token and used on
  login, registration and logout. This protects mutations even though cookies attach
  automatically.
- Login allows 10 failed attempts per IP per 15 minutes; registration allows 5
  attempts per IP per 15 minutes. The simple limiter is process-local. A multi-process
  deployment needs a shared limiter store and explicit trusted-proxy configuration.
- Passwords use bcrypt with 12 rounds. Invalid-account login runs a dummy hash
  comparison. Request bodies are capped at 16 KB. Auth responses are not cached.

## Verification

```sh
npm run test:db
npm run test:browser
```

The integration suite creates and removes its own temporary PostgreSQL database.
It covers model integrity plus required fields, weak/mismatched passwords, invalid
roles/lookups, duplicate email, hash/session persistence, cookie flags, JWT expiry/
tampering/audience, logout replay, account moderation, CSRF, throttling and exception
mapping. The browser suite uses installed Google Chrome and a separate temporary
application/database. It exercises actual registration, login, logout, client/server
errors, password toggles, JavaScript-free login and mobile layouts. Screenshots are
saved under ignored `backend/.local/screenshots/`.

A nonbreaking npm audit fix was applied. npm still reports the existing
`prisma → @prisma/config → deepmerge-ts` recursive-merge advisory. The proposed
automatic fix downgrades Prisma outside the supported project range and was not
forced. This is a tooling dependency issue to resolve separately from JWT behavior.

References: [jsonwebtoken options](https://github.com/auth0/node-jsonwebtoken),
[OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
