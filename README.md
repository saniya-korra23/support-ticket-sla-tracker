# Support Ticket & SLA Tracker

A full-stack support ticket management system with authentication, ticket workflows, assignment, comments, and SLA tracking.

## Tech Stack

- Bun + TypeScript
- GraphQL Yoga
- PostgreSQL
- Prisma ORM
- React + Vite
- Docker Compose
- Luxon
- JWT + bcrypt

## Features

- User registration and login
- Role-based access: CUSTOMER, AGENT, ADMIN
- Create and view support tickets
- Ticket priorities: LOW, MEDIUM, HIGH, URGENT
- Ticket status workflow
- Assign tickets to agents/admins
- Add ticket comments
- First-response SLA tracking
- Resolution SLA tracking
- Business-hours SLA calculation
- Weekend/holiday handling
- SLA breach detection
- Pagination
- Status and priority filtering
- PostgreSQL persistence
- React dashboard

## SLA Rules

| Priority | First Response | Resolution |
|---|---:|---:|
| LOW | 24 hours | 72 hours |
| MEDIUM | 8 hours | 48 hours |
| HIGH | 4 hours | 24 hours |
| URGENT | 1 hour | 4 hours |

Business hours are 09:00–18:00 in the configured business timezone.

## Project Structure

```text
support-ticket-sla-tracker/
├── index.ts
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── sla.ts
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── frontend/
│   └── src/
├── docker-compose.yml
├── prisma.config.ts
├── package.json
├── tsconfig.json
└── .env.example

