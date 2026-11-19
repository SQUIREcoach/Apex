// Generates one static HTML page per language (index.html, ca/, en/),
// plus robots.txt and sitemap.xml. Runs before `vite` and `vite build`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from '../site.config.mjs';
import { renderPage } from '../src/template.js';
import es from '../src/i18n/es.js';
import ca from '../src/i18n/ca.js';
import en from '../src/i18n/en.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dict = { es, ca, en };

for (const l of cfg.languages) {
  const file = resolve(root, l.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(dict[l.code], cfg, l.code));
  console.log('page', l.code, '→', file.replace(root + '/', ''));
}

writeFileSync(
  resolve(root, 'public/robots.txt'),
  cfg.indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`
    : `# Staging build: not for indexing\nUser-agent: *\nDisallow: /\n`,
);

const today = new Date().toISOString().slice(0, 10);
const urls = cfg.languages
  .map(
    (l) => `  <url>
    <loc>${cfg.siteUrl}/${l.path}</loc>
    <lastmod>${today}</lastmod>
${cfg.languages.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${cfg.siteUrl}/${a.path}"/>`).join('\n')}
  </url>`,
  )
  .join('\n');
writeFileSync(
  resolve(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`,
);
