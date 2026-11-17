# SprintSpace --- Feature-by-Feature Development Roadmap

**Draft v0.1 \| Reconstructed from the retained project decisions**

## Development method

Work on one task at a time. For each task: 1. Read the relevant
documents. 2. Inspect the current codebase. 3. Explain the plan,
affected files, dependencies, risks and tests. 4. Wait for approval
before substantial changes. 5. Implement only the selected task. 6. Run
type checks, lint, tests and manual verification as applicable. 7.
Summarize changes and unresolved issues. 8. Commit verified work. 9. Do
not start the next task without approval.

## Phase 1 --- Project Scaffolding

-   **1.1** Initialize Next.js App Router with TypeScript, Tailwind,
    ESLint and `src/`.
-   **1.2** Establish the agreed base folder structure.
-   **1.3** Add only the dependencies needed for the current foundation.
-   **1.4** Configure environment variable conventions and example file.
-   **1.5** Configure formatting/lint scripts and Git hygiene.

## Phase 2 --- Database Foundation

-   **2.1** Configure MongoDB Atlas development database.
-   **2.2** Implement Mongoose connection utility with safe connection
    reuse.
-   **2.3** Establish model/schema conventions.
-   **2.4** Add database health check and connection verification.

## Phase 3 --- Authentication

-   **3.1** Implement User and Workspace models.
-   **3.2** Define registration validation and password hashing.
-   **3.3** Implement company registration (workspace + first Admin).
-   **3.4** Configure Auth.js and session strategy.
-   **3.5** Implement login/logout UI and flows.
-   **3.6** Add protected route/layout handling.
-   **3.7** Add authentication tests.

## Phase 4 --- Workspace and Employee Management

-   **4.1** Resolve trusted workspace context.
-   **4.2** Implement workspace details APIs.
-   **4.3** Implement invitation model and creation/resend/revoke.
-   **4.4** Implement invitation acceptance.
-   **4.5** Build employee directory and details.
-   **4.6** Implement role management and employee UI.
-   **4.7** Test invitation and one-workspace constraints.

## Phase 5 --- Authorization and Security

-   **5.1** Authentication/session helper.
-   **5.2** Workspace/tenant authorization helper.
-   **5.3** Company-role authorization helper.
-   **5.4** Project access helper.
-   **5.5** Task edit policy helper with field-level rules.
-   **5.6** Cross-tenant and permission test suite.

## Phase 6 --- Project Management

-   **6.1** Project model and validation.
-   **6.2** Project APIs.
-   **6.3** Role-scoped project listing.
-   **6.4** Project details and update.
-   **6.5** Project membership model and APIs.
-   **6.6** Project creation, overview, members and settings UI.

## Phase 7 --- Task Management

-   **7.1** Task model and validation.
-   **7.2** Task create/retrieve/update APIs.
-   **7.3** Assignment, priority and due dates.
-   **7.4** Subtasks.
-   **7.5** Additional task editors and field-level permissions.
-   **7.6** Task list, My Tasks and Task Details UI.

## Phase 8 --- Kanban Board

-   **8.1** Board layout and workflow statuses.
-   **8.2** Task cards.
-   **8.3** Drag-and-drop using dnd-kit.
-   **8.4** Persist status/position updates securely.
-   **8.5** Search and filters.
-   **8.6** Integrate reusable Task Details drawer/full-screen mobile
    view.

## Phase 9 --- Collaboration

-   **9.1** Comments.
-   **9.2** Mentions.
-   **9.3** Activity history.
-   **9.4** Collaboration UI and authorization tests.

## Phase 10 --- Attachments

-   **10.1** Configure object storage.
-   **10.2** Secure upload flow.
-   **10.3** Attachment metadata model.
-   **10.4** Download and delete authorization.
-   **10.5** File preview and attachment UI.

## Phase 11 --- Notifications and Real-Time

-   **11.1** Notification model and generation rules.
-   **11.2** Notification APIs and UI.
-   **11.3** Deploy Socket.IO service if required by hosting.
-   **11.4** Implement authenticated real-time events.
-   **11.5** Test notification and event tenant isolation.

## Phase 12 --- Dashboards and Analytics

-   **12.1** Admin dashboard API/UI.
-   **12.2** PM dashboard API/UI.
-   **12.3** Developer/Designer dashboard API/UI.
-   **12.4** Workspace and project analytics.
-   **12.5** Verify all metrics are permission-scoped and data-derived.

## Phase 13 --- Testing and QA

-   Unit tests
-   API integration tests
-   End-to-end tests
-   Tenant isolation and authorization tests
-   Responsive/mobile tests
-   Accessibility checks
-   Performance and security review

## Phase 14 --- Production Deployment

-   Production environment configuration
-   Deploy Next.js application
-   Deploy Socket.IO service if used
-   Configure production database and object storage
-   Configure domain, secrets and monitoring
-   Run production smoke tests and verify backups

## Completion rule

A task is complete only when its acceptance criteria pass, relevant
tests pass, and the user has reviewed the result. Mark progress
explicitly; never silently skip phases.

## Codex task prompt template

``` text
Read all five documents in /docs before starting.

Current task: [PHASE.TASK — NAME]

First inspect the existing codebase. Explain:
1. Current relevant implementation
2. Proposed changes and files
3. Dependencies and assumptions
4. Security/tenant-isolation implications
5. Tests and acceptance criteria

Wait for my approval before implementing.

After approval, implement only this task. Run the relevant checks and report changed files, commands, test/build results and remaining issues. Do not start the next task.
```
