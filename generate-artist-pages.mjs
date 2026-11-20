import { readFile, writeFile, mkdir } from 'node:fs/promises';

const PROJECT_ID = 'ВСТАВЬ_PROJECT_ID'; // из .firebaserc, поле projects.default
const SITE = 'https://992muz.ru';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function fetchArtists() {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'artistApplications' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
        limit: 5000
      }
    })
  });
  if (!res.ok) throw new Error('Firestore: ' + res.status + ' ' + await res.text());
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => {
    const f = r.document.fields || {};
    const s = k => f[k]?.stringValue || '';
    return {
      slug: s('slug'),
      name: s('nickname') || s('displayName') || 'Артист',
      genre: s('genre'),
      bio: s('cardBio'),
      photo: s('avatarUrl')
    };
  });
}

const template = await readFile('artists.html', 'utf8');
const all = await fetchArtists();
const artists = all.filter(a => a.slug && !/[\/\\]/.test(a.slug));
console.log(`Артистов: ${all.length}, со slug: ${artists.length}, пропущено: ${all.length - artists.length}`);

for (const a of artists) {
  const url = `${SITE}/artist/${encodeURIComponent(a.slug)}`;
  const bio = a.bio.replace(/\s+/g, ' ').trim();
  const title = `${a.name} — таджикский артист, треки и клипы | 992MUZ`;
  const desc = `${bio ? bio.slice(0, 150) + '… ' : ''}Слушайте треки и смотрите клипы ${a.name} на 992MUZ.`;
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: a.name,
    url,
    image: a.photo || undefined,
    description: bio ? bio.slice(0, 300) : undefined,
    genre: a.genre || undefined
  }).replace(/</g, '\\u003c');

  const head = `<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${a.photo ? `<meta property="og:image" content="${esc(a.photo)}">\n` : ''}<script type="application/ld+json">${ld}</script>
</head>`;
  const seoBlock = `<div class="wrap">
<div class="ah-h1"><h2>${esc(a.name)}</h2><p>${esc(bio.slice(0, 500))}</p></div>`;

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${url}">`)
    .replace('</head>', () => head)
    .replace('<div class="wrap">', () => seoBlock);

  await mkdir(`artist/${a.slug}`, { recursive: true });
  await writeFile(`artist/${a.slug}/index.html`, html);
}

const lastmod = new Date().toISOString().slice(0, 10);
const urls = artists.map(a => `  <url>
    <loc>${SITE}/artist/${encodeURIComponent(a.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');
await writeFile('sitemap-artists.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
console.log('Готово: папка artist/ и sitemap-artists.xml');