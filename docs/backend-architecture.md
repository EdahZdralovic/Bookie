# Backend structure and authentication direction

```text
backend/
  prisma/schema.prisma             Authoritative database models and relationships
  src/
    models/book.model.js           Application-facing book mapping
    repositories/                  Prisma and SQL queries
      book.repository.js
      catalog.repository.js
      statistics.repository.js
    services/book.service.js       Use cases and business rules
    controllers/home.controller.js HTTP request/response handling
    routes/index.js                Route definitions and middleware composition
    exceptions/error.handler.js    Central error and not-found handlers
    middleware/                    Authentication, authorization, CSRF and rate limits
    utils/                         Shared helpers
    config/database.js             Prisma client configuration
    constants/                     Shared constants
    app.js                         Express composition
    server.js                      Startup/shutdown
```

Names use conventional English plural folder names. Request flow is route →
middleware → controller → service → repository → database. Repositories may accept
a Prisma transaction client, so future services can coordinate multiple repositories
within one transaction. Models map application-facing results; they do not duplicate
Prisma's 33 database entity definitions. Add model files only when they have behavior
or data mapping to provide, rather than one empty wrapper per table.

The existing homepage queries live in repositories and its public book mapping in
models. Error handlers live in exceptions, with all user-facing exception messages
in `constants/exceptions.js`.

## Implemented authentication

Email/password registration and login now use JWTs in HttpOnly cookies. JWT sessions
are linked to the existing Session table for expiry/revocation and current account
checks. See [authentication.md](authentication.md) for forms, routes, validation,
configuration, security behavior and tests.

- `controllers/auth.controller.js`: forms, validated requests, cookies and responses.
- `services/auth.service.js`: login, registration transaction, account status and sessions.
- `repositories/user.repository.js`: user persistence.
- `repositories/session.repository.js`: session lookup, creation and revocation.
- `repositories/catalog.repository.js`: active registration lookups.
- `models/user.model.js`: safe authenticated user projection.
- `validators/auth.validator.js`: required fields, password rules and matching, roles and IDs.
- `middleware/authenticate.middleware.js`: verify JWT/session and load the user.
- `middleware/authorize.middleware.js`: authentication and role guards.
- `middleware/csrf.middleware.js`: signed tokens protecting cookie-based mutations.
- `middleware/rate-limit.middleware.js`: login and registration throttling.
- `utils/token.js`: library-based JWT signing/verification and token digests.
- `exceptions/app.exception.js`: typed application exceptions.
- `exceptions/error.handler.js`: centralized HTML/JSON error responses.
- `constants/`: exception text, UI text, HTTP statuses and authentication settings.

Authentication identifies the user. Authorization decides allowed actions. Role
checks do not replace ownership checks, which belong alongside data in the future
book/order/chat services. Public registration cannot create administrators.

External login can be added later through OpenID Connect with provider identity
links and account-linking rules. It is not needed for the implemented JWT login.
