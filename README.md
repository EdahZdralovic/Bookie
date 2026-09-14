# Bookie

A college book exchange starter built with Node.js, Express, EJS, Tailwind CSS 3, Prisma, and PostgreSQL.

## Implementation status

The current app implements the homepage, basic catalog search, JWT login, registration,
logout and a protected account page. Most marketplace workflows still need their
services, routes and screens. See [authentication setup and validation](docs/authentication.md).

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

The local database uses PostgreSQL on `127.0.0.1:55432`. See the
[database setup and complete 33-table inventory](docs/database.md) for relationships,
constraints, migrations, demo fixtures and `npm run test:db`. The old SQLite database
is preserved; its schema and migrations are archived in `backend/prisma/legacy-sqlite`.

## Demo nalozi

| Uloga | Email | Lozinka |
|---|---|---|
| Administrator | `admin@bookie.ba` | `admin123` |
| Prodavač | `prodavac@bookie.ba` | `student123` |
| Kupac | `student@bookie.test` | `student123` |

Administrator se kreira isključivo kroz `prisma/seed.js`, a ne kroz javnu registraciju.

## Moduli baze

Prisma shema pokriva korisnike i sesije, lookup katalog, knjige i lokacije preuzimanja,
interese kupaca, korpu, narudžbe i razmjene, recenzije, chat, notifikacije, prijave,
wishlist alarme, sigurna pickup mjesta i značke prodavača.

## Pet originalnih specifikacija

1. **Ekološki učinak** — prikaz procijenjenog broja spašenih knjiga i uštede kroz kupovinu polovnih izdanja.
2. **Pametni prijedlog cijene** — prijedlog cijene prema stanju, godini i sličnim oglasima.
3. **Wishlist alarmi** — obavijest kada se pojavi traženi naslov, autor, ISBN, žanr ili jezik.
4. **Sigurna campus pickup mjesta** — administrativno odobrene biblioteke, fakulteti i studentski domovi.
5. **Značke pouzdanosti** — značke prodavača prema ocjenama, brzini odgovora i završenim narudžbama.

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

See [backend architecture and authentication options](docs/backend-architecture.md)
for layer responsibilities and authentication/authorization placement.
