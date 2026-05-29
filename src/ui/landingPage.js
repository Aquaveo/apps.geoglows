import { animate, onScroll, stagger, createScope } from "animejs";
import config from "../../apps.json";
import { ICONS } from "../icons.js";
import { getAppIcon } from "../appIcons.js";
import { getRecentApps } from "../recentApps.js";

const { apps: APPS } = config;
const visibleApps = APPS.filter((a) => !a.hidden && !a.disabled);

const APP_SHOWCASE = {
  rfs: {
    context: "Explore historical streamflow, real-time conditions, and 15-day forecasts for rivers worldwide.",
    images: [
      { src: "/showcase/hydroviewer-map.png", alt: "River network map of Europe with color-coded flow conditions", w: 2117, h: 1132 },
      { src: "/showcase/hydroviewer-forecast.png", alt: "River discharge forecast with uncertainty bands and predicted flow", w: 1522, h: 573 },
    ],
  },
  ggst: {
    context: "Track changes in regional water storage using satellite gravity measurements from NASA's GRACE missions.",
    images: [
      { src: "/showcase/grace-map.png", alt: "Aquifer region with GRACE total water storage anomaly overlay", w: 2121, h: 825 },
      { src: "/showcase/grace-timeseries.png", alt: "20-year groundwater anomaly time series with uncertainty bands", w: 1988, h: 482 },
    ],
  },
};

let activeScope = null;

