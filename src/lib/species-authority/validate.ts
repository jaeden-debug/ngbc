import { AUTHORITY_SECTION_IDS, type AuthoritySection, type SpeciesAuthorityPage } from "./types.ts";

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
  const sections = new Map(page.sections.map((section) => [section.id, section]));
  const ids = [
    ...page.sections.map(({ id }) => id),
    ...page.sections.flatMap(({ subsections = [] }) => subsections.map(({ id }) => id)),
    ...page.faq.map(({ id }) => id),
  ];
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (new Set(page.sections.map(({ id }) => id)).size !== page.sections.length) issues.push("duplicate section ids");
  if (duplicates.length) issues.push(`duplicate section/FAQ ids: ${[...new Set(duplicates)].join(", ")}`);
  for (const id of page.sectionOrder) if (!sections.has(id)) issues.push(`navigation points to missing #${id}`);
  for (const id of AUTHORITY_SECTION_IDS) if (!page.sectionOrder.includes(id)) issues.push(`required navigation anchor #${id} is absent`);
  if (page.sectionOrder.join("|") !== AUTHORITY_SECTION_IDS.join("|")) issues.push("section order does not match the authority-page contract");
  for (const section of page.sections) {
    if (!ID.test(section.id)) issues.push(`malformed section id ${section.id}`);
    if (!section.directAnswer.trim()) issues.push(`#${section.id} has no direct answer`);
    for (const subsection of section.subsections ?? []) if (!subsection.directAnswer.trim()) issues.push(`#${subsection.id} has no direct answer`);
  }
  if (page.huntingCompatibility === "NON_QUARRY") {
    for (const id of ["how-to-hunt", "shot-placement", "equipment"] as const) {
      if (sections.has(id)) issues.push(`non-quarry page includes incompatible #${id} guidance`);
    }
  }

  const sourceIds = new Set(page.sources.map(({ id }) => id));
  if (sourceIds.size !== page.sources.length) issues.push("duplicate source ids");
  const cited = new Set<string>();
  const citations = [
    ...page.sections.flatMap((section) => claimsOf(section).flatMap(({ citations }) => citations)),
    ...page.faq.flatMap(({ citations }) => citations),
    ...page.facts.flatMap(({ sourceIds }) => sourceIds.map((sourceId) => ({ sourceId }))),
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
  if (issues.length) throw new SpeciesAuthorityValidationError(issues);
  return page;
}
