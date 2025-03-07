# Architecture Choices

This document explains some of the architecture decisions made in the development of Atomic CRM.

## Views

Some pages in Atomic CRM require data from multiple tables. To simplify the frontend code and reduce the HTTP overhead, Atomic CRM uses database views to abstract the complexity of the queries.

For instance, the contact list page displays the number of tasks for each contact. This information is provided by the `contacts_summary` view, defined in the `supabase/migrations/init_db.sql` file.

When using [the FakeRest data provider](./data-providers.md#setting-up-the-fakerest-data-provider), these views are emulated in the frontend.

## Triggers

User credentials are stored in Supabase's `auth.users` table. Supabase does not allow to add columns tp this table. That's why additional user details are stored in a `sales` table created by Atomic CRM. A database trigger is used to automatically sync the `sales` record when a user is created or updated (e.g. for the `first_name` and `last_name` fields).

The trigger can be found in the `supabase/migrations/20240730075425_init_triggers.sql` file.

## Edge Functions

Due to the limitations of Supabase, the API does not have a public endpoint to manage users.

To solve this problem, Atomic CRM uses a `users` edge function in charge of:

- Verifying the current user's permissions
- Creating and updating users

Atomic CRM does not support user deletion to avoid data losses. Yet, it is possible to disable a user's account (relying on Supabase's ban feature).

Atomic also uses Edge functions to handle the webhook and process the received emails. Check the [Inbound Email](./inbound-email-configuration.md) documentation for more information.

The edge functions can be found in the `supabase/functions/` directory.
