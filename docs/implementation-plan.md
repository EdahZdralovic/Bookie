# Bookie: requirements audit and implementation order

Reviewed against the supplied 2025/2026 project specification on 2026-09-14.
This is the implementation checklist; existing tables do not imply working features.

**Database setup update:** PostgreSQL, 33 tables, integrity migrations, derived statistics
views, repeatable fixtures and database integration tests are now implemented. See
[database.md](database.md) for the current schema and remaining service rules. The
initial audit findings below describe the pre-setup state; they are retained as context.

**Authentication update:** JWT login, registration, logout, required-field/password
validation, exception constants, account/role guards and responsive EJS pages are now
implemented. See [authentication.md](authentication.md).

## Current state

The app is an Express/EJS starter with a broad Prisma schema, four SQLite
migrations, demo seed data, and a styled homepage. The only application route is
`GET /`. There are no registration, login, authorization, or marketplace mutation
handlers. Homepage links for these features are placeholders.

| Requirement | Existing foundation | Remaining implementation |
| --- | --- | --- |
| Users and account moderation | User role/status, block expiry, archive timestamp | Registration, profile/password editing, admin user list, permanent/15-day blocks, activation and archiving |
| Authentication and authorization | Password hashes and Session table | Login/logout, session cookies, expiry/revocation, account checks, role and ownership checks |
| Catalog and global tags | Genre, Language, City, BookCondition, Tag | Admin CRUD, validation, safe deletion/deactivation of referenced entries |
| Seller books | Book, images, tags, pickup cities | CRUD, image URL/upload handling, status transitions, seller filtering/sorting |
| Buyer interests | Genre/language join tables | Registration input, profile updates, actual personalized recommendations |
| Discovery | Homepage query, text search, three sections | All filters, pagination, selectable sorting, details, public seller profile, accurate popularity |
| Cart and purchases | Cart, CartItem, Order, OrderItem | Cart endpoints, seller grouping, price snapshots, acceptance/rejection/completion/cancellation |
| Exchange | ExchangeOffer and offered books | Buyer-owned exchange inventory, offer validation, reservation of both sides, completion |
| Reviews and seller ratings | Review linked uniquely to an order item | Completed-order eligibility, ratings/comments, own review list, optional 24-hour edits/deletes, aggregates |
| Chat | Conversations, participants, book/order context, messages, last-read timestamp | Conversation list, participant-only messaging, unread counts, buyer/seller/admin conversations |
| Notifications | Notification table | Create on orders/messages/reviews, list and mark read, administrator notices |
| Reports | Report and resolution fields | Submit book/user reports, admin review and resolution |
| Admin statistics | Underlying entities, limited homepage counts | Total users/sellers/buyers/books, active listings, completed purchases/exchanges, books per seller, popular genres; tables and charts |
| Five original features | README ideas; wishlist, pickup point and badge tables | Define measurable rules and implement each feature end to end |
| Frontend and delivery | Homepage and reusable EJS components | Responsive workflows for all roles, errors/empty states, final README and demonstration video |

## Folder responsibilities

Keep the existing backend/frontend split and layer folders. No large move is
needed. Add module files when implementing them; avoid empty scaffolding.

```text
backend/
  prisma/
    schema.prisma         Models, relationships, enums and indexes
    migrations/           Reviewed database changes and data backfills
    seed.js               Repeatable, internally consistent demo data
  src/
    config/               Environment and Prisma client setup
    repositories/         Prisma queries; accept a transaction client when needed
    services/             Business rules, permissions tied to data, transactions
    validators/           Request fields, filters, identifiers and allowed values
    middleware/           Session loading, account/role gates, CSRF, errors
    controllers/          Parse validated requests, invoke services, send responses
    routes/               URLs, HTTP methods and middleware composition
    constants/            Shared domain constants only
    utils/                Small reusable helpers
    app.js                Express composition
    server.js             Startup and shutdown
  tests/                  Database, service and HTTP integration tests
frontend/
  views/pages/            EJS pages, later grouped by workflow/role
  views/components/       Shared EJS partials
  src/styles/             Tailwind source
  src/constants/         Browser constants
  src/utils/             Browser helpers
  public/css/             Generated stylesheet
  public/js/              Browser entry scripts
docs/
  implementation-plan.md  Requirements, findings and phase checklist
```

