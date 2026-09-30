import { createSpeciesSurfaceHandler } from "../../../../lib/hunt/intelligence/handler.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The species surface layer.
 *
 * `GET /api/hunt/species-surface?speciesId=species:american-black-duck&bbox=w,s,e,n`
 *
 * The renderer's whole input: features with a score, the geometry kind they
 * really are, the declared resolution they may be drawn at, whether colour may
 * run between them, what unshaded ground means, the season the evidence
 * represents, and the provenance. Nothing about the drawing is decided here and
 * nothing about the evidence is decided in the renderer.
 */
export const GET = createSpeciesSurfaceHandler();