function createAppShowcase(app, index) {
  const iconSvg = getAppIcon(app.iconName);
  const showcase = APP_SHOWCASE[app.id];
  const context = showcase?.context || app.description;
  const images = showcase?.images || [];
  const isEven = index % 2 === 0;

  const imgDir = isEven ? "left" : "right";
  const textDir = isEven ? "right" : "left";

  const imagesHtml = images.length
    ? `
      <div class="scroll-reveal flex-1 min-w-0 space-y-4" data-anim="slide" data-anim-dir="${imgDir}">
        ${images
          .map(
            (img) => `
          <div class="aspect-[4/3] md:aspect-auto rounded-2xl overflow-hidden">
            <img src="${img.src}" alt="${img.alt}" loading="lazy"
              ${img.w ? `width="${img.w}" height="${img.h}"` : ""}
              class="w-full h-full object-cover md:h-auto md:object-contain" />
          </div>
        `,
          )
          .join("")}
      </div>
    `
    : `
      <div class="scroll-reveal shrink-0" data-anim="slide" data-anim-dir="${imgDir}">
        <div class="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center ${app.iconClass} bg-blue-50 dark:bg-blue-500/10">
          ${iconSvg}
        </div>
      </div>
    `;

  return `
    <section class="scroll-section md:min-h-[80vh] md:flex md:items-center px-6 py-12 md:py-20">
      <div class="max-w-6xl mx-auto w-full">
        <div class="flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10 md:gap-14">
          ${imagesHtml}
          <div class="scroll-reveal text-left ${isEven ? "md:text-left" : "md:text-right"} md:w-[380px] shrink-0" data-anim="slide" data-anim-dir="${textDir}">
            <div class="flex items-center gap-2 mb-4 ${isEven ? "" : "md:justify-end"}">
              <div class="p-2 rounded-xl ${app.iconClass} bg-blue-50 dark:bg-blue-500/10">
                ${iconSvg}
              </div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                ${app.tags[0] || "Tool"}
              </p>
            </div>
            <h2 class="font-display text-2xl md:text-4xl font-normal text-slate-800 dark:text-white mb-3 md:mb-4">
              ${app.name}
            </h2>
            <p class="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              ${context}
            </p>
            <a href="${app.path}"
              class="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg px-1 py-0.5 -mx-1">
              Open ${app.name.split(" ")[0]}
              ${ICONS.arrowUpRight}
            </a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function createAppCard(app) {
  const iconSvg = getAppIcon(app.iconName);
  const href = app.type === "external" ? app.url : app.path;
  const target =
    app.type === "external" ? ' target="_blank" rel="noopener noreferrer"' : "";

  return `
    <a href="${href}"${target} data-app-id="${app.id}"
      class="glass-card p-5 md:p-8 rounded-2xl flex flex-col group relative overflow-hidden hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <div class="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
        ${ICONS.arrowUpRight}
      </div>
      <div class="mb-5 p-3 bg-blue-100 dark:bg-blue-500/10 rounded-xl w-fit group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20 transition-colors ${app.iconClass}">
        ${iconSvg}
      </div>
      <h3 class="font-display text-xl text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        ${app.name}
      </h3>
      <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 grow">
        ${app.description}
      </p>
      <div class="flex flex-wrap gap-2 mt-auto">
        ${app.tags
          .map(
            (tag) => `
          <span class="text-xs text-slate-500 dark:text-slate-400">
            ${tag}
          </span>
        `,
          )
          .join("")}
      </div>
    </a>
  `;
}

function renderRecentApps() {
  const recent = getRecentApps();
  if (!recent.length) return "";
  const recentCards = recent
    .map((r) => visibleApps.find((a) => a.id === r.id))
    .filter(Boolean)
    .map(createAppCard);
  if (!recentCards.length) return "";
  return `
    <section class="mb-12">
      <p class="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-4">Recent</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${recentCards.join("")}
      </div>
    </section>
  `;
}

export function renderAppsGrid() {
  return `
    ${renderRecentApps()}
    <section>
      <div class="mb-6">
        <h2 class="font-display text-3xl text-slate-800 dark:text-white">
          App Library
        </h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Explore GEOGLOWS applications for forecasting, groundwater, and water intelligence workflows.
        </p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${visibleApps.map(createAppCard).join("")}
      </div>
    </section>
  `;
}

export function renderLandingPage() {
  return `
    <div class="ticker-ribbon -mx-6 overflow-hidden bg-slate-800 dark:bg-slate-950 py-2 mb-8" aria-hidden="true">
      <div class="ticker-track flex gap-12 whitespace-nowrap text-xs font-mono tracking-wider text-slate-400">
        <span>47° 22' 41" N, 8° 32' 33" E · ZURICH</span>
        <span>GLOBAL WATER INTELLIGENCE</span>
        <span>23° 33' 0" S, 46° 38' 0" W · SÃO PAULO</span>
        <span>7M+ RIVER REACHES</span>
        <span>35° 41' 22" N, 139° 41' 30" E · TOKYO</span>
        <span>DAILY FORECASTS</span>
        <span>30° 2' 44" N, 31° 14' 8" E · CAIRO</span>
        <span>DATA BACK TO 1940</span>
        <span>47° 22' 41" N, 8° 32' 33" E · ZURICH</span>
        <span>GLOBAL WATER INTELLIGENCE</span>
        <span>23° 33' 0" S, 46° 38' 0" W · SÃO PAULO</span>
        <span>7M+ RIVER REACHES</span>
        <span>35° 41' 22" N, 139° 41' 30" E · TOKYO</span>
        <span>DAILY FORECASTS</span>
        <span>30° 2' 44" N, 31° 14' 8" E · CAIRO</span>
        <span>DATA BACK TO 1940</span>
      </div>
    </div>

    <section class="scroll-section -mx-6 py-0">
      <div class="scroll-reveal relative overflow-hidden rounded-2xl" data-anim="scale">
        <img src="/showcase/hero-river-network.png"
          alt="Global river network map showing GEOGLOWS streamflow monitoring coverage across all continents"
          loading="eager" width="1626" height="887"
          class="w-full h-[60vh] md:h-[80vh] object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-800/90 via-slate-800/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <p class="font-display text-xl md:text-4xl text-white max-w-3xl leading-snug mb-2 md:mb-3">
            Advancing global water sustainability through open Earth observation data.
          </p>
          <p class="text-xs md:text-base text-white/70 max-w-xl">
            7 million river reaches. Daily forecasts. Historical streamflow data back to 1940.
          </p>
        </div>
      </div>
    </section>

    <section class="scroll-section px-6 py-12">
      <div class="max-w-5xl mx-auto">
        <div class="scroll-reveal mb-8" data-anim="slide" data-anim-dir="left">
          <h2 class="font-display text-3xl text-slate-800 dark:text-white mb-2">
            Explore
          </h2>
          <p class="text-slate-600 dark:text-slate-400 max-w-xl">
            Choose a tool and begin exploring. Create an account for personalized features.
          </p>
        </div>
        <div class="scroll-reveal grid grid-cols-1 md:grid-cols-2 gap-6" data-anim="cascade">
          ${visibleApps.map(createAppCard).join("")}
        </div>
      </div>
    </section>

    <section class="scroll-section py-12 md:py-24">
      <div class="scroll-reveal max-w-4xl mx-auto text-center px-6" data-anim="scale">
        <p class="font-display text-2xl md:text-5xl text-slate-800 dark:text-white leading-tight">
          Don't just monitor water.
        </p>
        <p class="font-display text-2xl md:text-5xl text-blue-600 dark:text-blue-400 leading-tight">
          Understand it.
        </p>
      </div>
    </section>

    ${visibleApps.map((app, i) => createAppShowcase(app, i)).join("")}

    <section class="scroll-section md:min-h-[80vh] md:flex md:items-center px-6 py-12 md:py-20">
      <div class="max-w-6xl mx-auto w-full">
        <div class="flex flex-col md:flex-row items-center gap-10 md:gap-14">
          <div class="scroll-reveal flex-1 min-w-0 space-y-4" data-anim="slide" data-anim-dir="left">
            <div class="aspect-[4/3] md:aspect-auto rounded-2xl overflow-hidden">
              <img src="/showcase/aquiferx-map.png" alt="Well locations and aquifer boundaries with water table elevation mapping"
                loading="lazy" width="1750" height="864" class="w-full h-full object-cover md:h-auto md:object-contain" />
            </div>
            <div class="aspect-[4/3] md:aspect-auto rounded-2xl overflow-hidden">
              <img src="/showcase/aquiferx-chart.png" alt="Water table elevation time series with interpolation and trend analysis"
                loading="lazy" width="1747" height="545" class="w-full h-full object-cover md:h-auto md:object-contain" />
            </div>
          </div>
          <div class="scroll-reveal md:text-left md:w-[380px] shrink-0" data-anim="slide" data-anim-dir="right">
            <div class="flex items-center gap-2 mb-4">
              <span class="px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                Coming soon
              </span>
            </div>
            <h2 class="font-display text-2xl md:text-4xl font-normal text-slate-800 dark:text-white mb-3 md:mb-4">
              Aquifer Analyst
            </h2>
            <p class="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Map well networks, visualize water table elevations, and analyze groundwater trends across aquifer regions.
            </p>
            <p class="text-sm text-slate-400 dark:text-slate-600">
              Currently in development. Stay tuned for the public release.
            </p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildAnimations(el) {
  const anim = el.dataset.anim;
  const dir = el.dataset.animDir;

  if (anim === "scale") {
    return [animate(el, {
      opacity: [0, 1], scale: [0.92, 1],
      duration: 1000, ease: "out(4)", autoplay: false,
    })];
  }

  if (anim === "slide") {
    const xFrom = dir === "right" ? "3rem" : dir === "left" ? "-3rem" : "0rem";
    return [animate(el, {
      opacity: [0, 1], x: [xFrom, "0rem"], y: ["1rem", "0rem"],
      duration: 900, ease: "out(4)", autoplay: false,
    })];
  }

  if (anim === "cascade") {
    const anims = [];
    const children = el.children;
    if (children.length) {
      anims.push(animate(children, {
        opacity: [0, 1], y: ["2rem", "0rem"], scale: [0.96, 1],
        duration: 700, delay: stagger(150), ease: "out(3)", autoplay: false,
      }));
    }
    anims.push(animate(el, { opacity: [0, 1], duration: 100, ease: "out(3)", autoplay: false }));
    return anims;
  }

  return [animate(el, {
    opacity: [0, 1], y: ["2rem", "0rem"],
    duration: 800, ease: "out(3)", autoplay: false,
  })];
}

function animateReveal(el, section) {
  const anims = buildAnimations(el);
  let revealed = false;

  onScroll({
    target: section,
    enter: "bottom top",
    leave: "top bottom",
    onEnter: () => {
      if (!revealed) {
        revealed = true;
        for (const a of anims) a.restart();
      }
    },
    onLeave: () => {
      if (revealed) {
        revealed = false;
        for (const a of anims) { a.reverse(); a.restart(); }
      }
    },
  });
}

export function initScrollAnimations() {
  if (activeScope) {
    activeScope.revert();
    activeScope = null;
  }

  const sections = document.querySelectorAll(".scroll-section");
  if (!sections.length) return;

  const allReveals = document.querySelectorAll(".scroll-reveal");

  activeScope = createScope({
    mediaQueries: {
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
  }).add((self) => {
    if (self.matches.reduceMotion) {
      for (const el of allReveals) {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      return;
    }

    for (const el of allReveals) el.classList.add("anim-ready");

    for (const section of sections) {
      const reveals = section.querySelectorAll(".scroll-reveal");
      for (const el of reveals) {
        animateReveal(el, section);
      }
    }
  });
}
