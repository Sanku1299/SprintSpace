# SprintSpace

SprintSpace is a multi-tenant project management and team collaboration app. Product requirements and implementation guidance are in [`docs/`](./docs/).

## Run locally

Install dependencies with `npm install`, then start the development server with `npm run dev`. Open [http://localhost:3000](http://localhost:3000).

The application source is in `src/`. Next.js route groups organize routes without changing their URL paths.

## Environment variables

Copy `.env.example` to `.env.local` when a task introduces environment-backed services. Keep real credentials and connection strings in `.env.local`; it is ignored by Git. Never use the `NEXT_PUBLIC_` prefix for secrets or server-only configuration because prefixed values are exposed to browser code.

The example lists planned MongoDB and authentication variables for later roadmap phases. They are not required to run the current scaffold. Add provider-specific storage variables only after the object-storage provider is selected.
