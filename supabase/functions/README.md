# Supabase Edge Functions

| Function        | Path                    | Purpose |
|----------------|-------------------------|--------|
| `delete-account` | `delete-account/index.ts` | Deletes the signed-in user via Auth Admin API (`POST`/`DELETE` with `Authorization: Bearer <access_token>`). |

Deploy (CLI):

```bash
supabase functions deploy delete-account --project-ref YOUR_PROJECT_REF
```

Env is injected automatically: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
