# Data Providers

By default, the CRM demo uses [Supabase](https://supabase.com) for the backend API. Supabase is an open-source alternative to Firebase, built on top of Postgres. It provides a REST API and a real-time subscription system. The generous free tier allows you to run a small CRM for free.

## Using A Fake API For Development

For development purposes, you can use an alternative data provider called [FakeRest](https://github.com/marmelab/FakeRest). It's a simple REST API running in the browser that resets the data on each page reload. It's useful for testing the frontend without having to set up a backend, e.g. to let end users test some updates before the backend is ready.

FakeRest is used in the [React Admin CRM demo](https://marmelab.com/react-admin-crm/), where you can test it live.

### Setting Up The FakeRest Data Provider

To set up the FakeRest data provider, you need to change the `dataProvider` import in the `src/App.tsx` file:

```diff
// in src/App.tsx
import { CRM } from './root/CRM';
+ import { dataProvider, authProvider } from './providers/fakerest';

const App = () => (
    <CRM 
+        dataProvider={dataProvider}
+        authProvider={authProvider}
    />
);

export default App;
```

### Filters Syntax

The list filters used in this project MUST follow the [`ra-data-postgrest`](https://github.com/raphiniert-com/ra-data-postgrest) convention, where the filter operator is concatenated to the field name with an `@`. For example, to filter contacts by first name, you would use the `first_name@eq` filter.

When using FakeRest, the filters are mapped at runtime to the FakeRest filter syntax by the the [`supabaseAdapter`](../../src/providers/fakerest/internal/supabaseAdapter.ts) file. If a filter is not yet supported by the adapter, you have to modify this file to add support for it.
