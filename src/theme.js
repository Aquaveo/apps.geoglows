import { ICONS } from "./icons.js";

export function initTheme() {
  const stored = localStorage.getItem("theme");
  if (
    stored === "dark" ||
    (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeIcon();
}

export function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const isDark = document.documentElement.classList.contains("dark");
  btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
}
