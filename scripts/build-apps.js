/**
 * Build all sub-apps listed in apps.json (type === "app") and copy their
 * output into the portal's dist/ directory at the configured sub-path.
 *
 * App-specific env vars are read from the environment using a prefix derived
 * from the app id (uppercased, hyphens → underscores). For example, for the
 * app with id "gwdm", set:
 *
 *   GWDM_VITE_OIDC_AUTHORITY=...
 *   GWDM_VITE_OIDC_CLIENT_ID=...
 *   GWDM_VITE_OIDC_REDIRECT_URI=...
 *   GWDM_VITE_OIDC_LOGOUT_URI=...
 *   GWDM_VITE_COGNITO_DOMAIN=...
 *
 * Shared vars (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) fall through
 * from the portal's own environment variables automatically.
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const config = JSON.parse(readFileSync(join(root, 'apps.json'), 'utf-8'));
const apps = config.apps.filter(a => a.type === 'app' && !a.disabled);

if (apps.length === 0) {
  console.log('No enabled sub-apps to build.');
  process.exit(0);
}

const TMP = join(root, '.build-apps-tmp');
if (existsSync(TMP)) rmSync(TMP, { recursive: true });
mkdirSync(TMP, { recursive: true });

let failed = false;

for (const app of apps) {
  const { id, repository, path: appPath, ref } = app;
  const appDir = join(TMP, id);
  const base = `${appPath}/`;

  try {
    // Clone
    console.log(`\n[${id}] Cloning https://github.com/${repository} ...`);
    const refFlag = ref ? `--branch "${ref}"` : '';
    execSync(
      `git clone --depth 1 ${refFlag} https://github.com/${repository}.git "${appDir}"`,
      { stdio: 'inherit' }
    );

    // Resolve env vars for this app
    const appEnv = resolveAppEnv(id);

    // Install
    console.log(`[${id}] Installing dependencies...`);
    execSync('npm install', { cwd: appDir, stdio: 'inherit' });

    // Build
    console.log(`[${id}] Building with base="${base}"...`);
    execSync(`npx vite build --base="${base}"`, {
      cwd: appDir,
      stdio: 'inherit',
      env: { ...process.env, ...appEnv },
    });

    // Copy dist → portal dist/<subpath>/
    const destDir = join(root, 'dist', appPath.replace(/^\//, ''));
    mkdirSync(destDir, { recursive: true });
    cpSync(join(appDir, 'dist'), destDir, { recursive: true });
    console.log(`[${id}] Copied to dist/${appPath.replace(/^\//, '')}/`);

  } catch (err) {
    console.error(`\n[${id}] Build failed:`, err.message);
    failed = true;
  }
}

rmSync(TMP, { recursive: true });

if (failed) {
  console.error('\nOne or more sub-app builds failed.');
  process.exit(1);
}

console.log('\nAll sub-apps built successfully.');

/**
 * Collect env vars for an app.
 * Prefix: app id uppercased with hyphens → underscores + "_".
 * e.g. "gwdm" → prefix "GWDM_"
 *
 * Shared Supabase vars fall through from the portal's own VITE_SUPABASE_* vars
 * if the app doesn't override them.
 */
function resolveAppEnv(id) {
  const prefix = id.toUpperCase().replace(/[-. ]/g, '_') + '_';
  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix)) {
      env[key.slice(prefix.length)] = value;
    }
  }

  // Fall-through: shared Supabase vars
  for (const shared of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
    if (!env[shared] && process.env[shared]) {
      env[shared] = process.env[shared];
    }
  }

  return env;
}
