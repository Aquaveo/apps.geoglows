import { animate, onScroll, stagger, createScope } from "animejs";
import config from "../../apps.json";
import { ICONS } from "../icons.js";
import { getAppIcon } from "../appIcons.js";

const { apps: APPS } = config;
const visibleApps = APPS.filter((a) => !a.hidden && !a.disabled);

const APP_SHOWCASE = {
  rfs: {
    context: "Explore historical streamflow, real-time conditions, and 15-day forecasts for rivers worldwide.",
    images: [
      { src: "/showcase/hydroviewer-map.png", alt: "River network map of Europe with color-coded flow conditions" },
      { src: "/showcase/hydroviewer-forecast.png", alt: "River discharge forecast with uncertainty bands and predicted flow" },
    ],
  },
  ggst: {
    context: "Track changes in regional water storage using satellite gravity measurements from NASA's GRACE missions.",
    images: [
      { src: "/showcase/grace-map.png", alt: "Aquifer region with GRACE total water storage anomaly overlay" },
      { src: "/showcase/grace-timeseries.png", alt: "20-year groundwater anomaly time series with uncertainty bands" },
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
          <img src="${img.src}" alt="${img.alt}" loading="lazy"
            class="w-full rounded-2xl overflow-hidden" />
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
    <section class="scroll-section min-h-[80vh] flex items-center px-6 py-20">
      <div class="max-w-6xl mx-auto w-full">
        <div class="flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10 md:gap-14">
          ${imagesHtml}
          <div class="scroll-reveal ${isEven ? "md:text-left" : "md:text-right"} md:w-[380px] shrink-0" data-anim="slide" data-anim-dir="${textDir}">
            <div class="flex items-center gap-2 mb-4 ${isEven ? "" : "md:justify-end"}">
              <div class="p-2 rounded-xl ${app.iconClass} bg-blue-50 dark:bg-blue-500/10">
                ${iconSvg}
              </div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                ${app.tags[0] || "Tool"}
              </p>
            </div>
            <h2 class="font-display text-3xl md:text-4xl font-normal text-slate-800 dark:text-white mb-4">
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
    <a href="${href}"${target}
      class="glass-card p-6 md:p-8 rounded-2xl flex flex-col group relative overflow-hidden hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
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

export function renderAppsGrid() {
  return `
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
    <section class="scroll-section -mx-6 py-0">
      <div class="scroll-reveal relative overflow-hidden rounded-2xl" data-anim="scale">
        <img src="/showcase/hero-river-flow.jpg"
          alt="Aerial view of braided river delta patterns in Iceland"
          loading="eager"
          class="w-full h-[50vh] md:h-[65vh] object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <p class="font-display text-2xl md:text-4xl text-white max-w-3xl leading-snug mb-3">
            Advancing global water sustainability through open Earth observation data.
          </p>
          <p class="text-sm md:text-base text-white/70 max-w-xl">
            7 million river reaches. Daily forecasts. Historical streamflow data back to 1940.
          </p>
        </div>
      </div>
    </section>

    <section class="scroll-section py-6 md:py-10">
      <div class="relative">
        <div class="scroll-reveal" data-anim="slide" data-anim-dir="left">
          <div class="aspect-[16/9] rounded-2xl overflow-hidden md:w-[82%]">
            <img src="/showcase/hydrosos-global.png"
              alt="Global hydrological status map showing water conditions across all continents"
              loading="eager"
              class="w-full h-full object-cover" />
          </div>
          <p class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Global water status layers</p>
        </div>
        <div class="scroll-reveal relative z-10 -mt-16 md:-mt-24 ml-auto w-[70%] md:w-[55%]" data-anim="slide" data-anim-dir="right">
          <div class="aspect-[16/9] rounded-2xl overflow-hidden shadow-xl">
            <img src="/showcase/grace-map.png"
              alt="Aquifer region with GRACE total water storage anomaly overlay"
              loading="lazy"
              class="w-full h-full object-cover object-left" />
          </div>
          <p class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 text-right">Groundwater storage</p>
        </div>
      </div>
    </section>

    ${visibleApps.map((app, i) => createAppShowcase(app, i)).join("")}

    <section class="scroll-section min-h-[80vh] flex items-center px-6 py-20">
      <div class="max-w-6xl mx-auto w-full">
        <div class="flex flex-col md:flex-row items-center gap-10 md:gap-14">
          <div class="scroll-reveal flex-1 min-w-0 space-y-4" data-anim="slide" data-anim-dir="left">
            <img src="/showcase/aquiferx-map.png" alt="Well locations and aquifer boundaries with water table elevation mapping"
              loading="lazy" class="w-full rounded-2xl overflow-hidden" />
            <img src="/showcase/aquiferx-chart.png" alt="Water table elevation time series with interpolation and trend analysis"
              loading="lazy" class="w-full rounded-2xl overflow-hidden" />
          </div>
          <div class="scroll-reveal md:text-left md:w-[380px] shrink-0" data-anim="slide" data-anim-dir="right">
            <div class="flex items-center gap-2 mb-4">
              <span class="px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                Coming soon
              </span>
            </div>
            <h2 class="font-display text-3xl md:text-4xl font-normal text-slate-800 dark:text-white mb-4">
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

    <section class="scroll-section px-6 py-16">
      <div class="max-w-5xl mx-auto">
        <div class="scroll-reveal mb-10">
          <h2 class="font-display text-3xl text-slate-800 dark:text-white mb-2">
            Get started
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

  activeScope = createScope({
    mediaQueries: {
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
  }).add((self) => {
    if (self.matches.reduceMotion) {
      for (const el of document.querySelectorAll(".scroll-reveal")) {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      return;
    }

    for (const section of sections) {
      const reveals = section.querySelectorAll(".scroll-reveal");
      for (const el of reveals) {
        animateReveal(el, section);
      }
    }
  });
}
