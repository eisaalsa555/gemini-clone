-- Profiles table
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = user_id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Users view own conversations" on public.conversations for select using (auth.uid() = user_id);
create policy "Users create own conversations" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users update own conversations" on public.conversations for update using (auth.uid() = user_id);
create policy "Users delete own conversations" on public.conversations for delete using (auth.uid() = user_id);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create index idx_messages_conv on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Users view own messages" on public.messages for select using (auth.uid() = user_id);
create policy "Users create own messages" on public.messages for insert with check (auth.uid() = user_id);
create policy "Users delete own messages" on public.messages for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_conversations_updated_at before update on public.conversations
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for chat image uploads
insert into storage.buckets (id, name, public) values ('chat-uploads', 'chat-uploads', true)
on conflict (id) do nothing;

create policy "Anyone can view chat uploads" on storage.objects for select using (bucket_id = 'chat-uploads');
create policy "Authenticated can upload chat files" on storage.objects for insert
  with check (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own chat files" on storage.objects for delete
  using (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);