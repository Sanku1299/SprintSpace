# SprintSpace --- System Architecture Document

**Draft v0.1 \| Reconstructed from the retained project decisions**

## 1. Architecture overview

Use a **modular monolith** for the core web application. Keep domain
boundaries clear without introducing premature microservices.

## 2. Proposed stack

-   Next.js App Router
-   React and TypeScript
-   Tailwind CSS and shadcn/ui
-   MongoDB with Mongoose
-   Auth.js for authentication/session integration
-   Next.js Route Handlers for REST APIs
-   Zod for validation
-   React Hook Form for forms
-   TanStack Query for server state
-   Zustand only where shared client state is justified
-   dnd-kit for Kanban drag-and-drop
-   Socket.IO for real-time events, hosted as a separately deployable
    service where persistent connections are not supported by the web
    host
-   S3-compatible object storage for file binaries
-   Vitest, React Testing Library and Playwright for testing

Versions and provider-specific configuration must be selected at
implementation time and checked against current compatibility.

## 3. Logical modules

-   Authentication and sessions
-   Workspace and tenant context
-   Users and invitations
-   Authorization/policies
-   Projects and project membership
-   Tasks, subtasks and dependencies
-   Sprints
-   Comments and activity
-   Attachments
-   Notifications
-   Analytics

## 4. Multi-tenant model

Use a shared MongoDB database with shared collections and tenant scoping
through `workspaceId`. Every tenant-owned document must carry a
workspace identifier or be reachable only through a parent resource
whose workspace is verified.

A user belongs to exactly one workspace; therefore `workspaceId` and the
company `role` can live on the user document. A separate many-to-many
workspace-membership collection is not required for the confirmed model.

## 5. Request security flow

For every protected request: 1. Authenticate the user. 2. Resolve the
user's workspace from the trusted session/database context. 3. Load the
requested resource scoped to that workspace. 4. Verify role and
resource-specific permissions. 5. Validate request input. 6. Execute the
operation. 7. Return only authorized data.

Never trust client-supplied `workspaceId`, role, creator identity or
permission claims. Do not rely on UI hiding as authorization.

## 6. Authorization boundaries

-   Admin: all resources in their workspace.
-   PM: projects where they are the responsible PM.
-   Developer/Designer: projects where they are project members.
-   Project membership controls project visibility.
-   Task policy separately controls editing.
-   Socket events must be authorized and scoped to workspace/project
    rooms; events are not a substitute for API authorization.

## 7. Data and infrastructure

-   MongoDB Atlas for persistence.
-   Mongoose models and a shared connection utility.
-   S3-compatible object storage for file contents; MongoDB stores
    metadata and ownership references.
-   Separate Socket.IO deployment for persistent real-time connections
    if the selected hosting platform requires it.
-   Vercel or another compatible host for the Next.js app, subject to
    runtime constraints.

MongoDB transactions require a replica-set-capable deployment. If
registration creates a workspace and Admin user atomically, ensure the
selected MongoDB environment supports transactions.

## 8. Frontend architecture

Use App Router route groups/layouts to separate public/authenticated
areas. Build reusable components for: - Application
shell/sidebar/topbar - Role-aware dashboard widgets - Project
navigation - Task list and Kanban cards - Task details drawer (desktop)
and full-screen view (mobile) - Forms, dialogs, tables, filters and
notifications - Loading, empty, error and success states

Keep access decisions server-enforced. Client-side role-aware rendering
is for UX only.

## 9. Suggested folder structure

``` text
src/
  app/
    (marketing)/
    (auth)/
    (app)/
    api/
  components/
    ui/
    layout/
    projects/
    tasks/
    dashboards/
  features/
    auth/
    workspace/
    users/
    projects/
    tasks/
    sprints/
    collaboration/
    attachments/
    notifications/
    analytics/
  lib/
    auth/
    db/
    validation/
    permissions/
    storage/
  models/
  types/
  hooks/
```

Adapt the structure as the codebase grows; avoid creating empty
abstractions without a use.

## 10. Testing and deployment

Test tenant isolation and permission boundaries at the API/service
layer, not only in UI tests. Include unit, integration and end-to-end
coverage. Deploy the Next.js app, Socket.IO service, database and object
storage configuration independently as required. Keep secrets in
environment variables and never commit them.
