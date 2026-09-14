# Request middleware

Authentication and authorization middleware:

- `authenticate.middleware.js`: verify the session/token and load the current user.
- `authorize.middleware.js`: require authentication, allowed roles and account state.
- `csrf.middleware.js`: protect cookie-authenticated mutations.
- `rate-limit.middleware.js`: throttle login and registration attempts.

These modules are implemented. Resource ownership and conversation
membership checks belong in services alongside the data they protect. Password
verification/login orchestration belongs in `services/auth.service.js`; user/session
queries belong in repositories. Token/cookie helpers can live in `utils/`.

Global error and not-found handlers live in `../exceptions/error.handler.js`.
