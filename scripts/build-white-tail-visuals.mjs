import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "public", "White tail deer");
const outputDir = path.join(root, "public", "species-authority", "white-tailed-deer");

const originals = [
  ["white-tailed-deer-identification-buck.webp", "identification-buck.webp"],
  ["white-tailed-deer-vs-mule-deer.webpg.png", "white-tail-vs-mule-deer.webp"],
  ["white-tailed-deer-bedding habitat.webp", "bedding-habitat.webp"],
  ["white-tailed-deer-feeding-habitat.webp", "feeding-habitat-by-season.webp"],
  ["white-tailed-deer-travel-corridor.webp", "travel-corridor.webp"],
  ["white-tailed-deer-antler-rub.webp", "antler-rub.webp"],
  ["white-tailed-deer-bed.webp", "bed.webp"],
  ["white-tailed-deer-browsed-vegitation.webp", "browsed-vegetation.webp"],
  ["white-tailed-deer-scat.webp", "scat.webp"],
  ["white-tailed-deer-track-patterns.webp", "track-patterns.webp"],
  ["white-tailed-deer-shot-broadside-external.webp", "shot-broadside-external.webp"],
];

await mkdir(outputDir, { recursive: true });

for (const [source, output] of originals) {
  await sharp(path.join(sourceDir, source))
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(path.join(outputDir, output));
}

const feeding = path.join(sourceDir, "white-tailed-deer-feeding-habitat.webp");
for (const [season, left] of [["spring", 0], ["summer", 384], ["fall", 768], ["winter", 1152]]) {
  await sharp(feeding)
    .extract({ left, top: 85, width: 384, height: 939 })
    .resize({ width: 768, withoutEnlargement: false })
    .webp({ quality: 84, effort: 6 })
    .toFile(path.join(outputDir, `diet-${season}.webp`));
}

const quarteringAway = path.join(sourceDir, "white-tailed-deer-shot-quartering-away-anatomy.webp");
await sharp(quarteringAway)
  .extract({ left: 0, top: 0, width: 766, height: 1024 })
  .webp({ quality: 84, effort: 6 })
  .toFile(path.join(outputDir, "shot-quartering-away-external.webp"));
await sharp(quarteringAway)
  .extract({ left: 770, top: 0, width: 766, height: 1024 })
  .webp({ quality: 84, effort: 6 })
  .toFile(path.join(outputDir, "shot-quartering-away-anatomy.webp"));

console.log(`Built ${originals.length + 6} optimized White-tail authority visuals in ${outputDir}`);
