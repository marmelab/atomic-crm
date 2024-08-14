# Atomic CRM

A full-feature CRM built with React and Supabase. 

https://user-images.githubusercontent.com/99944/116970434-4a926480-acb8-11eb-8ce2-0602c680e45e.mp4

You can test it online at https://marmelab.com/react-admin-crm.

## Install Project

To run this project locally, you will need the following tools installed on your computer:

- Make
- Node 20 LTS
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


## Developing with Atomic CRM

### Local Development Setup

1. [Supabase Configuration](./doc/developer/dev-01-supabase-configuration.md)
2. [Customizing the CRM](./doc/developer/dev-02-customizing.md)
3. [Creating Migrations](./doc/developer/dev-03-supabase-migrations.md) *(optional)*
4. [Contact Import Customization](./doc/developer/dev-04-contact-import.md) *(optional)*
5. [Using Fake Rest Data Provider for Development](./doc/developer/dev-O5-data-providers.md) *(optional)*
6. [Learn More About Architecture Decisions](./doc/developer/dev-06-architecture-choices.md) *(optional)*

Once you app is configured, start the app locally with the following command:

```sh
make start
```

This will start the Vite dev server for the frontend, the local Supabase instance for the API, and a Postgres database (thanks to Docker).

You can then access the app via [http://localhost:5173/](http://localhost:5173/).

If you need debug the backend, you can access the following services: 

- Supabase dashboard: [http://localhost:54323/](http://localhost:54323/)
- REST API: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Attachments storage: [http://localhost:54323/project/default/storage/buckets/attachments](http://localhost:54323/project/default/storage/buckets/attachments)
- Inbucket email testing service: [http://localhost:54324/](http://localhost:54324/)

### Deploying to Production

1. [Manual Production Deploy](./doc/developer/prod-01-manual-deploy.md)
2. [GitHub Actions Configuration](./doc/developer/prod-02-github-actions.md) *(optional)*
3. [Email Inbound Configuration](./doc/developer/prod-03-email-inbound.md) *(optional)*

### Testing

This project contains unit tests. Run them with the following command:

```sh
make test
```

## User documentation

1. [Create First User](./doc/user/01-create-first-user.md)
2. [Import Contacts](./doc/user/02-import-contacts.md)