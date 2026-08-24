Implementation Walkthrough — Support Ticket & SLA Tracker
Overview:
I built a full-stack Support Ticket & SLA Tracker using Bun + TypeScript, GraphQL Yoga, Prisma, PostgreSQL, and React + TypeScript.
Architecture:
The backend exposes a GraphQL API through GraphQL Yoga. Prisma is used for database access with PostgreSQL. The React frontend communicates with the GraphQL API for authentication and ticket operations.
Authentication & Authorization:
Users can register and log in using email/password authentication. Authentication is handled using JWT tokens. Role-based authorization is applied to protected ticket operations such as assignment and status updates.
Ticket Workflow:
Users can create tickets with a priority. Agents/admins can assign tickets, update ticket status, and add comments. Status transitions are validated by the backend.
SLA Implementation:
The system calculates separate first-response and resolution SLA deadlines based on ticket priority. SLA calculations use business-hour logic rather than simply adding elapsed clock hours. Ticket timestamps are stored as dates and exposed through the GraphQL API.
Frontend:
The React frontend provides login/registration, ticket creation, ticket listing, priority/status/assignee information, SLA information, and ticket statistics.
Key Decisions:
I kept SLA calculation in the backend so the API remains the source of truth. Prisma was selected to provide type-safe database access, while GraphQL provides a clear API contract between the frontend and backend.
Validation & Error Handling:
The backend validates authentication, ticket fields, email addresses, passwords, assignments, comments, and status transitions. GraphQL errors are displayed by the frontend.
Testing & Future Improvements:
With additional development time, I would expand automated SLA/business-hours test coverage, add cursor-based pagination, richer dashboard APIs, audit logging, notifications, and production deployment/CI.