Request flow: route → middleware/validation → controller → service → repository
→ Prisma. Controllers own HTTP responses; repositories own persistence; services
own multi-record business transactions. EJS pages can use the same services as
JSON endpoints without making internal HTTP calls.

The existing `book.service.js` combines queries, recommendations, and presentation
conversion. Split it when implementing catalog queries. `constants/book.js` uses
condition strings that differ from the lookup catalog and currently has no
consumer; replace this duplication with lookup IDs. Browser utilities/constants
are also currently unconnected to the public entry script.

## Phase 1 — database correctness

- [ ] Settle the database provider before new migrations. The project currently
  uses SQLite; the supplied specification explicitly permits PostgreSQL but does
  not explicitly mention SQLite. PostgreSQL is the proposed target for alignment.
  Preserve the existing database and migration history during a provider transition;
  do not reset data or merely change the provider on SQLite SQL migrations.
- [ ] Remove legacy `STUDENT` and `AVAILABLE` after an explicit data mapping.
  Retain ADMIN, SELLER, BUYER and the specified listing states.
- [ ] Require first/last names and decide whether `name` remains a derived display
  field. Backfill existing records before tightening constraints.
- [ ] Require the specified listing information, including genre, language,
  condition, publisher, publication year and description. Define photo and pickup
  location requirements. Replace `legacyCondition` after backfilling lookup IDs.
  Referenced mandatory lookups should be restricted from deletion or deactivated.
- [ ] Define exact money storage and validation: nonnegative amounts, consistent
  two-decimal precision, zero price only for exchange-only listings, immutable
  order item prices and server-calculated totals.
- [ ] Add database checks where possible for rating 1–5, nonnegative counters,
  valid states, buyer different from seller, and report target consistency.
  Cross-row rules still need service validation inside transactions.
- [ ] Specify account invariants: BLOCKED with no expiry means permanent;
  temporary block lasts 15 days; expired blocks restore access consistently;
  inactive/archived users cannot transact. Decide whether blocked users can access
  a restricted admin-support conversation, since the brief mentions block problems.
- [ ] Resolve buyer exchange inventory. Proposed rule: a BUYER can manage their
  own exchange-only books; SELLER enables priced listing management. Ownership
  checks must support the brief's buyer-owned offered books.
- [ ] Treat each Book as a single physical listing for the initial implementation.
  Reserve all requested and offered books atomically on acceptance; completed
  books become SOLD/EXCHANGED. A relisting creates a new listing, preserving history.
  If popularity must aggregate across copies/editions, introduce a separate title
  entity before query implementation; the current schema does not do that.
- [ ] Preserve completed order/review history: archive users/listings through
  application workflows and review cascade deletion behavior before adding deletes.
- [ ] Make review buyer/book agree with the linked order item and order buyer.
  Calculate cached ratings/counts from actual completed orders and reviews, updating
  them transactionally or derive them in queries.
- [ ] Store a digest of session tokens, define expiry and revocation, and never
  include credentials/session data in public query projections.
- [ ] Connect campus pickup points to the intended selection workflow, e.g. an
  optional selected pickup point on an order. The current table is isolated.
- [ ] Correct seed data. Eight current listings have rating aggregates inconsistent
  with reviews; one completed order references a still-ACTIVE book. Avoid resetting
  passwords, reactivating moderated accounts or deleting unrelated notifications
  when rerunning seed data. ISBN is not a unique listing identifier: multiple users
  can own the same edition, so seed upserts need a stable demo-specific identity.
- [ ] Verify a fresh migration, existing-data migration, foreign keys, constraints,
  and repeatable seed data before marking this phase complete.

## Phase 2 — repositories and core services

- [ ] Add public-safe book/user projections. Currently `bookInclude.owner` fetches
  the entire user, including passwordHash; it is not currently serialized as JSON,
  but must be narrowed before reuse in APIs.
- [ ] Implement paginated catalog filters: title, author, genre, language, seller
  city, price range, exchange eligibility and new/like-new condition.
- [ ] Implement seller status filters and price/date/title sorting; public
  popularity/date/price sorting; details and public seller summary.
- [ ] Exclude listings of unavailable accounts from discovery and transactions.
- [ ] Replace hard-coded recommendation genres with the current user's saved
  genres/languages and a documented guest fallback.
