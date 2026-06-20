export const isCollectionsApp = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname.includes("cobranza-tres-provincias")
    || window.location.pathname.startsWith("/cobranza");
};
