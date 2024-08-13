# Architecture Choices

This document explains some of the architecture choices we made.

## Sales table

Sales are related to user accounts and add extra information oto the supabase's `auth.users` table.

They are automatically created or updated with supabase's `user` metadata (`first_name` and `last_name` are required when creating a new user) via a trigger.

## User Management

Due to the limitations of supabase, we do  not have a public endpoint to manage users. To solve this problem, we created a `users` function that is in charge of:
- Verifying current user's permissions
- Creation and update of user's

Note: We do not support user deletion to avoid data losses. Yet, it is possible to disable a user's account (relying on supabase ban feature).
