#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const processOptions = { cwd: process.cwd(), env: process.env };

function runSupabase(args, options = {}) {
  return spawnSync(command, ['supabase', ...args], {
    ...processOptions,
    ...options,
    encoding: options.encoding ?? 'utf8',
  });
}

function parseCliEnv(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf('=');
        let value = line.slice(separator + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        return [line.slice(0, separator), value];
      }),
  );
}

function assertSuccess(result, message) {
  if (result.status !== 0) throw new Error(message);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const users = [
  { email: 'alice@sock.test', password: 'SockTest123!', username: 'alice', displayName: 'Alice Chen' },
  { email: 'ben@sock.test', password: 'SockTest123!', username: 'ben', displayName: 'Ben Carter' },
  { email: 'chloe@sock.test', password: 'SockTest123!', username: 'chloe', displayName: 'Chloe Rivera' },
];

const groupIds = {
  apartment: '11111111-1111-4111-8111-111111111111',
  study: '22222222-2222-4222-8222-222222222222',
};

const statusBefore = runSupabase(['status', '--output', 'env']);
const startedBySeed = statusBefore.status !== 0;
if (startedBySeed) {
  console.log('Starting local Supabase…');
  const started = runSupabase(
    ['start', '--exclude', 'studio,mailpit,edge-runtime,imgproxy,logflare,vector,supavisor'],
    { stdio: 'inherit' },
  );
  assertSuccess(started, 'Supabase did not start successfully.');
}

try {
  const status = runSupabase(['status', '--output', 'env']);
  assertSuccess(status, 'Could not read local Supabase credentials.');
  const local = parseCliEnv(status.stdout);
  const url = local.API_URL;
  const publishableKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
  const secretKey = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey || !local.DB_URL) throw new Error('Local Supabase credentials are incomplete.');

  const migrated = runSupabase(['migration', 'up', '--local'], { stdio: 'inherit' });
  assertSuccess(migrated, 'Pending local migrations could not be applied.');

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;

  const userIds = {};
  for (const fixture of users) {
    const existing = listed.data.users.find(
      (user) => user.email?.toLowerCase() === fixture.email.toLowerCase(),
    );
    if (existing) {
      userIds[fixture.username] = existing.id;
      const updated = await admin.auth.admin.updateUserById(existing.id, {
        password: fixture.password,
        email_confirm: true,
        user_metadata: { username: fixture.username, display_name: fixture.displayName },
      });
      if (updated.error) throw updated.error;
      console.log(`Reusing ${fixture.email}`);
    } else {
      const created = await admin.auth.admin.createUser({
        email: fixture.email,
        password: fixture.password,
        email_confirm: true,
        user_metadata: { username: fixture.username, display_name: fixture.displayName },
      });
      if (created.error || !created.data.user) throw created.error ?? new Error('User was not created.');
      userIds[fixture.username] = created.data.user.id;
      console.log(`Created ${fixture.email}`);
    }
  }

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  for (const fixture of users) {
    const signedIn = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error(`Could not sign in ${fixture.email}.`);
    await client.auth.signOut({ scope: 'local' });
  }

  const alice = userIds.alice;
  const ben = userIds.ben;
  const chloe = userIds.chloe;
  const sql = `
begin;
update public.profiles set username = 'alice', display_name = 'Alice Chen' where id = ${sqlString(alice)}::uuid;
update public.profiles set username = 'ben', display_name = 'Ben Carter' where id = ${sqlString(ben)}::uuid;
update public.profiles set username = 'chloe', display_name = 'Chloe Rivera' where id = ${sqlString(chloe)}::uuid;
delete from public.sock_sessions where user_id in (${sqlString(alice)}::uuid, ${sqlString(ben)}::uuid, ${sqlString(chloe)}::uuid);
delete from public.friendships
where (user_low = least(${sqlString(alice)}::uuid, ${sqlString(ben)}::uuid) and user_high = greatest(${sqlString(alice)}::uuid, ${sqlString(ben)}::uuid))
   or (user_low = least(${sqlString(alice)}::uuid, ${sqlString(chloe)}::uuid) and user_high = greatest(${sqlString(alice)}::uuid, ${sqlString(chloe)}::uuid));
delete from public.groups where id in (${sqlString(groupIds.apartment)}::uuid, ${sqlString(groupIds.study)}::uuid);
insert into public.groups (id, owner_id, name) values
  (${sqlString(groupIds.apartment)}::uuid, ${sqlString(alice)}::uuid, 'Apartment 4B'),
  (${sqlString(groupIds.study)}::uuid, ${sqlString(ben)}::uuid, 'Study Crew');
insert into public.group_members (group_id, user_id, role, added_by) values
  (${sqlString(groupIds.apartment)}::uuid, ${sqlString(ben)}::uuid, 'admin', ${sqlString(alice)}::uuid),
  (${sqlString(groupIds.apartment)}::uuid, ${sqlString(chloe)}::uuid, 'member', ${sqlString(alice)}::uuid),
  (${sqlString(groupIds.study)}::uuid, ${sqlString(alice)}::uuid, 'member', ${sqlString(ben)}::uuid);
insert into public.friendships (requester_id, addressee_id) values (${sqlString(alice)}::uuid, ${sqlString(ben)}::uuid);
update public.friendships set status = 'accepted'
where requester_id = ${sqlString(alice)}::uuid and addressee_id = ${sqlString(ben)}::uuid;
insert into public.friendships (requester_id, addressee_id) values (${sqlString(alice)}::uuid, ${sqlString(chloe)}::uuid);
update public.friendships set status = 'accepted'
where requester_id = ${sqlString(alice)}::uuid and addressee_id = ${sqlString(chloe)}::uuid;
insert into public.sock_sessions (user_id) values (${sqlString(ben)}::uuid);
commit;
`;

  const seeded = spawnSync('psql', ['--dbname', local.DB_URL, '--set=ON_ERROR_STOP=1'], {
    ...processOptions,
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  assertSuccess(seeded, 'Seed SQL failed.');

  const verify = spawnSync('psql', [
    '--dbname', local.DB_URL,
    '--tuples-only',
    '--no-align',
    '--command',
    "select count(*) from public.profiles where username in ('alice','ben','chloe');",
  ], { ...processOptions, encoding: 'utf8' });
  assertSuccess(verify, 'Could not verify seeded profiles.');
  if (Number.parseInt(verify.stdout.trim(), 10) !== users.length) throw new Error('Seed verification found an unexpected user count.');

  console.log('Seeded 3 confirmed users, 2 groups, friendships, memberships, and Ben’s active sock.');
  console.log('Credentials: alice@sock.test / SockTest123! (same password for Ben and Chloe)');
} finally {
  if (startedBySeed) {
    console.log('Stopping local Supabase (seed data is preserved)…');
    runSupabase(['stop'], { stdio: 'inherit' });
  }
}
