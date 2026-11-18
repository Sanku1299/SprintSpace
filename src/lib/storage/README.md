# Object storage setup

The storage adapter uses the S3 protocol. Keep all `OBJECT_STORAGE_*` values in
the server environment, such as `.env.local`; never prefix them with
`NEXT_PUBLIC_`.

- Set the bucket and region for AWS S3. Leave the endpoint unset to use the AWS
  endpoint. AWS deployments may use the SDK credential chain or a complete
  access-key/secret-key pair.
- For another S3-compatible service, set its HTTPS endpoint and both access
  credentials. The adapter defaults to path-style requests when an endpoint is
  configured; `OBJECT_STORAGE_FORCE_PATH_STYLE` can override that behavior.
- Keep the bucket private. Configure bucket CORS to allow `POST` and `GET` from
  the application origin, with the request headers required by the provider's
  presigned form.

The upload endpoint creates short-lived, task-scoped presigned POST forms. It
binds each form to a server-generated storage key, the declared content type,
and the declared file size. Attachment metadata is registered separately after
the browser upload completes.
