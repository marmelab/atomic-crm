# Atomic CRM

A full-featured CRM built with React, shadcn-admin-kit, and Supabase.

https://github.com/user-attachments/assets/0d7554b5-49ef-41c6-bcc9-a76214fc5c99

Atomic CRM is free and open-source. You can test it online at https://marmelab.com/atomic-crm-demo.

## Features

- 📇 **Organize Contacts**: Keep all your contacts in one easily accessible place.
- ⏰ **Create Tasks & Set Reminders**: Never miss a follow-up or deadline.
- 📝 **Take Notes**: Capture important details and insights effortlessly.
- ✉️ **Capture Emails**: CC Atomic CRM to automatically save communications as notes.
- 📊 **Manage Deals**: Visualize and track your sales pipeline in a Kanban board.
- 🔄 **Import & Export Data**: Easily transfer contacts in and out of the system.
- 🔐 **Control Access**: Log in with Google, Azure, Keycloak, and Auth0.
- 📜 **Track Activity History**: View all interactions in aggregated activity logs.
- 🔗 **Integrate via API**: Connect seamlessly with other systems using our API.
- 🛠️ **Customize Everything**: Add custom fields, change the theme, and replace any component to fit your needs.

## Installation

To run this project locally, you will need the following tools installed on your computer:

- Make
- Node 22 LTS
- Docker (required by Supabase)

Fork the [`marmelab/atomic-crm`](https://github.com/marmelab/atomic-crm) repository to your user/organization, then clone it locally:

```sh
git clone https://github.com/[username]/atomic-crm.git
```

Install dependencies:

```sh
cd atomic-crm
make install
```

This will install the dependencies for the frontend and the backend, including a local Supabase instance.

Once you app is configured, start the app locally with the following command:

```sh
make start
```

This will start the Vite dev server for the frontend, the local Supabase instance for the API, and a Postgres database (thanks to Docker).

You can then access the app via [http://localhost:5173/](http://localhost:5173/). You will be prompted to create the first user.

If you need debug the backend, you can access the following services: 

- Supabase dashboard: [http://localhost:54323/](http://localhost:54323/)
- REST API: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Attachments storage: [http://localhost:54323/project/default/storage/buckets/attachments](http://localhost:54323/project/default/storage/buckets/attachments)
- Inbucket email testing service: [http://localhost:54324/](http://localhost:54324/)

## User Documentation

1. [User Management](./doc/user/user-management.md)
2. [Importing And Exporting Data](./doc/user/import-contacts.md)
3. [Inbound Email](./doc/user/inbound-email.md)

## Deploying to Production

1. [Configuring Supabase](./doc/developer/supabase-configuration.md)
2. [Configuring Inbound Email](./doc/developer/inbound-email-configuration.md) *(optional)*
3. [Deployment](./doc/developer/deploy.md)

## Customizing Atomic CRM

To customize Atomic CRM, you will need TypeScript and React programming skills as there is no graphical user interface for customization. Here are some resources to assist you in getting started.

1. [Customizing the CRM](./doc/developer/customizing.md)
2. [Creating Migrations](./doc/developer/migrations.md) *(optional)*
3. [Using Fake Rest Data Provider for Development](./doc/developer/data-providers.md) *(optional)*
4. [Architecture Decisions](./doc/developer/architecture-choices.md) *(optional)*

## Testing Changes

This project contains unit tests. Run them with the following command:

```sh
make test
```

You can add your own unit tests powered by Jest anywhere in the `src` directory. The test files should be named `*.test.tsx` or `*.test.ts`.

## License

This project is licensed under the MIT License, courtesy of [Marmelab](https://marmelab.com). See the [LICENSE.md](./LICENSE.md) file for details.
