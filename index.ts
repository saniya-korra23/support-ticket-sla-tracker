import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { prisma } from "./lib/prisma";
import { createToken, hashPassword, verifyPassword, verifyToken } from "./lib/auth";
import { calculateSlaDueAt } from "./lib/sla";
import type { UserRole, TicketPriority, TicketStatus } from "./generated/prisma/client";

const typeDefs = /* GraphQL */ `
  enum UserRole {
    ADMIN
    AGENT
    CUSTOMER
  }

  enum TicketStatus {
    OPEN
    IN_PROGRESS
    RESOLVED
    CLOSED
  }

  enum TicketPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Comment {
    id: ID!
    body: String!
    createdAt: String!
    author: User!
  }

  type Ticket {
    id: ID!
    title: String!
    description: String!
    status: TicketStatus!
    priority: TicketPriority!
    customerEmail: String!
    reporter: User
    assignee: User
    comments: [Comment!]!
    createdAt: String!
    updatedAt: String!
    dueAt: String!
    resolvedAt: String
    firstResponseAt: String
    firstResponseDueAt: String
    slaBreached: Boolean!
  }

  type TicketConnection {
    items: [Ticket!]!
    total: Int!
    hasNextPage: Boolean!
  }

  type Query {
    tickets(
      page: Int = 1
      pageSize: Int = 10
      status: TicketStatus
      priority: TicketPriority
    ): TicketConnection!

    ticket(id: ID!): Ticket
    me: User
  }

  type Mutation {
    register(
      name: String!
      email: String!
      password: String!
    ): AuthPayload!

    login(
      email: String!
      password: String!
    ): AuthPayload!

    createTicket(
      title: String!
      description: String!
      customerEmail: String!
      priority: TicketPriority!
    ): Ticket!

    assignTicket(
      id: ID!
      assigneeId: ID!
    ): Ticket!

    updateTicketStatus(
      id: ID!
      status: TicketStatus!
    ): Ticket!

    addComment(
      ticketId: ID!
      body: String!
    ): Comment!
  }
`;

const RESOLUTION_SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 4,
};

const FIRST_RESPONSE_SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 24,
  MEDIUM: 8,
  HIGH: 4,
  URGENT: 1,
};

type Context = {
  userId: string | null;
  role: UserRole | null;
};

function getUser(context: Context) {
  if (!context.userId) {
    throw new Error("Authentication required");
  }

  return prisma.user.findUnique({
    where: { id: context.userId },
  });
}

function requireRole(context: Context, roles: UserRole[]) {
  if (!context.userId || !context.role) {
    throw new Error("Authentication required");
  }

  if (!roles.includes(context.role)) {
    throw new Error("Not authorized");
  }
}

function formatComment(comment: {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  };
}

function formatTicket(ticket: {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  dueAt: Date;
  firstResponseDueAt: Date | null;
  resolvedAt: Date | null;
  firstResponseAt: Date | null;
  reporter: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  comments: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }>;
}) {
  return {
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    dueAt: ticket.dueAt.toISOString(),
    firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
    comments: ticket.comments.map(formatComment),
    slaBreached:
      ticket.status !== "RESOLVED" &&
      ticket.status !== "CLOSED" &&
      new Date() > ticket.dueAt,
  };
}

const ticketInclude = {
  reporter: true,
  assignee: true,
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: true },
  },
};

