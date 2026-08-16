import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist/verify');
const sourceDirectory = join(outputDirectory, 'assets/node_modules');
const targetDirectory = join(outputDirectory, 'assets/vendor');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries.flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  ).then((nested) => nested.flat());
}

try {
  await rm(targetDirectory, { recursive: true, force: true });
  await rename(sourceDirectory, targetDirectory);
} catch (error) {
  if ((error).code === 'ENOENT') {
    throw new Error('Expo web assets were not found. Run npm run export:web before preparing Vercel.');
  }
  throw error;
}

const files = await walk(outputDirectory);
await Promise.all(
  files
    .filter((path) => path.endsWith('.html') || path.endsWith('.js'))
    .map(async (path) => {
      const content = await readFile(path, 'utf8');
      const updated = content.replaceAll('/assets/node_modules/', '/assets/vendor/');
      if (updated !== content) await writeFile(path, updated);
    }),
);

console.log(`Prepared ${relative(process.cwd(), outputDirectory)} for Vercel static hosting.`);
