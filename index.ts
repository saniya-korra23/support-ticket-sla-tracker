import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { prisma } from "./lib/prisma";

const typeDefs = /* GraphQL */ `
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

  type Ticket {
    id: ID!
    title: String!
    description: String!
    status: TicketStatus!
    priority: TicketPriority!
    customerEmail: String!
    createdAt: String!
    updatedAt: String!
    dueAt: String!
    resolvedAt: String
    slaBreached: Boolean!
  }

  type Query {
    tickets: [Ticket!]!
    ticket(id: ID!): Ticket
  }

  type Mutation {
    createTicket(
      title: String!
      description: String!
      customerEmail: String!
      priority: TicketPriority!
    ): Ticket!

    updateTicketStatus(
      id: ID!
      status: TicketStatus!
    ): Ticket!
  }
`;

const SLA_HOURS = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 4,
};

function formatTicket(ticket: any) {
  return {
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    dueAt: ticket.dueAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    slaBreached:
      ticket.status !== "RESOLVED" &&
      ticket.status !== "CLOSED" &&
      new Date() > ticket.dueAt,
  };
}

const resolvers = {
  Query: {
    tickets: async () => {
      const tickets = await prisma.ticket.findMany({
        orderBy: { createdAt: "desc" },
      });

      return tickets.map(formatTicket);
    },

    ticket: async (_: unknown, args: { id: string }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: args.id },
      });

      return ticket ? formatTicket(ticket) : null;
    },
  },

  Mutation: {
    createTicket: async (
      _: unknown,
      args: {
        title: string;
        description: string;
        customerEmail: string;
        priority: keyof typeof SLA_HOURS;
      },
    ) => {
      if (!args.title.trim()) {
        throw new Error("Title is required");
      }

      if (!args.description.trim()) {
        throw new Error("Description is required");
      }

      if (!args.customerEmail.includes("@")) {
        throw new Error("Valid customer email is required");
      }

      const dueAt = new Date(
        Date.now() + SLA_HOURS[args.priority] * 60 * 60 * 1000,
      );

      const ticket = await prisma.ticket.create({
        data: {
          title: args.title.trim(),
          description: args.description.trim(),
          customerEmail: args.customerEmail.trim(),
          priority: args.priority,
          dueAt,
        },
      });

      return formatTicket(ticket);
    },

    updateTicketStatus: async (
      _: unknown,
      args: {
        id: string;
        status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      },
    ) => {
      const ticket = await prisma.ticket.update({
        where: { id: args.id },
        data: {
          status: args.status,
          resolvedAt:
            args.status === "RESOLVED" || args.status === "CLOSED"
              ? new Date()
              : null,
        },
      });

      return formatTicket(ticket);
    },
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("🚀 Support Ticket SLA Tracker: http://localhost:4000/graphql");
});