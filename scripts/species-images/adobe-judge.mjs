/**
 * Adobe Stock search results judged by the same identity rules as an Unsplash
 * caption: the contributor's title must name the exact species.
 *   node scripts/species-images/adobe-judge.mjs <candidates.json>
 * candidates.json: { "<slug>": [{ "id", "t", "w", "h", "th" }] }
 */
import { readFileSync } from "node:fs";
import { speciesIdentityCatalogue } from "../../src/lib/species-media/provider/catalogue.ts";
import { verifyCandidate, compareCandidates, publishable } from "../../src/lib/species-media/provider/verify.ts";

const catalogue = speciesIdentityCatalogue();
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const result = {};
for (const [slug, items] of Object.entries(input)) {
  const identity = catalogue.identities.get(`species:${slug}`);
  const verdicts = items.map((item, rank) => verifyCandidate({
    provider: "unsplash", id: item.id, description: item.t, altDescription: null,
    width: item.w, height: item.h, likes: 0,
    // Adobe assets are licensed and stored by us, so the host check does not apply.
    imageUrl: "https://images.unsplash.com/adobe", thumbUrl: item.th, photographerName: "", photographerProfileUrl: "",
    sourcePageUrl: "", downloadLocation: "", sponsored: false, query: "", rank,
  }, identity, catalogue.lexicon)).filter(publishable).sort(compareCandidates);
  result[slug] = verdicts.slice(0, 3).map((v) => ({ id: v.candidate.id, status: v.status, t: v.candidate.description, w: v.candidate.width, h: v.candidate.height, th: v.candidate.thumbUrl }));
}
console.log(JSON.stringify(result));
