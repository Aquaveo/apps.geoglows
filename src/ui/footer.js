import config from "../../apps.json";

const { contributors: CONTRIBUTORS, sponsors: SPONSORS } = config;

export function renderFooter() {
  return `
    <footer class="mt-20 border-t border-slate-200 dark:border-slate-800 py-16 px-4 bg-white/50 dark:bg-transparent">
      <div class="max-w-6xl mx-auto text-center">
        <div class="mb-12">
          <p class="text-slate-500 text-xs mb-6 uppercase tracking-widest font-bold">
            A Collection of Work From
          </p>
          <div class="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            ${CONTRIBUTORS.map(
              (c) => `
              <span class="text-slate-800 dark:text-white font-bold text-lg md:text-xl hover:text-blue-600 dark:hover:text-blue-400 cursor-default transition-colors">
                ${c}
              </span>
            `
            ).join("")}
          </div>
        </div>

        <div class="mb-12">
          <p class="text-slate-500 text-xs mb-6 uppercase tracking-widest font-bold">
            Funded By
          </p>
          <div class="flex flex-wrap justify-center items-center gap-10 md:gap-16">
            ${SPONSORS.map(
              (s) => `
              <span class="text-slate-600 dark:text-slate-200 font-semibold text-base md:text-lg hover:text-blue-600 dark:hover:text-blue-400 cursor-default transition-colors">
                ${s}
              </span>
            `
            ).join("")}
          </div>
        </div>

        <div class="mt-16 pt-8 border-t border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-600 text-xs">
          <p>&copy; 2026 Global Water Intelligence Foundation.</p>
        </div>
      </div>
    </footer>
  `;
}
