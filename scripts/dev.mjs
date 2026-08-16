#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const rawArgs = process.argv.slice(2);
const backendOnly = rawArgs.includes('--backend-only');
const testDatabase = rawArgs.includes('--test-db');
const useLocalBackend = rawArgs.includes('--local') || backendOnly || testDatabase;
const checkOnly = rawArgs.includes('--check');
const wantsHelp = rawArgs.includes('--help') || rawArgs.includes('-h');
const expoArgs = rawArgs.filter(
  (argument) =>
    !['--local', '--backend-only', '--test-db', '--check', '--help', '-h'].includes(argument),
);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
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

function runSupabase(args, options = {}) {
  return spawnSync(command, ['supabase', ...args], {
    cwd: process.cwd(),
    env: options.env,
    encoding: options.encoding,
    stdio: options.stdio,
  });
}

async function assertBackendHealthy(url, publishableKey) {
  if (!url || !publishableKey) {
    throw new Error('Supabase URL or publishable key is missing.');
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Supabase health check returned HTTP ${response.status}.`);
}

function assertLoopbackUrl(value) {
  const host = new URL(value).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Local mode refused a non-loopback Supabase URL (${host}).`);
  }
}

async function assertLocalAuthAutoConfirms(url, publishableKey, secretKey) {
  if (!secretKey) throw new Error('Local service-role credentials are missing.');

  const email = `sock-local-${crypto.randomUUID()}@sock.test`;
  const password = `Sock-local-${crypto.randomUUID()}!`;
  const username = `local_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let userId;
  try {
    const settingsResponse = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
    });
    const settings = await settingsResponse.json();
    if (!settingsResponse.ok || settings.mailer_autoconfirm !== true) {
      throw new Error('Local Auth does not report immediate email confirmation.');
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    userId = data.user?.id;
    if (!data.session || !userId || !data.user?.email_confirmed_at) {
      throw new Error('Local signup did not return an immediately confirmed session.');
    }
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    if (!signInData.session || signInData.user.id !== userId) {
      throw new Error('Local login did not return the newly created account session.');
    }
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

async function runExpo(environment, stopBackend) {
  console.log('Starting Expo. Press Ctrl+C once to stop the app and any local backend started here.');
  const localExpoArgs =
    environment.EXPO_PUBLIC_LOCAL_BACKEND === 'true' && !expoArgs.includes('--clear')
      ? ['--clear']
      : [];
  const child = spawn(command, ['expo', 'start', ...localExpoArgs, ...expoArgs], {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  });

  let signalForwarded = false;
  const forwardSignal = (signal) => {
    if (signalForwarded) return;
    signalForwarded = true;
    child.kill(signal);
  };
  process.once('SIGINT', () => forwardSignal('SIGINT'));
  process.once('SIGTERM', () => forwardSignal('SIGTERM'));

  let exitCode = 1;
  try {
    exitCode = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolveExit(code ?? 1));
    });
  } finally {
    stopBackend();
  }
  process.exitCode = exitCode;
}

async function main() {
  if (wantsHelp) {
    console.log(`Sock development runner

Usage:
  npm run dev                  Start Expo against the hosted Supabase backend
  npm run frontend             Start Expo against values in .env.local
  npm run dev:local            Start local Supabase, migrate, then start Expo
  npm run backend:local        Start and leave the local backend running
  npm run test:db              Start local Supabase if needed and run pgTAP
  npm run dev -- --check       Check the hosted backend without starting Expo
  npm run dev:local:check      Verify the local stack and migrations, then stop

Local mode auto-confirms email accounts and disables mail, SMS, OAuth, webhooks,
push delivery, analytics, and Edge Functions. It requires Docker Desktop, OrbStack,
Colima, Podman, or another Docker-compatible runtime.`);
    return;
  }

  const fileEnvironment = readEnvFile(resolve(process.cwd(), '.env.local'));
  const baseEnvironment = {
    ...process.env,
    ...fileEnvironment,
    SUPABASE_TELEMETRY_DISABLED: '1',
  };

  if (!useLocalBackend) {
    const url = baseEnvironment.EXPO_PUBLIC_SUPABASE_URL;
    const publishableKey = baseEnvironment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      await assertBackendHealthy(url, publishableKey);
    } catch (error) {
      throw new Error(
        `Hosted backend is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    console.log(`Hosted Supabase backend is healthy (${new URL(url).host}).`);
    if (checkOnly) return;
    await runExpo(
      {
        ...baseEnvironment,
        EXPO_PUBLIC_LOCAL_BACKEND: 'false',
        EXPO_PUBLIC_EXTERNAL_SERVICES_ENABLED: 'true',
      },
      () => {},
    );
    return;
  }

  const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (docker.error?.code === 'ENOENT') {
    throw new Error('Local mode needs a Docker-compatible runtime, but `docker` is not installed.');
  }
  if (docker.status !== 0) {
    throw new Error('Local mode needs Docker Desktop (or a compatible runtime) to be running.');
  }

  const statusBefore = runSupabase(['status', '--output', 'env'], {
    env: baseEnvironment,
    encoding: 'utf8',
  });
  const startedByRunner = statusBefore.status !== 0;

  if (startedByRunner) {
    console.log('Starting the local Supabase backend and applying migrations…');
    const started = runSupabase(
      [
        'start',
        '--exclude',
        'studio,mailpit,edge-runtime,imgproxy,logflare,vector,supavisor',
      ],
      { env: baseEnvironment, stdio: 'inherit' },
    );
    if (started.status !== 0) throw new Error('Supabase did not start successfully.');
  } else {
    console.log('Using the local Supabase stack that is already running.');
  }

  let stopped = false;
  const stopBackend = () => {
    if (!startedByRunner || stopped) return;
    stopped = true;
    console.log('Stopping the local Supabase backend (data is preserved)…');
    runSupabase(['stop'], { env: baseEnvironment, stdio: 'inherit' });
  };

  try {
    const status = runSupabase(['status', '--output', 'env'], {
      env: baseEnvironment,
      encoding: 'utf8',
    });
    if (status.status !== 0) throw new Error('Could not read local Supabase credentials.');

    const localEnvironment = parseCliEnv(status.stdout ?? '');
    const url = localEnvironment.API_URL;
    const publishableKey = localEnvironment.PUBLISHABLE_KEY ?? localEnvironment.ANON_KEY;
    const secretKey = localEnvironment.SECRET_KEY ?? localEnvironment.SERVICE_ROLE_KEY;
    assertLoopbackUrl(url);
    await assertBackendHealthy(url, publishableKey);

    console.log('Applying any pending local migrations…');
    const migrated = runSupabase(['migration', 'up', '--local'], {
      env: baseEnvironment,
      stdio: 'inherit',
    });
    if (migrated.status !== 0) throw new Error('Pending local migrations could not be applied.');

    console.log('Local Supabase is healthy. Accounts auto-confirm and outbound services are off.');

    if (checkOnly) {
      await assertLocalAuthAutoConfirms(url, publishableKey, secretKey);
      console.log('Local signup and login returned usable sessions without a mail service.');
      stopBackend();
      return;
    }

    if (testDatabase) {
      const tested = runSupabase(['test', 'db'], { env: baseEnvironment, stdio: 'inherit' });
      if (tested.status !== 0) throw new Error('Database tests failed.');
      stopBackend();
      return;
    }

    if (backendOnly) {
      console.log('Local backend is running. Stop it later with `npx supabase stop`.');
      return;
    }

    await runExpo(
      {
        ...baseEnvironment,
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        EXPO_PUBLIC_LOCAL_BACKEND: 'true',
        EXPO_PUBLIC_EXTERNAL_SERVICES_ENABLED: 'false',
        EXPO_OFFLINE: '1',
        EXPO_NO_DOTENV: '1',
        EXPO_NO_TELEMETRY: '1',
      },
      stopBackend,
    );
  } catch (error) {
    stopBackend();
    throw error;
  }
}

main().catch((error) => {
  console.error(`\nCould not start Sock: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