- [ ] Replace random comparator sorting with unbiased sampling. Avoid loading the
  entire catalog for every homepage request. Separate search-result pagination
  from homepage sections (search currently returns at most four popular cards).
- [ ] Define popularity from both average rating and completed orders; ensure
  displayed values come from consistent data. Seller ratings aggregate eligible
  reviews across that seller's listings.
- [ ] Implement profile/interests and admin lookup/user services.

## Phase 3 — authentication and authorization

- [ ] Registration accepts first/last name, email, password, permitted role and
  optional interests; normalize emails consistently. Public registration never
  accepts ADMIN. Administrator provisioning remains database/seed-only.
- [ ] Login verifies password and account state, issues a random expiring session,
  and uses HttpOnly, SameSite cookies with Secure in HTTPS deployments.
- [ ] Logout revokes the session; password changes verify the old password and
  revoke existing sessions. Add login throttling and CSRF protection for mutations.
- [ ] Every protected request validates the session and current account state.
  Apply role gates and resource ownership/participation checks independently.
- [ ] Test anonymous access, wrong roles, another user's resource IDs, expired
  sessions, permanent/temporary blocks and archiving.

## Phase 4 — transactional workflows, controllers and APIs

Implement modules in order: auth/profile → catalog/books → cart/orders/exchanges
→ reviews → chat/notifications → reports/admin/statistics → original features.
Each module includes validators, repository/service methods, controllers, routes,
and focused integration checks before the UI consumes it.

- [ ] Cart permits available books from multiple sellers, but checkout groups them
  into separate orders; one order contains only one seller's books and no self-buy.
- [ ] PENDING → ACCEPTED/REJECTED; buyer may cancel only PENDING; seller may complete
  only ACCEPTED. Reject invalid/repeated transitions without duplicate side effects.
- [ ] Recheck ownership, availability, exchange flags and prices inside transactions.
  Competing acceptances must not reserve the same physical book. Resolve competing
  pending offers consistently when a listing becomes unavailable.
- [ ] Completion updates all involved listings, order timestamps, counts and
  notifications atomically. Include offered books for exchanges.
- [ ] Reviews require the buyer's completed order item, one review per item;
  optionally permit author edits/deletes for 24 hours and refresh aggregates.
- [ ] Chat validates participants, sender identity and book/order context; support
  buyer–seller, buyer–admin and seller–admin conversations and unread indicators.
- [ ] Add notification list/read actions, report submission/resolution, administrator
  messages and all specified statistics.
- [ ] Use consistent validation/not-found/forbidden/conflict responses. The current
  error middleware renders every application error as a generic HTTP 500 page.
- [ ] Test order races, rollback, unauthorized access, review eligibility, and
  conversation privacy. Document routes and payloads once implemented.

## Phase 5 — original features

The five README items are proposed features, not completed functionality:

1. Ecological impact: count reused books from completed transactions and clearly
   label any environmental conversion as an estimate with a documented basis.
2. Price suggestion: define a transparent condition/year/comparable-listing rule,
   including the fallback when no comparable listings exist.
3. Wishlist alerts: implement matching when listings become active and prevent
   repeated alerts for the same listing/user match.
4. Campus pickup points: admin maintenance and user selection within transactions.
5. Seller badges: define thresholds, calculate from real reviews/completions and
   response times, and specify when badges are awarded or removed.

## Phase 6 — EJS frontend and submission

Build responsive registration/login, profile/interests, discovery/details/seller
profile, seller listing management, cart/checkout/exchange, order history, reviews,
chat/unread notifications, reports and admin screens. Include tabular and graphical
statistics, validation feedback, empty states and forbidden/not-found pages.

Run end-to-end buyer/seller/admin scenarios, document setup and the five additions,
then prepare the demonstration video and submission links required by the course.

## Audit verification

- Prisma schema validation passed on 2026-09-14.
- Read-only SQLite integrity check returned `ok`; foreign-key check found no violations.
- All four recorded migrations have completion timestamps.
- Actual demo roles: one admin, one buyer, two sellers; listing states: eight ACTIVE,
  two ARCHIVED. Legacy enum values remain in the schema even though unused here.
- These checks verify schema structure and current database integrity, not business
  correctness. No schema, seed, application behavior or database rows were changed
  during this audit.
