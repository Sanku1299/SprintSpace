# Mongoose model conventions

Keep each Mongoose model in a singular, PascalCase-named file such as `User.ts` or `Project.ts`. Export the model using Mongoose's model registry so hot reloads do not attempt to register it twice:

```ts
export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);
```

## Schema rules

- Define schemas and their inferred TypeScript types together in the model file.
- Use `{ timestamps: true }` for persisted entities that need creation and update times.
- Every tenant-owned document must have a required `workspaceId` reference. The Workspace document itself is the tenant root and does not reference another workspace.
- Keep parent references such as `projectId` and `taskId` explicit. Validate that referenced documents belong to the same workspace in the service layer.
- Use schema validation for data shape and invariants. Authorization and tenant-scoped query filters belong in server-side services, not only in Mongoose hooks or client code.
- Add indexes for observed query patterns. Tenant-owned collection indexes should include `workspaceId` where appropriate. Do not decide global email uniqueness or other open product rules at the schema layer until those decisions are confirmed.
- Store attachment metadata in MongoDB; keep binary contents in object storage.

Model modules must be imported only from server-side code. Define concrete models when their roadmap task begins rather than creating unused schemas ahead of time.
