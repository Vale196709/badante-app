// Copia in public/ocr i file per leggere le ricevute dalle foto (Tesseract, lingua italiana),
// così l'app li scarica dal proprio sito e non da servizi esterni.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dir = (pkg) => dirname(require.resolve(`${pkg}/package.json`));
const dest = new URL('../public/ocr/', import.meta.url).pathname;
mkdirSync(join(dest, 'lang'), { recursive: true });

const copia = (da, a) => { copyFileSync(da, join(dest, a)); };
copia(join(dir('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js');
for (const v of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copia(join(dir('tesseract.js-core'), v), v);
}
const lingua = join(dir('@tesseract.js-data/ita'), '4.0.0_best_int/ita.traineddata.gz');
if (!existsSync(lingua)) throw new Error('Dati della lingua italiana per l\'OCR non trovati');
copia(lingua, 'lang/ita.traineddata.gz');
console.log('File OCR copiati in public/ocr');
