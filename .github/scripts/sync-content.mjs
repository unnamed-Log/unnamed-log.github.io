import { createHmac } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const temp = process.env.RUNNER_TEMP;
const outputFile = process.env.GITHUB_OUTPUT;
const owner = required('CONTENT_OWNER');
const repo = required('CONTENT_REPO');
const token = required('CONTENT_TOKEN');
const key = required('CONTENT_SYNC_KEY');
const contentDir = path.join(temp, 'content-sync-content');
const cacheDir = path.join(temp, 'content-sync-state');
const candidateFile = path.join(temp, 'content-sync-candidate');
const aboutFile = path.join(contentDir, 'about.md');
const manifestFile = path.join(temp, 'comment-thread-manifest.json');
let aboutSnapshot = null;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error('missing required configuration');
  return value;
}

function hmac(value) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function slugify(value) {
  const slug = value.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'entry';
}

function yamlString(value) {
  return JSON.stringify(value ?? '');
}

function extractMetadata(rawBody) {
  const match = rawBody.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) return { metadata: {}, body: rawBody };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z][\w-]*):\s*(.*?)\s*$/);
    if (!field) continue;
    const [, key, value] = field;
    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      metadata[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return { metadata, body: rawBody.slice(match[0].length) };
}

async function getPublishedContent() {
  const results = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`);
    url.searchParams.set('state', 'open');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'simple-blog-content-publisher',
      },
    });
    if (!response.ok) throw new Error('GitHub API request failed');
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Unexpected API response');
    results.push(...batch.filter((item) => !item.pull_request));
    if (batch.length < 100) break;
  }

  const entryMap = new Map(results.map((entry) => [entry.number, entry]));
  const aboutEntry = results
    .filter((entry) => (entry.labels ?? []).some((label) => label.name.toLowerCase() === 'content:about'))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
  aboutSnapshot = aboutEntry ? { body: aboutEntry.body ?? '', updated_at: aboutEntry.updated_at } : null;
  const published = results.flatMap((entry) => {
    const labels = (entry.labels ?? []).map((label) => label.name);
    if (!labels.includes('publish') || labels.some((label) => /^(draft|private|no-publish|content:about)$/i.test(label))) return [];
    const labelTags = labels
      .filter((label) => !/^(publish|draft|private|no-publish|content:about)$/i.test(label))
      .map((label) => label.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return [{
      number: entry.number,
      title: entry.title ?? 'Untitled',
      date: entry.created_at,
      body: entry.body ?? '',
      labelTags,
    }];
  });

  // Combine related content in chronological order; only the main entry supplies metadata.
  const nestedEntryNumbers = new Set();
  for (const article of published) {
    const descendants = [];
    const visited = new Set([article.number]);
    const queue = [article.number];
    while (queue.length) {
      const parentEntryNumber = queue.shift();
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${parentEntryNumber}/sub_issues?per_page=100`,
        { headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'simple-blog-content-publisher',
        } },
      );
      if (!response.ok) throw new Error('GitHub API request failed');
      const relatedEntries = await response.json();
      if (!Array.isArray(relatedEntries)) throw new Error('Unexpected API response');
      for (const nestedEntry of relatedEntries) {
        if (visited.has(nestedEntry.number)) continue;
        visited.add(nestedEntry.number);
        nestedEntryNumbers.add(nestedEntry.number);
        descendants.push(entryMap.get(nestedEntry.number) ?? nestedEntry);
        queue.push(nestedEntry.number);
      }
    }
    descendants.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.number - b.number);
    const rootEntryContent = extractMetadata(article.body);
    const metadata = rootEntryContent.metadata;
    article.title = metadata.title || article.title;
    article.date = metadata.date || article.date;
    article.slug = metadata.slug || `${slugify(article.title)}-${String(article.date).slice(0, 10)}`;
    article.description = metadata.description || '';
    article.tags = metadata.tags || article.labelTags;
    article.body = [rootEntryContent.body, ...descendants.map((nestedEntry) => extractMetadata(nestedEntry.body ?? '').body.trim())]
      .filter(Boolean).join('\n\n');
    article.nestedEntries = descendants.map((nestedEntry) => ({ number: nestedEntry.number, created_at: nestedEntry.created_at, body: nestedEntry.body ?? '' }));
  }

  if (aboutEntry) {
    const aboutContent = extractMetadata(aboutEntry.body ?? '').body;
    const aboutBody = [
      '---', 'title: "About"', 'layout: "about"', 'url: "/about/"', '---', '',
      aboutContent, '',
    ].join('\n');
    await writeFile(aboutFile, aboutBody, { mode: 0o600 });
  }

  return published.filter((article) => !nestedEntryNumbers.has(article.number)).sort((a, b) => a.number - b.number);
}

async function main() {
  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const articles = await getPublishedContent();
  await writeFile(manifestFile, JSON.stringify(articles.map((article) => ({
    title: `/posts/${slugify(article.slug)}/`, slug: slugify(article.slug),
  })), null, 2), { mode: 0o600 });
  const snapshot = JSON.stringify({ owner, repo, articles, aboutSnapshot });
  const digest = hmac(snapshot);
  const previousPath = path.join(cacheDir, 'snapshot.hmac');
  let previous = '';
  try { previous = (await readFile(previousPath, 'utf8')).trim(); } catch { /* First run. */ }
  const changed = digest !== previous;
  await writeFile(candidateFile, `${digest}\n`, { mode: 0o600 });

  if (changed) {
    for (const article of articles) {
      const entryId = hmac(`${owner}/${repo}#${article.number}`).slice(0, 12);
      const slug = slugify(article.slug);
      const frontMatter = [
        '---',
        `title: ${yamlString(article.title)}`,
        `date: ${yamlString(article.date)}`,
        `slug: ${yamlString(slug)}`,
        `tags: ${JSON.stringify(article.tags)}`,
        ...(article.description ? [`description: ${yamlString(article.description)}`] : []),
        '---',
        '',
        article.body,
        '',
      ].join('\n');
      await writeFile(path.join(contentDir, `${entryId}.md`), frontMatter, { mode: 0o600 });
    }
  }

  await appendFile(outputFile, `changed=${changed}\n`);
  console.log(changed ? 'Content snapshot changed.' : 'No content changes.');
}

main().catch(() => {
  console.error('Content synchronization failed; details are suppressed.');
  process.exitCode = 1;
});
