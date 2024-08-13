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

### Configuration

1. [Supabase Configuration](./doc/developer/01-supabase-configuration.md)
2. [Customizing the CRM](./doc/developer/02-customizing.md)
3. [Deploying to Production](./doc/developer/03-manual-deploy.md)
4. [GitHub Actions Configuration](./doc/developer/04-github-actions.md) *(optional)*
5. [Email Inbound Configuration](./doc/developer/05-email-inbound.md) *(optional)*
6. [Creating Migrations](./doc/developer/06-supabase-migrations.md) *(optional)*
7. [Contact Import Customization](./doc/developer/07-contact-import.md) *(optional)*
8. [Using Fake Rest Data Provider for Development](./doc/developer/08-data-providers.md) *(optional)*
9. [Learn More About Architecture Decisions](./doc/developer/09-architecture-choices.md) *(optional)*

### Running the App In Development Mode

Once you app is configred, start the app locally with the following command:

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

### Testing

This project contains unit tests. Run them with the following command:

```sh
make test
```


## User documentation

1. [Create First User](./doc/user/01-create-first-user.md)
2. [Create First User](./doc/user/02-import-contacts.md)