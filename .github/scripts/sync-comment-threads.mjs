import { readFile } from 'node:fs/promises';

const repo = process.env.COMMENT_REPO;
const token = process.env.COMMENT_REPO_TOKEN;
if (!repo || !token) throw new Error('Configure COMMENT_REPO and COMMENT_REPO_TOKEN.');
const [owner, name] = repo.split('/');
if (!owner || !name || repo.split('/').length !== 2) throw new Error('COMMENT_REPO must be owner/repository.');
const manifest = JSON.parse(await readFile(`${process.env.RUNNER_TEMP}/comment-thread-manifest.json`, 'utf8'));
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'simple-blog-comment-thread-sync',
};

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Comment thread API request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

const entries = [];
for (let page = 1; ; page += 1) {
  const batch = await api(`https://api.github.com/repos/${owner}/${name}/issues?state=all&per_page=100&page=${page}`);
  entries.push(...batch.filter((entry) => !entry.pull_request));
  if (batch.length < 100) break;
}
for (const post of manifest) {
  if (entries.some((entry) => entry.title === post.title)) continue;
  await api(`https://api.github.com/repos/${owner}/${name}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: post.title, body: `Comments for ${post.title}\n\n<!-- blog-path:${post.title} -->` }),
  });
}
