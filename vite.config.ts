import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Add this line to allow your ngrok domain
    allowedHosts: [
      'stumpiest-caudally-eloy.ngrok-free.dev', // your current ngrok link
      '.ngrok-free.dev',
      'https://genco-farm-1h7eluisr-daves-projects-129ce1a9.vercel.app/' // optional: allow all ngrok subdomains
    ],
  },
    build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
