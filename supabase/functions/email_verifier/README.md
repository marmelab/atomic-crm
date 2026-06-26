# email_verifier

Server-side proxy to the [MyEmailVerifier](https://myemailverifier.com) single-email
validation API. Holds the API key so it never reaches the browser. Requires a
logged-in CRM user (Supabase JWT verified via the shared auth middleware).

## Request

`POST /functions/v1/email_verifier`

```json
{ "emails": ["jane@acme.com", "bad@nope.com"] }
```

Returns one result per email:

```json
{
  "data": [
    { "email": "jane@acme.com", "verification": { "status": "Valid", "diagnosis": "...", "checkedAt": "..." } },
    { "email": "bad@nope.com", "verification": null, "error": "Verifier returned 502" }
  ]
}
```

`status` is one of `Valid | Invalid | Catch-all | Unknown`.

## The API key — never commit it

The key is read at runtime from `MYEMAILVERIFIER_API_KEY`.

- **Production:** set it as a Supabase secret (not in any file):
  ```bash
  npx supabase secrets set MYEMAILVERIFIER_API_KEY=<key-from-dashboard>
  ```
- **Local dev:** `supabase/functions/.env` is **tracked in git** (and this repo is
  public), so do **not** put the key there. Instead create an untracked
  `supabase/functions/.env.local` (matched by `.gitignore`) and serve with:
  ```bash
  npx supabase functions serve email_verifier --env-file supabase/functions/.env.local
  ```

Get the key from the MyEmailVerifier dashboard → API Settings → Your API Key.
