import { defineConfig } from 'vite'

// L'applicazione vive in una sottocartella del dominio (www.fostinellistefano.it/DWG/),
// quindi i percorsi degli asset devono essere RELATIVI: con `base: '/'` il sito
// online cercherebbe /assets/... alla radice e non troverebbe niente.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Il file .wasm di LibreDWG pesa 9,5 MB (2,3 MB compressi) e sta in
    // public/wasm/: non passa da qui, viene copiato così com'è.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // libredwg sta in un chunk suo, caricato solo quando si apre un DWG.
        manualChunks(id) {
          if (id.includes('libredwg')) return 'libredwg'
          if (id.includes('jspdf')) return 'pdf'
          if (id.includes('dxf-parser')) return 'dxf'
        },
      },
    },
  },
})
