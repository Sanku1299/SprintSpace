# SprintSpace --- API Specification Document

**Draft v0.1 \| Reconstructed from the retained project decisions**

## 1. API conventions

-   REST APIs through Next.js Route Handlers under `/api`.
-   Auth.js session is the authentication source.
-   JSON request/response bodies.
-   Validate inputs with Zod.
-   Resolve `workspaceId`, role and actor identity from trusted server
    context.
-   Return consistent success/error envelopes.
-   Use `404` for inaccessible tenant resources where appropriate to
    avoid leaking their existence.

Example success:

``` json
{ "success": true, "data": {} }
```

Example error:

``` json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "You cannot perform this action." } }
```

## 2. Authentication

-   `POST /api/auth/register-company`
-   Auth.js sign-in/sign-out routes
-   `POST /api/auth/forgot-password`
-   `POST /api/auth/reset-password`
-   `POST /api/invitations/accept`

Company registration must create the workspace and first Admin
consistently. Use a transaction if supported by the MongoDB deployment.

## 3. Workspace and members

-   `GET /api/workspace`
-   `PATCH /api/workspace`
-   `GET /api/members`
-   `GET /api/members/:userId`
-   `PATCH /api/members/:userId`
-   `POST /api/invitations`
-   `GET /api/invitations`
-   `POST /api/invitations/:invitationId/resend`
-   `POST /api/invitations/:invitationId/revoke`

Admin-only workspace/member/role operations unless a narrower policy is
explicitly defined. Invitation acceptance must bind the user to the
invitation's workspace and enforce the one-workspace-per-user rule.

## 4. Projects

-   `GET /api/projects`
-   `POST /api/projects`
-   `GET /api/projects/:projectId`
-   `PATCH /api/projects/:projectId`
-   `DELETE /api/projects/:projectId` (prefer archive semantics unless
    permanent deletion is explicitly approved)
-   `GET /api/projects/:projectId/members`
-   `POST /api/projects/:projectId/members`
-   `DELETE /api/projects/:projectId/members/:userId`

Admin can access all workspace projects. PM can access/manage projects
they are responsible for. Developer/Designer can access only projects
where they are members. Membership changes are restricted to Admin and
responsible PM.

## 5. Tasks

-   `GET /api/projects/:projectId/tasks`
-   `POST /api/projects/:projectId/tasks`
-   `GET /api/tasks/:taskId`
-   `PATCH /api/tasks/:taskId`
-   `DELETE /api/tasks/:taskId`
-   `GET /api/tasks/:taskId/comments`
-   `POST /api/tasks/:taskId/comments`
-   `GET /api/tasks/:taskId/activity`
-   `GET /api/tasks/:taskId/attachments`
-   `POST /api/tasks/:taskId/attachments`
-   `GET /api/tasks/:taskId/subtasks`
-   `POST /api/tasks/:taskId/subtasks`

Project members can view all tasks in accessible projects. Editing is
separate: - Admin: all workspace tasks. - PM: tasks in projects they
manage. - Assigned Developer/Designer: only tasks assigned to them,
subject to field-level restrictions. - Additional authorized editors:
only tasks explicitly granted to them, subject to field-level
restrictions.

Task deletion should be more restrictive than ordinary task updates
(Admin/PM policy to be finalized). Do not assume a task assignee may
modify every field. Separate status/progress updates from privileged
changes such as reassignment, changing project, or editing permissions.

## 6. Sprints

Potential project-scoped endpoints: -
`GET /api/projects/:projectId/sprints` -
`POST /api/projects/:projectId/sprints` - `GET /api/sprints/:sprintId` -
`PATCH /api/sprints/:sprintId` - `POST /api/sprints/:sprintId/complete`

Finalize sprint lifecycle and authorization before implementing.

## 7. Notifications

-   `GET /api/notifications`
-   `PATCH /api/notifications/:notificationId`
-   `POST /api/notifications/mark-all-read`
-   `GET /api/notification-preferences`
-   `PATCH /api/notification-preferences`

A user may only access their own notifications within their workspace.

## 8. Attachments

-   `POST /api/uploads/presign` or an equivalent secure upload flow
-   `POST /api/attachments`
-   `GET /api/attachments/:attachmentId`
-   `DELETE /api/attachments/:attachmentId`

Verify authorization before issuing upload/download access. Store file
binaries in object storage and metadata in MongoDB.

## 9. Analytics

-   `GET /api/analytics/workspace` (Admin)
-   `GET /api/analytics/projects` (Admin/PM scoped by policy)
-   `GET /api/analytics/projects/:projectId` (Admin or responsible PM)
-   `GET /api/analytics/me` (personal metrics)

Analytics must derive from authorized tenant/project data.

## 10. Real-time events

Socket.IO may distribute events such as: - `task.created` -
`task.updated` - `task.deleted` - `comment.created` -
`notification.created` - `project.updated`

Authenticate socket connections and authorize workspace/project room
membership. REST APIs remain the source of truth for mutations; sockets
distribute updates only.

## 11. Security requirements

-   Never accept `workspaceId`, role or actor identity as trusted client
    input.
-   Validate all identifiers and payloads.
-   Scope every query by workspace.
-   Verify project membership and task permissions separately.
-   Rate-limit sensitive authentication/invitation endpoints.
-   Hash invitation/reset tokens at rest.
-   Prevent mass assignment.
-   Audit important administrative actions.
-   Test cross-tenant access and role boundaries for every resource
    family.

## 12. Contract tests

Test unauthenticated access, cross-workspace access, role restrictions,
project membership visibility, task editing rules, invitation
expiry/revocation, and unauthorized file access.
