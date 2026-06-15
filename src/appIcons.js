const ICON_MODULES = import.meta.glob("./icons/*.svg", {
  eager: true,
  import: "default",
  query: "?raw",
});

const APP_ICONS = Object.fromEntries(
  Object.entries(ICON_MODULES).map(([path, svg]) => [
    path.split("/").pop().replace(".svg", ""),
    svg,
  ])
);

export function getAppIcon(iconName) {
  const iconSvg = APP_ICONS[iconName];
  if (iconSvg) return iconSvg;

  const message = `Missing app icon "${iconName}". Expected file: src/icons/${iconName}.svg`;
  if (import.meta.env.DEV) {
    throw new Error(message);
  }

  console.warn(message);
  return "";
}
