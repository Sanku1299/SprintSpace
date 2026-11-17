# SprintSpace --- Database Design Document

**Draft v0.1 \| Reconstructed from the retained project decisions**

## 1. Database approach

MongoDB with Mongoose. Shared database and collections; tenant isolation
via `workspaceId`.

## 2. Collections

1.  `users`
2.  `workspaces`
3.  `invitations`
4.  `projects`
5.  `projectMembers`
6.  `tasks`
7.  `comments`
8.  `activities`
9.  `notifications`
10. `attachments`

A separate memberships collection for user-to-workspace relationships is
unnecessary while each user belongs to exactly one workspace.

## 3. Core document shapes

The following are conceptual fields, not final Mongoose schemas.

### users

-   `_id`
-   `workspaceId`
-   `name`
-   `email` (normalized and unique according to chosen account policy)
-   `passwordHash` or external auth identity fields
-   `role`: `admin | project_manager | developer | designer`
-   `avatarUrl`
-   `status`
-   timestamps

### workspaces

-   `_id`
-   `name`
-   `slug`
-   `description`
-   `logo`
-   `createdBy`
-   preferences/settings
-   timestamps

### invitations

-   `_id`
-   `workspaceId`
-   `email`
-   `name` (if collected)
-   `role`
-   `projectIds` (optional initial project access)
-   `tokenHash`
-   `status`: pending/accepted/expired/revoked
-   `expiresAt`
-   `invitedBy`
-   `acceptedAt`
-   timestamps

### projects

-   `_id`
-   `workspaceId`
-   `name`
-   `key`
-   `description`
-   `status`
-   `priority`
-   `projectManagerId`
-   `startDate`
-   `endDate`
-   `createdBy`
-   timestamps

### projectMembers

-   `_id`
-   `workspaceId`
-   `projectId`
-   `userId`
-   `addedBy`
-   timestamps

The responsible PM is represented by `projectManagerId`; a PM does not
need a duplicate membership record solely to establish management
responsibility. If PM participation as a normal member is later needed,
document that explicitly.

### tasks

-   `_id`
-   `workspaceId`
-   `projectId`
-   `title`
-   `description`
-   `status`
-   `priority`
-   `assigneeId`
-   `allowedEditorIds`
-   `dueDate`
-   `labels`
-   `parentTaskId`
-   `position`
-   optional sprint/dependency references
-   `createdBy`
-   timestamps

### comments

-   `_id`
-   `workspaceId`
-   `projectId`
-   `taskId`
-   `authorId`
-   `body`
-   optional mention references
-   timestamps

### activities

-   `_id`
-   `workspaceId`
-   `projectId`
-   `taskId` (optional)
-   `actorId`
-   `action`
-   structured metadata
-   timestamp

### notifications

-   `_id`
-   `workspaceId`
-   `recipientId`
-   `type`
-   `resourceType`
-   `resourceId`
-   `readAt`
-   structured payload
-   timestamp

### attachments

-   `_id`
-   `workspaceId`
-   `projectId`
-   `taskId` (optional)
-   `uploadedBy`
-   `storageKey`
-   `originalName`
-   `mimeType`
-   `size`
-   timestamps

Binary file data belongs in object storage, not MongoDB documents.

## 4. Relationships and constraints

-   User belongs to one workspace.
-   Workspace has many users, projects and invitations.
-   Project belongs to one workspace.
-   Project has one responsible PM (`projectManagerId`).
-   Project membership links a user to a project.
-   Task belongs to one project and workspace.
-   Task assignee and additional editors must belong to the same
    workspace and be project members, subject to the PM/Admin handling
    rules.
-   Comments, activities, notifications and attachments must be
    tenant-scoped.
-   Parent task must belong to the same project/workspace.
-   Cross-workspace references must be rejected.

## 5. Indexing guidance

Review indexes against actual query patterns. Likely candidates: -
`users`: unique normalized email (global vs workspace-scoped uniqueness
is an explicit account-policy decision), `workspaceId + role` -
`invitations`: `workspaceId + status`, token hash unique,
expiry/status - `projects`: `workspaceId + status`,
`workspaceId + projectManagerId` - `projectMembers`: unique
`workspaceId + projectId + userId`, plus `workspaceId + userId` -
`tasks`: `workspaceId + projectId + status`, `workspaceId + assigneeId`,
`projectId + position` - `comments`:
`workspaceId + taskId + createdAt` - `activities`:
`workspaceId + projectId + createdAt` - `notifications`:
`workspaceId + recipientId + readAt + createdAt` - `attachments`:
`workspaceId + taskId`

## 6. Critical validation

-   Resolve workspace from authenticated user, never request body.
-   Confirm project belongs to the user's workspace before any project
    operation.
-   Confirm project membership for Developer/Designer project access.
-   Confirm task belongs to the requested project and workspace.
-   Confirm assignee and allowed editors are valid users with
    appropriate project access.
-   Enforce task edit policy independently from project visibility.
-   Prevent duplicate project membership.
-   Enforce invitation token expiry, one-time use and workspace
    consistency.

## 7. Decisions requiring confirmation before schema finalization

-   Global email uniqueness vs workspace-scoped email uniqueness.
-   Whether invitation acceptance creates the user account or requires
    an existing account.
-   Whether Admin/PM can assign tasks to non-member users (recommended:
    no; add them to project first).
-   Exact task field-level permissions for assignees and additional
    editors.
-   Whether task dependencies and sprints are first-release collections
    or embedded/reference structures.
-   Soft delete vs hard delete and audit retention.
