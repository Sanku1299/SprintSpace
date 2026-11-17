# SprintSpace --- Product Requirements Document

**Draft v0.1 \| Reconstructed from the retained project decisions**

## 1. Product overview

SprintSpace is a multi-tenant project management and team collaboration
SaaS for software development companies. It provides workspace
administration, project planning, task tracking, Kanban workflows,
collaboration, notifications, and analytics.

## 2. Product principles

-   One company has exactly one workspace.
-   Every user belongs to exactly one company workspace.
-   Workspaces are isolated: users must never access another workspace's
    data.
-   Company roles and project membership are separate concepts.
-   Project membership grants project visibility; task permissions
    separately determine editing rights.
-   Prefer a coherent, maintainable full application over disconnected
    demos.

## 3. Roles

The only confirmed company roles are: - **Admin:** manages the
workspace, employees, roles, and all company projects and tasks. -
**Project Manager (PM):** manages projects for which they are the
responsible PM. - **Developer:** can access projects where they are a
project member. - **Designer:** can access projects where they are a
project member.

A user has one company role. Project membership does not change that
role. Multiple PMs are supported, with different projects assigned to
different PMs.

## 4. Workspace onboarding

-   Company registration creates a workspace and the first user as its
    Admin.
-   Admin invites employees and assigns their company role.
-   An invitation is associated with one existing workspace.
-   Accepting an invitation joins that workspace; it must not create
    another workspace.
-   A user already belonging to a different workspace cannot join a
    second workspace under the current product model.

## 5. Core modules and requirements

### Authentication and account

Registration, login, logout, password reset, invitation acceptance,
protected routes, profile and security settings.

### Workspace and employee management

Workspace profile/settings, employee directory, employee details,
invitations, invitation status, company role management and access
rules.

### Projects

Create, list, view, update and manage projects. Admin sees all workspace
projects. PM sees projects they manage. Developer/Designer sees projects
where they are members.

### Project membership

Admin and the responsible PM can add/remove project members. Project
membership is distinct from company role.

### Tasks and Kanban

Create, view, update, assign and organize tasks; priorities, due dates,
labels, subtasks, task details, task list and Kanban board. Workflow
includes To Do, In Progress, In Review and Done as the initial
illustrative workflow; final configurability must follow approved scope.

### Collaboration

Task comments, mentions, activity history and reactions where approved.

### Attachments

Upload, preview, download and manage attachments. Store binary files in
object storage and metadata in MongoDB.

### Notifications

Task, project, mention, invitation and workspace notifications;
read/unread management and preferences.

### Sprints

Project-level sprint planning, goals, dates, backlog, sprint board,
progress and reports, subject to the finalized sprint model.

### Analytics

Admin workspace-level analytics; PM analytics limited to managed
projects; Developer/Designer personal task and progress information.

## 6. Authorization rules

  -----------------------------------------------------------------------
  Role              Project           Task visibility   Task editing
                    visibility                          
  ----------------- ----------------- ----------------- -----------------
  Admin             All workspace     All workspace     All workspace
                    projects          tasks             tasks

  PM                Projects they     Tasks in managed  Tasks in managed
                    manage            projects          projects

  Developer         Projects where    All tasks in      Assigned tasks or
                    member            accessible        tasks explicitly
                                      projects          authorized for
                                                        editing

  Designer          Projects where    All tasks in      Assigned tasks or
                    member            accessible        tasks explicitly
                                      projects          authorized for
                                                        editing
  -----------------------------------------------------------------------

Task edit rights must not be inferred merely from project membership.
The exact field-level capabilities of assignees/editors should be
specified before implementation (for example, whether they may change
status but not reassign or change ownership).

## 7. Non-functional requirements

-   Enforce tenant isolation on every server-side read and write.
-   Validate all input.
-   Use secure password handling and session management.
-   Provide responsive desktop and mobile experiences.
-   Provide loading, empty, success and error states.
-   Maintain accessible controls and clear feedback.
-   Test authorization, tenant isolation and critical user journeys.

## 8. Out of scope unless explicitly approved

Subscription billing, multiple workspace memberships, extra company
roles (such as QA), employee performance rankings, time tracking, custom
project role systems, advanced roadmap tooling, and third-party
integrations such as GitHub/Slack/Figma/Google Drive.

## 9. Success criteria

A company can register a workspace, invite employees, create projects,
add project members, manage tasks and sprints, collaborate, receive
notifications and view role-appropriate analytics without
cross-workspace data exposure.

## 10. Open decisions

-   Final invitation lifecycle and handling of an email already
    associated with another account/workspace.
-   Exact field-level task editing permissions.
-   Final sprint lifecycle and whether sprints are mandatory.
-   Whether workflow customization is in scope.
-   Final attachment size/type limits and object-storage provider.
-   Any future billing or external integrations.
