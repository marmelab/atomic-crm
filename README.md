# React-admin CRM

This is a demo of the [react-admin](https://github.com/marmelab/react-admin) library for React.js. It's a CRM for a fake Web agency with a few sales. You can test it online at https://marmelab.com/react-admin-crm.

https://user-images.githubusercontent.com/99944/116970434-4a926480-acb8-11eb-8ce2-0602c680e45e.mp4

React-admin usually requires a REST/GraphQL server to provide data. In this demo however, the API is simulated by the browser (using [FakeRest](https://github.com/marmelab/FakeRest)). The source data is generated at runtime by a package called [data-generator](https://github.com/marmelab/react-admin/tree/master/examples/data-generator).

To explore the source code, start with [src/App.tsx](https://github.com/marmelab/react-admin/blob/master/examples/crm/src/App.tsx).

**Note**: This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).

## Setup

After having cloned the react-admin repository, run the following command at the project root:

```sh
npm install
```


## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br>
See the section about [running tests](#running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

### `npm run deploy`

Create a remote Supabase project and initialize it with the migrations.

## Manual Deployment

To deploy this application, you need a Supabase instance.

Login into your supabase account:

```sh
npx supabase login
```

Then, create a new supabase project. Keep note of the database password you'll have to enter and of the supabase project reference.
```sh
npx supabase projects create react-admin-crm
```

Now, link this project to the local supabase instance. You'll be asked to enter the database password.
```sh
supabase link --project-ref ********************
```

Finally, apply the migrations on it:
```sh
supabase db push
```