const resolvers = {
  Query: {
    tickets: async (
      _: unknown,
      args: {
        page?: number;
        pageSize?: number;
        status?: TicketStatus;
        priority?: TicketPriority;
      },
      context: Context,
    ) => {
      await getUser(context);

      const page = Math.max(args.page ?? 1, 1);
      const pageSize = Math.min(Math.max(args.pageSize ?? 10, 1), 100);

      const where = {
        ...(args.status ? { status: args.status } : {}),
        ...(args.priority ? { priority: args.priority } : {}),
      };

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          include: ticketInclude,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.ticket.count({ where }),
      ]);

      return {
        items: tickets.map(formatTicket),
        total,
        hasNextPage: page * pageSize < total,
      };
    },

    ticket: async (
      _: unknown,
      args: { id: string },
      context: Context,
    ) => {
      await getUser(context);

      const ticket = await prisma.ticket.findUnique({
        where: { id: args.id },
        include: ticketInclude,
      });

      return ticket ? formatTicket(ticket) : null;
    },

    me: async (_: unknown, __: unknown, context: Context) => {
      return getUser(context);
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      args: { name: string; email: string; password: string },
    ) => {
      if (!args.name.trim()) {
        throw new Error("Name is required");
      }

      if (!args.email.includes("@")) {
        throw new Error("Valid email is required");
      }

      if (args.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const existing = await prisma.user.findUnique({
        where: { email: args.email.toLowerCase().trim() },
      });

      if (existing) {
        throw new Error("Email already registered");
      }

      const passwordHash = await hashPassword(args.password);

      const user = await prisma.user.create({
        data: {
          name: args.name.trim(),
          email: args.email.toLowerCase().trim(),
          passwordHash,
          role: "CUSTOMER",
        },
      });

      return {
        token: createToken(user.id, user.role),
        user,
      };
    },

    login: async (
      _: unknown,
      args: { email: string; password: string },
    ) => {
      const user = await prisma.user.findUnique({
        where: { email: args.email.toLowerCase().trim() },
      });

      if (!user) {
        throw new Error("Invalid email or password");
      }

      const valid = await verifyPassword(args.password, user.passwordHash);

      if (!valid) {
        throw new Error("Invalid email or password");
      }

      return {
        token: createToken(user.id, user.role),
        user,
      };
    },

    createTicket: async (
      _: unknown,
      args: {
        title: string;
        description: string;
        customerEmail: string;
        priority: TicketPriority;
      },
      context: Context,
    ) => {
      const user = await getUser(context);

      if (!user) {
        throw new Error("User not found");
      }

      if (!args.title.trim()) {
        throw new Error("Title is required");
      }

      if (!args.description.trim()) {
        throw new Error("Description is required");
      }

      if (!args.customerEmail.includes("@")) {
        throw new Error("Valid customer email is required");
      }

      const dueAt = calculateSlaDueAt(
        new Date(),
        RESOLUTION_SLA_HOURS[args.priority],
      );

      const firstResponseDueAt = calculateSlaDueAt(
        new Date(),
        FIRST_RESPONSE_SLA_HOURS[args.priority],
      );

      const ticket = await prisma.ticket.create({
        data: {
          title: args.title.trim(),
          description: args.description.trim(),
          customerEmail: args.customerEmail.trim(),
          priority: args.priority,
          dueAt,
          firstResponseDueAt,
          reporterId: user.id,
        },
        include: ticketInclude,
      });

      return formatTicket(ticket);
    },

    assignTicket: async (
      _: unknown,
      args: { id: string; assigneeId: string },
      context: Context,
    ) => {
      requireRole(context, ["ADMIN", "AGENT"]);

      const assignee = await prisma.user.findUnique({
        where: { id: args.assigneeId },
      });

      if (!assignee || (assignee.role !== "AGENT" && assignee.role !== "ADMIN")) {
        throw new Error("Assignee must be an agent or admin");
      }

      const ticket = await prisma.ticket.update({
        where: { id: args.id },
        data: {
          assigneeId: args.assigneeId,
        },
        include: ticketInclude,
      });

      return formatTicket(ticket);
    },

    updateTicketStatus: async (
      _: unknown,
      args: {
        id: string;
        status: TicketStatus;
      },
      context: Context,
    ) => {
      requireRole(context, ["ADMIN", "AGENT"]);

      const existing = await prisma.ticket.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new Error("Ticket not found");
      }

      const allowed: Record<TicketStatus, TicketStatus[]> = {
        OPEN: ["IN_PROGRESS", "CLOSED"],
        IN_PROGRESS: ["RESOLVED", "OPEN"],
        RESOLVED: ["CLOSED", "OPEN"],
        CLOSED: [],
      };

      if (
        args.status !== existing.status &&
        !allowed[existing.status].includes(args.status)
      ) {
        throw new Error("Invalid status transition");
      }

      const ticket = await prisma.ticket.update({
        where: { id: args.id },
        data: {
          status: args.status,
          resolvedAt:
            args.status === "RESOLVED" || args.status === "CLOSED"
              ? new Date()
              : null,
        },
        include: ticketInclude,
      });

      return formatTicket(ticket);
    },

    addComment: async (
      _: unknown,
      args: { ticketId: string; body: string },
      context: Context,
    ) => {
      const user = await getUser(context);

      if (!user) {
        throw new Error("Authentication required");
      }

      if (!args.body.trim()) {
        throw new Error("Comment body is required");
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: args.ticketId },
      });

      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const comment = await prisma.comment.create({
        data: {
          body: args.body.trim(),
          ticketId: args.ticketId,
          authorId: user.id,
        },
        include: {
          author: true,
        },
      });

      if (
        user.role === "AGENT" &&
        !ticket.firstResponseAt
      ) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { firstResponseAt: new Date() },
        });
      }

      return formatComment(comment);
    },
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga<any>({
  schema,
  graphqlEndpoint: "/graphql",
  context: async ({ request }) => {
    const header = request.headers.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      return {
        userId: null,
        role: null,
      };
    }

    try {
      const payload = verifyToken(header.slice(7));

      return {
        userId: payload.userId,
        role: payload.role as UserRole,
      };
    } catch {
      return {
        userId: null,
        role: null,
      };
    }
  },
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log(
    "🚀 Support Ticket SLA Tracker: http://localhost:4000/graphql",
  );
});
