import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Pubblicata su https://vale196709.github.io/badante-app/
export default defineConfig({
  base: '/badante-app/',
  define: {
    __VERSIONE__: JSON.stringify(version),
    __DATA_BUILD__: JSON.stringify(new Date().toISOString()),
  },
});
