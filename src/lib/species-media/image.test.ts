import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_SPECIES_IMAGE_BYTES, processSpeciesImage, SpeciesImageValidationError } from "./image.ts";

test("re-encodes a source into bounded WebP variants without embedded metadata", async () => {
  const source = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "#66745e" },
  })
    .jpeg({ quality: 92 })
    .withMetadata({ exif: { IFD0: { Artist: "Private field note" } } })
    .toBuffer();

  const output = await processSpeciesImage(source);
  assert.match(output.sourceSha256, /^[0-9a-f]{64}$/);
  assert.equal(output.renditions.avatar.width, 96);
  assert.equal(output.renditions.avatar.height, 96);
  assert.equal(output.renditions.card.width, 480);
  assert.equal(output.renditions.card.height, 320);
  assert.equal(output.renditions.profile.width, 1600);
  assert.equal(output.renditions.profile.height, 1067);

  for (const image of [output.master, ...Object.values(output.renditions)]) {
    const metadata = await sharp(image.buffer).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.iptc, undefined);
    assert.equal(metadata.xmp, undefined);
  }
});

test("refuses empty, oversized and non-image bodies", async () => {
  await assert.rejects(processSpeciesImage(Buffer.alloc(0)), (error: unknown) =>
    error instanceof SpeciesImageValidationError && error.code === "EMPTY");
  await assert.rejects(processSpeciesImage(Buffer.alloc(MAX_SPECIES_IMAGE_BYTES + 1)), (error: unknown) =>
    error instanceof SpeciesImageValidationError && error.code === "TOO_LARGE");
  await assert.rejects(processSpeciesImage(Buffer.from("not an image")), (error: unknown) =>
    error instanceof SpeciesImageValidationError && error.code === "INVALID");
});
