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
  assert.match(home, /<title>North Ground Bushcraft \| Canadian Outdoor Knowledge<\/title>/i);
  assert.match(
    home,
    /<link rel="canonical" href="https:\/\/www\.northgroundbushcraft\.com\/?"/i,
    "canonical should ignore query parameters",
  );
  assert.match(home, /<meta name="description" content="Canadian outdoor knowledge from North Ground\. Find your hunting zone and check seasons with North Ground Hunt, and explore game species across Canada\."/i);
  assert.match(home, /<meta property="og:title" content="North Ground/i);
  assert.match(home, /<meta property="og:image" content="https:\/\/www\.northgroundbushcraft\.com\/opengraph-image/i);
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
  assert.match(robots, /Sitemap: https:\/\/www\.northgroundbushcraft\.com\/sitemap\.xml/i);

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200, "sitemap.xml should return 200");
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/<\/loc>/i);
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/hunting\/species\/ruffed-grouse<\/loc>/i);
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/hunting\/species\/eastern-wolf<\/loc>/i);
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/hunting\/species\/canvasback<\/loc>/i);
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/hunting<\/loc>/i, "sitemap should contain the canonical Hunting hub");
  assert.match(sitemap, /<loc>https:\/\/www\.northgroundbushcraft\.com\/hunt<\/loc>/i);
  assert.doesNotMatch(
    sitemap,
    /<loc>https:\/\/www\.northgroundbushcraft\.com\/tools\/season-finder<\/loc>/i,
    "the superseded Hunt path must not remain in the sitemap",
  );
  /* Home, Hunting hub, Hunt, the species library, and one page per published
     species — counted from the research registry, which the repository test
     proves is exactly the published set. */
  const { readFileSync } = await import("node:fs");
  const speciesCount = readFileSync(new URL("../research/hunting/species-master.csv", import.meta.url), "utf8").trim().split("\n").length - 1;
  /* Season pages are generated from the certified rules, so their count is
     not typed here: every one listed must serve a real dated answer, and the
     sitemap may hold nothing else beyond the fixed pages and the species. */
  const seasonUrls = [...sitemap.matchAll(/<loc>https:\/\/www\.northgroundbushcraft\.com(\/hunting\/(?!species\b|how-north-ground-verifies\b)[a-z-]+(?:\/[a-z-]+)?)<\/loc>/gi)].map((match) => match[1]);
  assert.ok(seasonUrls.some((path) => path === "/hunting/ontario"), "the sitemap lists the province season pages");
  assert.ok(seasonUrls.some((path) => path === "/hunting/ontario/ruffed-grouse"), "the sitemap lists species season pages");
  assert.match(sitemap, /\/hunting\/how-north-ground-verifies<\/loc>/, "the sitemap lists the methodology page");
  assert.equal(countMatches(sitemap, /<url>/gi), 5 + speciesCount + seasonUrls.length, `sitemap should contain the fixed pages, ${speciesCount} species pages and ${seasonUrls.length} season pages, and nothing else`);
  for (const path of seasonUrls) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should return 200`);
    const html = await response.text();
    assert.equal(countMatches(html, /<h1\b/gi), 1, `${path} has one H1`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://www\\.northgroundbushcraft\\.com${path}"`), `${path} is its own canonical`);
    assert.match(html, /"@type":"FAQPage"/, `${path} carries its FAQ`);
    assert.match(html, /"@type":"BreadcrumbList"/, `${path} carries breadcrumbs`);
    assert.match(html, /As of [A-Z][a-z]+ \d{1,2}, \d{4}/, `${path} dates its answer in the HTML`);
  }
  const missingSeason = await fetch(`${baseUrl}/hunting/ontario/unicorn`);
  assert.equal(missingSeason.status, 404, "a species with no certified rules has no season page");

  const llmsResponse = await fetch(`${baseUrl}/llms.txt`);
  assert.equal(llmsResponse.status, 200, "llms.txt should return 200");
  const llms = await llmsResponse.text();
  for (const path of seasonUrls) assert.ok(llms.includes(`https://www.northgroundbushcraft.com${path})`), `llms.txt lists ${path}`);

  const speciesResponse = await fetch(`${baseUrl}/hunting/species/ruffed-grouse`);
  assert.equal(speciesResponse.status, 200, "published species should return 200");
  const species = await speciesResponse.text();
  assert.match(species, /<h1[^>]*>Ruffed grouse<\/h1>/i);
  assert.match(species, /<link rel="canonical" href="https:\/\/www\.northgroundbushcraft\.com\/hunting\/species\/ruffed-grouse"/i);
  assert.match(species, /"@type":"Taxon"/i);
  assert.match(species, /Bonasa umbellus/i);
  /*
   * THE RULE, not the sentence that used to express it.
   *
   * This asserted the legacy page's copy, "Open this species in Hunt". The
   * durable requirement is §27's: a species page is species knowledge and
   * never answers legality itself, so it must hand the hunter to Hunt FOR THAT
   * SPECIES. §41A fixes that handoff as a URL contract — `/hunt?species=<id>`
   * — which is the part a renderer may not change. The wording is
   * presentation and the authority renderer's is different ("Check rules for a
   * place and date"), so asserting the old string would have failed on a page
   * that satisfies the rule more completely: it links the species map as well.
   */
  assert.match(species, /href="\/hunt\?species=ruffed-grouse"/i, "a species page must hand legality to Hunt for that species");

  const toolResponse = await fetch(`${baseUrl}/hunt`);
  assert.equal(toolResponse.status, 200, "Hunt tool should return 200");
  const tool = await toolResponse.text();
  assert.match(tool, /<h1[^>]*>Hunting zone and season finder for Canada<\/h1>/i);
  assert.match(tool, /<link rel="canonical" href="https:\/\/www\.northgroundbushcraft\.com\/hunt"/i);
  assert.equal(countMatches(tool, /<link rel="canonical"/gi), 1, "Hunt should emit one canonical tag");
  assert.match(tool, /<title>Hunting Zone (?:&|&amp;) Season Finder \| North Ground Hunt<\/title>/i);
  assert.match(tool, /<meta name="description" content="Find your hunting zone anywhere North Ground supports in Canada, check hunting seasons by species and date, and verify results against official government sources\."/i);
  assert.match(tool, /"@type":"WebApplication"/, "Hunt should describe itself as a web application");
  assert.match(tool, /"areaServed":\[\{"@type":"AdministrativeArea"/, "Hunt areaServed should be derived from rules-serving jurisdictions");
  assert.match(tool, /<meta property="og:title" content="Know Your Zone\. Know Your Season\. \| North Ground Hunt"/i);
  assert.match(tool, /<meta property="og:description" content="Explore Canadian hunting zones on an interactive map, choose your species and date, and check your hunt against official government sources\."/i);
  assert.match(tool, /<meta property="og:url" content="https:\/\/www\.northgroundbushcraft\.com\/hunt"/i);

  // The superseded path must keep working for anything already linking to it.
  const supersededResponse = await fetch(`${baseUrl}/tools/season-finder`, { redirect: "manual" });
  assert.equal(supersededResponse.status, 308, "the superseded Hunt path should redirect permanently");
  assert.equal(supersededResponse.headers.get("location"), "/hunt");
  assert.match(tool, /<meta property="og:site_name" content="North Ground"/i);
  assert.match(tool, /<meta property="og:image" content="https:\/\/www\.northgroundbushcraft\.com\/north-ground-hunt-social-card\.jpg"/i);
  assert.match(tool, /<meta property="og:image:alt" content="North Ground Hunt social preview showing hunting zones, current seasons, official sources and Hunt Brief sharing\."/i);
  assert.match(tool, /<meta name="twitter:card" content="summary_large_image"/i);
  assert.match(tool, /<meta name="twitter:title" content="Know Your Zone\. Know Your Season\. \| North Ground Hunt"/i);
  assert.match(tool, /<meta name="twitter:description" content="Explore Canadian hunting zones on an interactive map, choose your species and date, and check your hunt against official government sources\."/i);
  assert.match(tool, /<meta name="twitter:image" content="https:\/\/www\.northgroundbushcraft\.com\/north-ground-hunt-social-card\.jpg"/i);
  assert.match(tool, /<meta name="twitter:image:alt" content="North Ground Hunt social preview showing hunting zones, current seasons, official sources and Hunt Brief sharing\."/i);

  const huntImageResponse = await fetch(`${baseUrl}/north-ground-hunt-social-card.jpg`);
  assert.equal(huntImageResponse.status, 200, "Hunt social image should return 200");
  assert.match(huntImageResponse.headers.get("content-type") || "", /^image\/jpeg/i);
  assert.ok((await huntImageResponse.arrayBuffer()).byteLength > 0, "Hunt social image should not be empty");

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
