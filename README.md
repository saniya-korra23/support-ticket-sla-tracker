 Support Ticket & SLA Tracker

A backend application for managing customer support tickets and tracking SLA deadlines.

 Tech Stack

- Bun
- TypeScript
- GraphQL Yoga
- PostgreSQL
- Prisma ORM
- Docker Compose

 Features

- Create support tickets
- List all tickets
- Get a ticket by ID
- Update ticket status
- Ticket priorities: LOW, MEDIUM, HIGH, URGENT
- Automatic SLA deadline calculation
- SLA breach detection
- Resolution timestamp tracking
- Input validation
- PostgreSQL persistence

 SLA Rules

| Priority | SLA |
|---|---:|
| LOW | 72 hours |
| MEDIUM | 48 hours |
| HIGH | 24 hours |
| URGENT | 4 hours |

 Project Structure

```text
support-ticket-sla-tracker/
├── index.ts
├── lib/
│   └── prisma.ts
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── docker-compose.yml
├── prisma.config.ts
├── package.json
├── tsconfig.json
└── .env