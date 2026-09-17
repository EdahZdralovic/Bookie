# Bookie

A college book exchange starter built with Node.js, Express, EJS, Tailwind CSS 3, Prisma, and PostgreSQL.

## Implementation status

The current app implements the homepage, basic catalog search, JWT login, registration,
logout, profile updates, seller book publishing and a protected account page. Most
marketplace workflows still need their services, routes and screens. See [authentication
setup and validation](docs/authentication.md) and [database setup](docs/database.md).

See [the requirements audit and implementation plan](docs/implementation-plan.md)
for folder responsibilities and the backend-first checklist. The PostgreSQL database
foundation is now implemented; [database.md](docs/database.md) records the current
schema and business rules remaining for the service layer.

## Run locally

```bash
cd backend
npm install
npm run auth:setup
npm run db:local:start
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open <http://localhost:3000>, [login](http://localhost:3000/login) or
[registration](http://localhost:3000/register).

Shared document metadata is rendered through `frontend/views/index.ejs`. Add the favicon at
`frontend/public/images/bookie/favicon` and it will be available on every page.

The local database uses PostgreSQL on `127.0.0.1:55432`. See the
[database setup and complete 33-table inventory](docs/database.md) for relationships,
constraints, migrations, demo fixtures and `npm run test:db`. The old SQLite database
is preserved; its schema and migrations are archived in `backend/prisma/legacy-sqlite`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@bookie.ba` | `admin123` |
| Seller | `prodavac@bookie.ba` | `student123` |
| Buyer | `student@bookie.test` | `student123` |

The administrator is created only through `prisma/seed.js`, never through public registration.

## Order email notifications

Order notifications use Resend. Create an API key, verify your sending domain in Resend,
then add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `backend/.env`. For example:

```text
RESEND_FROM_EMAIL="Bookie <orders@mail.your-domain.com>"
```

After checkout, each seller receives the order number, purchased books, total amount, and
the buyer's name and email address. Email delivery runs after the order transaction and a
temporary mail provider failure does not cancel a successful order.

## Database modules

The Prisma schema covers users and sessions, lookup catalogs, books and pickup locations,
buyer interests, carts, orders and exchanges, reviews, chat, notifications, reports,
wishlist alerts, safe pickup points and seller badges.

## Five original features

1. **Environmental impact** — show the estimated number of books reused and the savings from buying used editions.
2. **Smart price suggestion** — suggest a price based on condition, year and similar listings.
3. **Wishlist alerts** — notify users when a requested title, author, ISBN, genre or language appears.
4. **Safe campus pickup points** — administrator-approved libraries, faculties and student residences.
5. **Reliability badges** — seller badges based on ratings, response speed and completed orders.

## Main folders

- `backend/src/controllers` — HTTP request handling
- `backend/src/models` — application-facing data shapes; database models live in Prisma
- `backend/src/services` — business logic and use cases
- `backend/src/repositories` — Prisma and SQL queries
- `backend/src/routes` — application routes
- `backend/src/middleware` — Express middleware
- `backend/src/exceptions` — centralized error and not-found handlers
- `backend/src/config` — database and app configuration
- `backend/prisma` — schema, migrations, and seed data
- `frontend/views/pages` — EJS pages
- `frontend/views/components` — reusable EJS components
- `frontend/src` — Tailwind input, browser utilities, and constants
- `frontend/public` — generated CSS and public JavaScript/assets

## Code formatting

Prettier is configured at the project root. Run `npm run format` from `backend` to format source code, or `npm run format:check` to verify formatting before committing.

See [backend architecture and authentication options](docs/backend-architecture.md)
for layer responsibilities and authentication/authorization placement.
