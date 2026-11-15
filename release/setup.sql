-- Only the new project's isolated table. Do not edit old script pointers.
create table if not exists public.cj_shenghao_script_config (
  key text primary key,
  value text not null
);
alter table public.cj_shenghao_script_config enable row level security;
drop policy if exists "cj shenghao public read" on public.cj_shenghao_script_config;
create policy "cj shenghao public read" on public.cj_shenghao_script_config
  for select to anon, authenticated using (true);
revoke all on public.cj_shenghao_script_config from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.cj_shenghao_script_config to anon, authenticated;
grant select, insert, update on public.cj_shenghao_script_config to service_role;
