# Data Providers

This project supports two data providers:
- A [supabase data provider](../../src/providers/supabase/) (default)
- A [fakerest data provider](../../src/providers/fakerest/)

## Supabase Data Provider

This is the default data provider for the CRM demo. For local development, it binds to a local supabase instance.

## FakeRest Data provider

This data provider is used in the [React Admin CRM demo](https://marmelab.com/react-admin-crm/) and can also be used to test
local development with generated data.

## Filters

The list filters used in this project MUST follow the [`ra-data-postgrest`](https://github.com/raphiniert-com/ra-data-postgrest) convention. The filters are then mapped at runtime to the fakerest filters.

If a filter is not supported by the transformer, you can add new filter adapters in the [`supabaseAdapter` ](../../src/providers/fakerest/internal/supabaseAdapter.ts) file.
