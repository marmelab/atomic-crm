create table public.mcp_oauth_agent_credentials (
    oauth_client_id text primary key,
    refresh_token text not null,
    updated_at timestamp with time zone not null default now()
);

alter table public.mcp_oauth_agent_credentials enable row level security;

grant all on table public.mcp_oauth_agent_credentials to service_role;
