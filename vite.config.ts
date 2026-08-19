import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "preserve-cobranza-active-month",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/src/pages/InsuranceCollections.tsx")) return null;

        const original = `const loadCloudSnapshot = async () => {`;
        const replacement = `const loadCloudSnapshot = async (preserveActiveMonth = false) => {\n    const localActiveMonth = activeMonth;`;
        const originalApply = `applyCloudSnapshot(data.data as Partial<CloudSnapshot>);\n    setLastCloudLoadedAt`;
        const replacementApply = `applyCloudSnapshot(data.data as Partial<CloudSnapshot>);\n    if (preserveActiveMonth) setActiveMonth(localActiveMonth);\n    setLastCloudLoadedAt`;
        const originalTimer = `void loadCloudSnapshot();\n    }, 30000);`;
        const replacementTimer = `void loadCloudSnapshot(true);\n    }, 30000);`;

        if (!code.includes(original) || !code.includes(originalApply) || !code.includes(originalTimer)) {
          this.warn("No se pudo aplicar el parche de sincronizacion del mes activo.");
          return null;
        }

        return {
          code: code
            .replace(original, replacement)
            .replace(originalApply, replacementApply)
            .replace(originalTimer, replacementTimer),
          map: null,
        };
      },
    },
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
