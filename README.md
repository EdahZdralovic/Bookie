# Bookie

Bookie is a web application for buying, selling and exchanging used books. It was made by Edah Ždralović for the course *Selected Topics in Computer Science*.

Project defense date: 18 September 2026

## Features

- Registration, email verification and JWT login
- Seller and buyer profiles with interests and profile pictures
- Book listings with images, search, filters and sorting
- Cart, orders and exchange offers
- Reviews, comments, chat and notifications
- Reports and administration tools
- Marketplace statistics with charts

## Technologies

- Node.js and Express
- EJS and Tailwind CSS
- PostgreSQL and Prisma ORM
- Resend for email notifications

## Running locally

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

Open http://localhost:3000 in your browser.

Create `backend/.env` from `backend/.env.example` and set `DATABASE_URL`, `JWT_SECRET`, and the Resend values if email sending is needed.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@bookie.ba | admin123 |
| Seller | prodavac@bookie.ba | student123 |
| Buyer | student@bookie.test | student123 |

The administrator account is created by the database seed and cannot be registered through the application.

## Useful commands

```bash
npm run db:studio       # open Prisma Studio
npm run test:db         # run database and workflow tests
npm run test:browser    # run browser checks
npm run format          # format the code
```

The GitHub repository contains the complete source code, migrations and seed data.
