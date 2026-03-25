import config from "../../apps.json";
import { ICONS } from "../icons.js";
import { getAppIcon } from "../appIcons.js";

const { apps: TOOLS } = config;

function createToolCard(tool) {
  const iconSvg = getAppIcon(tool.iconName);
  const href = tool.type === "external" ? tool.url : tool.path;
  const target =
    tool.type === "external" ? ' target="_blank" rel="noopener noreferrer"' : "";

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
        ${tool.tags
          .map(
            (tag) => `
          <span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-300 border border-blue-200 dark:border-slate-700">
            ${tag}
          </span>
        `
          )
          .join("")}
      </div>
    </a>
  `;
}

export function renderAppsPage() {
  return `
    <section class="mb-6">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Library
          </p>
          <h2 class="text-3xl font-bold text-slate-800 dark:text-white">
            App Library
          </h2>
          <p class="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
            Explore GEOGLOWS applications for forecasting, groundwater, and water intelligence workflows.
          </p>
        </div>
      </div>
    </section>

    <section>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${TOOLS.map(createToolCard).join("")}
      </div>
    </section>
  `;
}
