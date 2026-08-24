import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:4000/graphql";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  customerEmail: string;
  dueAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  assignee?: User | null;
};

async function gql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("support_token") || "",
  );

  const [user, setUser] = useState<User | null>(null);
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  async function loadUser(currentToken: string) {
    const data = await gql(
      `
        query {
          me {
            id
            name
            email
            role
          }
        }
      `,
      undefined,
      currentToken,
    );

    setUser(data.me);
  }

  async function loadTickets(currentToken = token) {
    if (!currentToken) return;

    try {
      setLoading(true);
      setError("");

      const data = await gql(
        `
          query {
            tickets {
              total
              items {
                id
                title
                description
                status
                priority
                customerEmail
                dueAt
                firstResponseAt
                resolvedAt
                assignee {
                  id
                  name
                  email
                  role
                }
              }
            }
          }
        `,
        undefined,
        currentToken,
      );

      setTickets(data.tickets.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    loadUser(token)
      .then(() => loadTickets(token))
      .catch(() => {
        localStorage.removeItem("support_token");
        setToken("");
        setUser(null);
        setError("Session expired. Please login again.");
      });
  }, [token]);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();

    try {
      setError("");

      const mutation = isRegister
        ? `
          mutation Register(
            $name: String!
            $email: String!
            $password: String!
          ) {
            register(
              name: $name
              email: $email
              password: $password
            ) {
              token
              user {
                id
                name
                email
                role
              }
            }
          }
        `
        : `
          mutation Login(
            $email: String!
            $password: String!
          ) {
            login(
              email: $email
              password: $password
            ) {
              token
              user {
                id
                name
                email
                role
              }
            }
          }
        `;

      const variables = isRegister
        ? { name, email, password }
        : { email, password };

      const data = await gql(mutation, variables);

      const auth = isRegister ? data.register : data.login;

      localStorage.setItem("support_token", auth.token);
      setToken(auth.token);
      setUser(auth.user);

      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  function logout() {
    localStorage.removeItem("support_token");
    setToken("");
    setUser(null);
    setTickets([]);
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();

    try {
      setError("");

      await gql(
        `
          mutation CreateTicket(
            $title: String!
            $description: String!
            $customerEmail: String!
            $priority: TicketPriority!
          ) {
            createTicket(
              title: $title
              description: $description
              customerEmail: $customerEmail
              priority: $priority
            ) {
              id
              title
            }
          }
        `,
        {
          title,
          description,
          customerEmail,
          priority,
        },
        token,
      );

      setTitle("");
      setDescription("");
      setCustomerEmail("");
      setPriority("MEDIUM");

      await loadTickets(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create ticket");
    }
  }

  if (!token || !user) {
    return (
      <main>
        <section className="card auth-card">
          <h1>Support Ticket &amp; SLA Tracker</h1>
          <p>Manage support tickets and monitor SLA performance.</p>

          {error && <div className="error">{error}</div>}

          <h2>{isRegister ? "Create Account" : "Login"}</h2>

          <form onSubmit={authenticate}>
            {isRegister && (
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}

            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              required
              type="password"
              placeholder="Password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button type="submit">
              {isRegister ? "Create Account" : "Login"}
            </button>
          </form>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister
              ? "Already have an account? Login"
              : "New user? Create account"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <div>
          <h1>Support Ticket &amp; SLA Tracker</h1>
          <p>Manage support tickets and monitor SLA performance.</p>
          <small>
            Logged in as <b>{user.name}</b> ({user.role})
          </small>
        </div>

        <div>
          <button type="button" onClick={() => loadTickets(token)}>
            Refresh
          </button>
          <button type="button" className="secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats">
        <div className="stat">
          <strong>{tickets.length}</strong>
          <span>Total Tickets</span>
        </div>

        <div className="stat">
          <strong>{tickets.filter((t) => t.status === "OPEN").length}</strong>
          <span>Open</span>
        </div>

        <div className="stat">
          <strong>
            {tickets.filter((t) => t.status === "IN_PROGRESS").length}
          </strong>
          <span>In Progress</span>
        </div>

        <div className="stat">
          <strong>
            {tickets.filter((t) => t.status === "RESOLVED").length}
          </strong>
          <span>Resolved</span>
        </div>
      </section>

      <section className="card">
        <h2>Create Ticket</h2>

        <form onSubmit={createTicket}>
          <input
            required
            placeholder="Ticket title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <textarea
            required
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <input
            required
            type="email"
            placeholder="Customer email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
          />

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>

          <button type="submit">Create Ticket</button>
        </form>
      </section>

      <section className="card">
        <h2>Tickets</h2>

        {loading ? (
          <p>Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p>No tickets found.</p>
        ) : (
          <div className="ticket-grid">
            {tickets.map((ticket) => (
              <article className="ticket" key={ticket.id}>
                <div className="ticket-top">
                  <h3>{ticket.title}</h3>

                  <span className="priority">{ticket.priority}</span>
                </div>

                <p>{ticket.description}</p>

                <div className="details">
                  <p>
                    <b>Status:</b> {ticket.status}
                  </p>

                  <p>
                    <b>Customer:</b> {ticket.customerEmail}
                  </p>

                  <p>
                    <b>Assignee:</b>{" "}
                    {ticket.assignee?.name ?? "Unassigned"}
                  </p>

                  <p>
                    <b>Resolution SLA:</b>{" "}
                    {new Date(ticket.dueAt).toLocaleString()}
                  </p>

                  <p>
                    <b>First response:</b>{" "}
                    {ticket.firstResponseAt
                      ? new Date(ticket.firstResponseAt).toLocaleString()
                      : "Pending"}
                  </p>

                  <p>
                    <b>Resolved:</b>{" "}
                    {ticket.resolvedAt
                      ? new Date(ticket.resolvedAt).toLocaleString()
                      : "Not resolved"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
