// src/main.js
import './style.css';
import config from '../apps.json';
import { ensureProfile } from "./profile.js";
import {
  signInRedirect,
  signOutRedirect,
  completeSignInIfNeeded,
  getCurrentUser,
  clearStaleAuthState,
  setupTokenRenewal
} from "./auth.js";
import { inject } from "@vercel/analytics"
import { injectSpeedInsights } from '@vercel/speed-insights';

const { apps: TOOLS, contributors: CONTRIBUTORS, sponsors: SPONSORS } = config;
const ICON_MODULES = import.meta.glob('./icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?raw'
});
const APP_ICONS = Object.fromEntries(
  Object.entries(ICON_MODULES).map(([path, svg]) => [path.split('/').pop().replace('.svg', ''), svg])
);

const ICONS = {
  droplet: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-blue-500 animate-pulse"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  arrowUpRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-blue-500"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`
};

function getAppIcon(iconName) {
  const iconSvg = APP_ICONS[iconName];
  if (iconSvg) return iconSvg;

  const message = `Missing app icon "${iconName}". Expected file: src/icons/${iconName}.svg`;
  if (import.meta.env.DEV) {
    throw new Error(message);
  }
  console.warn(message);
  return '';
}

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isDark = document.documentElement.classList.contains('dark');
    btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
  }
}

function createToolCard(tool) {
  const iconSvg = getAppIcon(tool.iconName);
  const href = tool.type === 'external' ? tool.url : tool.path;
  const target = tool.type === 'external' ? ' target="_blank" rel="noopener noreferrer"' : '';

  return `
    <a href="${href}"${target} class="glass-card p-8 rounded-2xl flex flex-col h-full group relative overflow-hidden">
      <div class="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
        ${ICONS.arrowUpRight}
      </div>
      <div class="mb-6 p-3 bg-blue-100 dark:bg-blue-500/10 rounded-xl w-fit group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20 transition-colors ${tool.iconClass}">
        ${iconSvg}
      </div>
      <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        ${tool.name}
      </h3>
      <p class="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 grow">
        ${tool.description}
      </p>
      <div class="flex flex-wrap gap-2 mt-auto">
        ${tool.tags.map(tag => `
          <span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-300 border border-blue-200 dark:border-slate-700">
            ${tag}
          </span>
        `).join('')}
      </div>
    </a>
  `;
}

function renderAuthAction(user) {
  if (user) {
    const email = user.profile?.email || "Signed in";
    return `
      <div class="flex items-center gap-3">
        <span class="hidden md:inline text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          ${email}
        </span>
        <button
          id="signOut"
          class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
          aria-label="Sign Out"
        >
          Log out
        </button>
      </div>
    `;
  }

  return `
    <button
      id="signIn"
      class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
      aria-label="Sign In"
    >
      Sign In
    </button>
  `;
}


function render(user) {
  document.querySelector('#app').innerHTML = `
    <div class="min-h-screen text-slate-800 dark:text-slate-200 water-mesh flex flex-col">
      <!-- Navigation Header -->
      <nav class="w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 py-8 md:py-12">
        <div class="max-w-7xl mx-auto px-6 flex flex-col items-center text-center relative">

        <div class="absolute right-6 top-0 flex items-center gap-3">
          ${renderAuthAction(user)}

          <button
            id="theme-toggle"
            class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="Toggle theme"
          >
            ${ICONS.moon}
          </button>
        </div>
          

          <div class="flex items-center gap-3 mb-6">
            ${ICONS.droplet}
            <span class="font-bold text-xl tracking-wider text-blue-600 dark:text-slate-400 uppercase">GEOGLOWS</span>
          </div>

          <h1 class="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-tight">
            <span class="gradient-text">Global Water Intelligence</span>
          </h1>

          <p class="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
            Empowering individuals and organizations to solve local water challenges with global water intelligence.
          </p>
        </div>
      </nav>

      <!-- Tools Grid -->
      <main class="max-w-7xl mx-auto px-6 py-10 grow">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${TOOLS.map(createToolCard).join('')}
        </div>
      </main>

      <!-- Footer -->
      <footer class="mt-20 border-t border-slate-200 dark:border-slate-800 py-16 px-4 bg-white/50 dark:bg-transparent">
        <div class="max-w-6xl mx-auto text-center">
          <div class="mb-12">
            <p class="text-slate-500 text-xs mb-6 uppercase tracking-widest font-bold">
              A Collection of Work From
            </p>
            <div class="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              ${CONTRIBUTORS.map(c => `
                <span class="text-slate-800 dark:text-white font-bold text-lg md:text-xl hover:text-blue-600 dark:hover:text-blue-400 cursor-default transition-colors">
                  ${c}
                </span>
              `).join('')}
            </div>
          </div>

          <div class="mb-12">
            <p class="text-slate-500 text-xs mb-6 uppercase tracking-widest font-bold">
              Funded By
            </p>
            <div class="flex flex-wrap justify-center items-center gap-10 md:gap-16">
              ${SPONSORS.map(s => `
                <span class="text-slate-600 dark:text-slate-200 font-semibold text-base md:text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-default transition-colors">
                  ${s}
                </span>
              `).join('')}
            </div>
          </div>

          <div class="mt-16 pt-8 border-t border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-600 text-xs">
            <p>&copy; 2026 Global Water Intelligence Foundation.</p>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Set up theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById("signIn")?.addEventListener("click", signInRedirect);
  document.getElementById("signInMain")?.addEventListener("click", signInRedirect);
  document.getElementById("signOut")?.addEventListener("click", signOutRedirect);
  updateThemeIcon();
}

// Initialize theme before render to prevent flash
async function initApp() {
  initTheme();
  setupTokenRenewal();  
  await clearStaleAuthState();

  try {
    await completeSignInIfNeeded();
  } catch (error) {
    console.error("Failed to complete sign-in callback:", error);
  }

  const user = await getCurrentUser();

  if (user) {
    try {
      await ensureProfile();
    } catch (error) {
      console.error("Profile bootstrap failed:", error);
    }
  }

  render(user);
}

initApp();
inject();
injectSpeedInsights();
