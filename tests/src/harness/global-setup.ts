import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

export type StackConfig = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    stack: StackConfig;
  }
}

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * Finds the running local Supabase stack. Env vars win, so CI or a stack on
 * other ports can be pointed at directly; otherwise ask the Supabase CLI, which
 * also honours the SUPABASE_* port overrides described in the README.
 */
function readStackConfig(): StackConfig {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    return {
      apiUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  let raw: string;
  try {
    raw = execFileSync('supabase', ['status', '-o', 'json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(
      'The local Supabase stack is not running. Start it with `pnpm db:start` from the repo root.',
      { cause: error },
    );
  }
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const apiUrl = status.API_URL;
  const anonKey = status.ANON_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(`Unexpected \`supabase status\` output: ${raw}`);
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

export default function setup(project: TestProject) {
  project.provide('stack', readStackConfig());
}
