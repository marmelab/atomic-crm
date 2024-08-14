# Supabase Migrations

You can create a new migration using the following command:
```sh
npx supabase migration new <migration_name>
```

You can apply the migrations using the following command:
```sh
npx supabase migration up
```

But you can also apply changes in the database directly using the supabase Dashboard.
Create a new migration using the following command:
```sh
npx supabase db diff | npx supabase migration new <migration_name>
```

