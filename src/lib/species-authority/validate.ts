import { capabilitiesOf } from "../content/species-eligibility.ts";
import { AUTHORITY_SECTION_IDS, type AuthoritySection, type SpeciesAuthorityPage } from "./types.ts";

/**
 * The sections that assert a hunt, and may appear only where the species'
 * take eligibility permits a hunting guide at all.
 *
 * The gate is `capabilitiesOf(...).huntingGuideTitle`, which is the repository's
 * existing owner-sanctioned allowlist, not a second list declared here. It
 * already refuses LIMITED_TAKE for the reason written beside it: a species whose
 * only legal take is a quota in three counties must not be framed as a hunting
 * guide everywhere. Declaring a parallel list here would let the two drift.
 */
const HUNTING_SECTION_IDS = ["how-to-hunt", "shot-placement", "equipment"] as const;

export class SpeciesAuthorityValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Species authority page failed validation:\n- ${issues.join("\n- ")}`);
    this.name = "SpeciesAuthorityValidationError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function claimsOf(section: AuthoritySection) {
  return [...section.claims, ...(section.subsections ?? []).flatMap((item) => item.claims)];
}

export function validateSpeciesAuthorityPage(page: SpeciesAuthorityPage, publishedSpeciesIds?: ReadonlySet<string>): SpeciesAuthorityPage {
  const issues: string[] = [];
  /* Only the explorers a page actually declares. This read all five
     unconditionally, so a page without curated visuals threw a TypeError
     instead of failing validation — and a page without them is the majority. */
  const explorers = page.visualExplorers ?? {};
  const visualExplorers = [explorers.identification, explorers.habitat, explorers.diet, explorers.signs, explorers.shotPlacement].filter((explorer) => explorer !== undefined);
  const sections = new Map(page.sections.map((section) => [section.id, section]));
  const ids = [
    ...page.sections.map(({ id }) => id),
    ...page.sections.flatMap(({ subsections = [] }) => subsections.map(({ id }) => id)),
    ...page.faq.map(({ id }) => id),
  ];
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (new Set(page.sections.map(({ id }) => id)).size !== page.sections.length) issues.push("duplicate section ids");
  if (duplicates.length) issues.push(`duplicate section/FAQ ids: ${[...new Set(duplicates)].join(", ")}`);
  /*
   * SECTIONS FOLLOW CAPABILITY AND EVIDENCE, NEVER A FIXED LIST (§16).
   *
   * These three rules used to demand all fourteen ids in exact order, which had
   * two consequences. A species with no researched diet or sign could only
   * render those sections empty — and a NON_QUARRY page was impossible to build
   * at all, because the same rules required the three hunting anchors that the
   * rule below forbids. Both escapes were measured and both failed.
   *
   * What is kept is the part that protects the reader: no navigation anchor may
   * point at a section that is not rendered, no rendered section may be missing
   * from navigation, and the order a page does declare must follow the
   * canonical reading order rather than an arbitrary one.
   */
  for (const id of page.sectionOrder) if (!sections.has(id)) issues.push(`navigation points to missing #${id}`);
  for (const section of page.sections) if (!page.sectionOrder.includes(section.id)) issues.push(`#${section.id} is rendered but absent from navigation`);
  const canonical = AUTHORITY_SECTION_IDS.filter((id) => page.sectionOrder.includes(id));
  if (page.sectionOrder.join("|") !== canonical.join("|")) issues.push("section order does not follow the canonical reading order");
  /*
   * AN ASSERTED CLAIM CARRIES A SOURCE, OR IT IS NOT PUBLISHED.
   *
   * This validator checked the SHAPE of a citation that existed — that its
   * `sourceId` is prefixed and resolves — and was silent on a claim having
   * none. So `{ text: "Deer weigh 400 lb", citations: [] }` was accepted, and
   * so was a claim with empty text and a valid citation. That is the
   * fabrication hole sitting inside the rule meant to prevent it, and §16
   * requires runtime validation to reject malformed or missing citations.
   *
   * It matters most for what comes next: an adapter building pages for 485
   * species from existing profile prose must attach each claim's real source,
   * and without this rule an uncited assertion would ship on every one of them
   * while the page still looked sourced.
   */
  for (const section of page.sections) {
    for (const claim of claimsOf(section)) {
      if (!claim.text.trim()) issues.push(`claim ${claim.id} has no text`);
      if (!claim.citations.length) issues.push(`claim ${claim.id} asserts text with no citation`);
    }
  }
  for (const entry of page.faq) {
    if (!entry.citations.length) issues.push(`faq ${entry.id} answers with no citation`);
  }
  for (const section of page.sections) {
    if (!ID.test(section.id)) issues.push(`malformed section id ${section.id}`);
    /* `typeof` first, because this read `.trim()` on whatever was there: an
       adapter handing a non-string — a conservation statement object rather
       than its text — crashed the validator with a TypeError instead of
       producing an issue, which is the same shape as the explorer dereference. */
    if (typeof section.directAnswer !== "string" || !section.directAnswer.trim()) issues.push(`#${section.id} has no direct answer`);
    for (const subsection of section.subsections ?? []) {
      if (typeof subsection.directAnswer !== "string" || !subsection.directAnswer.trim()) issues.push(`#${subsection.id} has no direct answer`);
    }
  }
  /*
   * Hunting guidance appears only where the eligibility permits a hunting
   * guide. This checked NON_QUARRY alone, so an UNKNOWN species — take status
   * not established — could carry shot placement, and so could LIMITED_TAKE,
   * whose whole point is that a legal opportunity is narrow and conditional.
   */
  if (!capabilitiesOf(page.huntingCompatibility).huntingGuideTitle) {
    for (const id of HUNTING_SECTION_IDS) {
      if (sections.has(id)) issues.push(`a ${page.huntingCompatibility} page includes incompatible #${id} guidance`);
    }
  }

  const sourceIds = new Set(page.sources.map(({ id }) => id));
  if (sourceIds.size !== page.sources.length) issues.push("duplicate source ids");
  const cited = new Set<string>();
  const citations = [
    ...page.sections.flatMap((section) => claimsOf(section).flatMap(({ citations }) => citations)),
    ...page.faq.flatMap(({ citations }) => citations),
    ...page.facts.flatMap(({ sourceIds }) => sourceIds.map((sourceId) => ({ sourceId }))),
    ...visualExplorers.flatMap((explorer) => explorer.items.flatMap((item) => item.citations)),
  ];
  for (const citation of citations) {
    if (!citation.sourceId?.startsWith("source:")) issues.push(`malformed citation id ${citation.sourceId || "(empty)"}`);
    else if (!sourceIds.has(citation.sourceId)) issues.push(`citation references missing ${citation.sourceId}`);
    else cited.add(citation.sourceId);
  }
  for (const source of page.sources) {
    if (!cited.has(source.id)) issues.push(`orphan source ${source.id}`);
    if (!ISO_DATE.test(source.reviewedAt)) issues.push(`${source.id} has malformed reviewedAt`);
    try { if (new URL(source.url).protocol !== "https:") issues.push(`${source.id} must use HTTPS`); }
    catch { issues.push(`${source.id} has malformed URL`); }
  }
  if (!ISO_DATE.test(page.reviewedAt)) issues.push("page reviewedAt must be YYYY-MM-DD");

  for (const [kind, href] of Object.entries(page.huntLinks)) {
    let url: URL;
    try { url = new URL(href, "https://northgroundbushcraft.com"); }
    catch { issues.push(`${kind} Hunt link is malformed`); continue; }
    if (url.pathname !== "/hunt" || url.searchParams.get("species") !== page.slug) issues.push(`${kind} Hunt link is not canonical for ${page.slug}`);
    if (kind === "map" && url.searchParams.get("explore") !== "1") issues.push("map Hunt link must enter exploration mode");
  }
  for (const reference of page.speciesReferences) {
    if (reference.path !== `/hunting/species/${reference.speciesId.slice("species:".length)}`) issues.push(`broken canonical path for ${reference.speciesId}`);
    if (publishedSpeciesIds && !publishedSpeciesIds.has(reference.speciesId)) issues.push(`nonexistent species reference ${reference.speciesId}`);
  }
  const assetIds = new Set<string>();
  const renditionIds = new Set<string>();
  const approvedRenditions = new Set<string>();
  for (const asset of page.visualAssets) {
    if (assetIds.has(asset.id)) issues.push(`duplicate visual asset id ${asset.id}`);
    assetIds.add(asset.id);
    if (asset.width <= 0 || asset.height <= 0) issues.push(`${asset.id} has invalid intrinsic dimensions`);
    if (!asset.originalPath.startsWith("/White tail deer/")) issues.push(`${asset.id} has a non-canonical original path`);
    if (asset.status === "USED" && !asset.renditions?.length) issues.push(`${asset.id} is USED without a rendition`);
    if (asset.status !== "USED" && asset.renditions?.length) issues.push(`${asset.id} has publishable renditions despite ${asset.status}`);
    for (const rendition of asset.renditions ?? []) {
      if (renditionIds.has(rendition.id)) issues.push(`duplicate visual rendition id ${rendition.id}`);
      renditionIds.add(rendition.id);
      approvedRenditions.add(rendition.id);
      if (rendition.width <= 0 || rendition.height <= 0) issues.push(`${rendition.id} has invalid rendition dimensions`);
      if (!rendition.alt.trim() || !rendition.caption.trim()) issues.push(`${rendition.id} needs alt text and a caption`);
    }
  }
  const explorerIds = new Set<string>();
  for (const explorer of visualExplorers) {
    if (explorerIds.has(explorer.id)) issues.push(`duplicate explorer id ${explorer.id}`);
    explorerIds.add(explorer.id);
    if (!sections.has(explorer.sectionId)) issues.push(`${explorer.id} targets missing #${explorer.sectionId}`);
    if (!explorer.items.length) issues.push(`${explorer.id} has no items`);
    const itemIds = new Set<string>();
    for (const item of explorer.items) {
      if (itemIds.has(item.id)) issues.push(`${explorer.id} has duplicate item ${item.id}`);
      itemIds.add(item.id);
      const anatomyRenditionId = "anatomyRenditionId" in item && typeof item.anatomyRenditionId === "string" ? item.anatomyRenditionId : undefined;
      for (const renditionId of [item.renditionId, anatomyRenditionId]) {
        if (renditionId && !approvedRenditions.has(renditionId)) issues.push(`${explorer.id}/${item.id} references unavailable rendition ${renditionId}`);
      }
    }
  }
  if (issues.length) throw new SpeciesAuthorityValidationError(issues);
  return page;
}
