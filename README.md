# Purplinity CRM

## Overview
Purplinity CRM is a modern, extensible customer relationship management system designed for flexibility and rapid deployment.

## Features
- Customizable engagement states and workflow
- Dashboard with visual analytics
- Company, contact, and engagement management
- Task and note tracking
- Built with React, Vite, and Supabase

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Supabase account (for production or cloud deployment)

### Installation
1. **Clone the repository:**
   ```sh
   git clone https://github.com/paulconnaghan/purplinity-crm.git
   cd purplinity-crm
   ```
2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```
3. **Configure Supabase:**
   - Copy `supabase/config.toml.example` to `supabase/config.toml` and update with your Supabase project credentials.
   - Set the following environment variables in a `.env` file at the project root:
     ```env
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

### Running Locally
```sh
npm run dev
# or
yarn dev
```
- The app will be available at [http://localhost:5173](http://localhost:5173)

### Deployment
- Deploy to Vercel, Netlify, or your preferred static hosting provider.
- Set the required environment variables in your deployment settings.
- For Supabase Edge Functions and database setup, see the `supabase/` directory and documentation.

## Documentation
- See the `doc/` directory for developer and user guides.
- For customizing engagement states, see `src/root/defaultConfiguration.ts`.

## Contributing
Pull requests are welcome! Please open an issue to discuss major changes first.

## License
MIT
