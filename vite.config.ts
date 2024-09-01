import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const pkg = readJsonFile("package.json");
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    webExtension({
      browser: "firefox",
      manifest: generateManifest,
      watchFilePaths: ["package.json", "src"],
    }),
  ],
  build: {
    sourcemap: mode === "development",
    minify: mode !== "development",
  },
}));
