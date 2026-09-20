import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = Number(process.env.SEO_VALIDATION_PORT || 3217);
const baseUrl = `http://${host}:${port}`;
const serverOutput = [];

function recordOutput(chunk) {
  serverOutput.push(chunk.toString());
  if (serverOutput.length > 40) serverOutput.shift();
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Next.js did not start in time.\n${serverOutput.join("")}`);
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

async function validate() {
  const homeResponse = await fetch(`${baseUrl}/?campaign=seo-check`);
  assert.equal(homeResponse.status, 200, "home should return 200");
  const home = await homeResponse.text();

  assert.match(home, /<html lang="en-CA"/i, "document language should be en-CA");
  assert.match(home, /<title>North Ground \| Northern fieldwork and practical skills<\/title>/i);
  assert.match(
    home,
    /<link rel="canonical" href="https:\/\/northgroundbushcraft\.com\/?"/i,
    "canonical should ignore query parameters",
  );
  assert.match(home, /<meta name="description" content="Outdoor fieldwork,/i);
  assert.match(home, /<meta property="og:title" content="North Ground/i);
  assert.match(home, /<meta property="og:image" content="https:\/\/northgroundbushcraft\.com\/opengraph-image/i);
  assert.match(home, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.equal(countMatches(home, /<h1\b/gi), 1, "home should have exactly one server-rendered H1");
  assert.match(home, /North Ground — northern fieldwork and practical skills/i);
  assert.match(home, /"@type":"Organization"/i);
  assert.match(home, /"@type":"WebSite"/i);

  const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsResponse.status, 200, "robots.txt should return 200");
  const robots = await robotsResponse.text();
  assert.match(robots, /User-Agent: \*/i);
  assert.match(robots, /Allow: \//i);
  assert.match(robots, /Disallow: \/api\//i);
  assert.match(robots, /Sitemap: https:\/\/northgroundbushcraft\.com\/sitemap\.xml/i);

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200, "sitemap.xml should return 200");
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /<loc>https:\/\/northgroundbushcraft\.com\/<\/loc>/i);
  assert.equal(countMatches(sitemap, /<url>/gi), 1, "sitemap should contain only the live homepage");

  const imageResponse = await fetch(`${baseUrl}/opengraph-image`);
  assert.equal(imageResponse.status, 200, "Open Graph image should return 200");
  assert.match(imageResponse.headers.get("content-type") || "", /^image\/png/i);

  const notFoundResponse = await fetch(`${baseUrl}/route-that-does-not-exist`);
  assert.equal(notFoundResponse.status, 404, "unknown route should return a real 404");
  const notFound = await notFoundResponse.text();
  assert.match(notFound, /<h1[^>]*>Page not found<\/h1>/i);
  assert.match(notFound, /<meta name="robots" content="noindex/i);
  assert.match(notFound, /href="\/"[^>]*>Return home<\/a>/i);

  const trailingSlashResponse = await fetch(`${baseUrl}/route-that-does-not-exist/`, {
    redirect: "manual",
  });
  assert.equal(trailingSlashResponse.status, 308, "trailing slash should redirect permanently");
  assert.equal(
    trailingSlashResponse.headers.get("location"),
    "/route-that-does-not-exist",
    "trailing slash should redirect to the canonical path",
  );
}

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", host, "--port", String(port)],
  { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);

server.stdout.on("data", recordOutput);
server.stderr.on("data", recordOutput);

try {
  await waitForServer();
  await validate();
  console.log("SEO validation passed: metadata, indexability, social image, sitemap, robots, 404, and redirects.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(serverOutput.join(""));
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
