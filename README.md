# SprintSpace

SprintSpace is a multi-tenant project management and team collaboration app. Product requirements and implementation guidance are in [`docs/`](./docs/).

## Run locally

Install dependencies with `npm install`, then start the development server with `npm run dev`. Open [http://localhost:3000](http://localhost:3000).

The application source is in `src/`. Next.js route groups organize routes without changing their URL paths.

## Environment variables

Set the variables documented in `.env.example` in the server environment. Keep
real credentials in `.env.local` for development and in the deployment
provider's encrypted environment-variable settings for production. Never use
the `NEXT_PUBLIC_` prefix for secrets or server-only configuration.

Required production settings:

- `MONGODB_URI`: production MongoDB connection string. Use a replica-set-capable
  Atlas deployment because workspace registration uses a transaction. Restrict
  database network access and use a dedicated application database user.
- `AUTH_SECRET`: generate a unique production secret; do not reuse development
  values.
- `AUTH_URL`: the canonical HTTPS origin of the deployed app when required by
  the hosting environment.
- `OBJECT_STORAGE_BUCKET` and `OBJECT_STORAGE_REGION`: required to enable file
  attachments. Keep the bucket private and configure CORS for the deployed app
  origin. For an S3-compatible provider, set its HTTPS endpoint and paired
  access credentials.

## Deploying to Vercel

1. Import the repository into Vercel and select the `dev` branch for preview
   deployments. Use the standard Next.js build command, `npm run build`.
2. Add the production environment variables above in Vercel's project settings.
   Keep Preview and Production credentials separate, and use least-privilege
   MongoDB and object-storage credentials.
3. Deploy a preview first. Check `/api/health/db`, then create a workspace and
   verify sign-in, project access, and attachment upload/download using test
   accounts and non-production storage.
4. Configure the production domain, HTTPS, alerts, and database backups before
   promoting the deployment. Verify restore procedures and review Vercel logs
   for failed requests after release.

The notification event endpoint uses Vercel WebSockets and polls the database;
this app does not require a separate Socket.IO service. A hosted deployment,
production credentials, object-storage account, monitoring, and backup policy
must be configured in the relevant provider consoles before production release.
