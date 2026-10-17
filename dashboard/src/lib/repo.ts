// Link to a file in the GitHub repo when the base URL is known (REPO_URL, or Vercel's git env vars).
export function repoFileUrl(path: string): string | null {
  const explicit = process.env.REPO_URL?.replace(/\/$/, "");
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  const base = explicit ?? (owner && slug ? `https://github.com/${owner}/${slug}` : null);
  if (!base) return null;
  const branch = process.env.REPO_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? "main";
  return `${base}/blob/${branch}/${path}`;
}
