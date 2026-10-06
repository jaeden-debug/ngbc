/**
 * Whether a provider photograph may stand for a species — decided from what
 * its photographer wrote, never from where it ranked in a search.
 *
 *   VERIFIED         the caption names the species' own binomial
 *   HIGH_CONFIDENCE  the caption names the species by an identifying common name
 *   NEEDS_REVIEW     a caption points at it but cannot identify it (a shared or
 *                    generic name, another species named too, or only
 *                    low-resolution candidates)
 *   NO_MATCH         nothing a photographer wrote names it
 *
 * Only VERIFIED and HIGH_CONFIDENCE may be published, and only after the
 * visual check has not rejected the photograph. The machine-written
 * `alt_description` never identifies anything — it once called a 1759 museum
 * painting "a grey partridge bird" — but it can disqualify: it is read for
 * other species and for signs the image is not a live animal.
 */
import { isUnsplashImageUrl } from "./unsplash.ts";
import { readNames, type NameLexicon, type SpeciesImageIdentity } from "./identity.ts";

export type ImageVerificationStatus = "VERIFIED" | "HIGH_CONFIDENCE" | "NEEDS_REVIEW" | "NO_MATCH";
export type SubjectSex = "MALE" | "FEMALE" | "UNKNOWN";

export const PUBLISHABLE_STATUSES: readonly ImageVerificationStatus[] = ["VERIFIED", "HIGH_CONFIDENCE"];

export interface ProviderCandidate {
  provider: "unsplash";
  id: string;
  description: string | null;
  altDescription: string | null;
  width: number;
  height: number;
  likes: number;
  imageUrl: string;
  thumbUrl: string;
  photographerName: string;
  photographerProfileUrl: string;
  sourcePageUrl: string;
  downloadLocation: string;
  sponsored: boolean;
  query: string;
  /** Position in its search results, from 0. */
  rank: number;
}

export interface ReviewDecision {
  decision: "ACCEPT" | "REJECT";
  speciesId: string;
  reason?: string;
  altText?: string;
  subjectSex?: SubjectSex;
  focal?: { x: number; y: number };
}

export interface CandidateVerdict {
  candidate: ProviderCandidate;
  status: ImageVerificationStatus;
  /** Why, in words, from the evidence. */
  reason: string;
  /** Disqualified outright (not a live-animal photograph, sponsored, foreign host). */
  excluded: string | null;
  captive: boolean;
  lowResolution: boolean;
  subjectSex: SubjectSex;
  review: ReviewDecision | null;
}

export interface SpeciesVerdict {
  speciesId: string;
  status: ImageVerificationStatus;
  reason: string;
  chosen: CandidateVerdict | null;
  /** Candidates whose caption named the species at all, best first. */
  named: CandidateVerdict[];
  searched: Array<{ query: string; results: number; total: number }>;
}

const MIN_SHORT_SIDE = 800;

const NOT_A_LIVE_ANIMAL = [
  "painting", "illustration", "drawing", "sketch", "engraving", "lithograph", "watercolor", "watercolour",
  "rijksmuseum", "museum", "publisher", "providing institution", "artwork", "art print", "poster", "cartoon",
  "render", "rendering", "3d", "ai generated", "generated", "clipart", "vector", "emoji", "logo",
  "statue", "sculpture", "figurine", "toy", "toys", "plush", "stuffed", "decoy", "decoys", "carving", "carved",
  "ornament", "mural", "graffiti", "costume", "mascot", "lego", "taxidermy", "taxidermied", "mounted",
  "dead", "carcass", "roadkill", "killed", "trophy", "skull", "skeleton", "bones", "pelt", "fossil", "specimen",
  "embroidery", "tattoo", "sticker", "illustrated", "print", "stamp", "plate", "etching", "engraved", "aquatint",
  "woodcut", "hand colored", "chromolithograph", "audubon", "havell", "birds of america", "artist", "public domain",
  "library", "gallery", "collection", "associated names",
  "after the hunt", "harvested", "bagged", "tagged out", "kill", "hunted",
];
/** A year before photography was practical: a caption dated 1400–1869 describes an artwork or a specimen. */
const HISTORIC_YEAR = / 1(4|5|6|7)\d\d | 18[0-6]\d /;
const CAPTIVE = ["zoo", "captive", "captivity", "aquarium", "enclosure", "wildlife park", "safari park", "pet", "pets", "farm", "petting"];

function words(value: string | null): string {
  return ` ${(value ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ")} `;
}
const mentions = (text: string, list: string[]) => list.filter((term) => text.includes(` ${term} `));

export function subjectSexFrom(description: string | null): SubjectSex {
  const text = words(description);
  const male = / (male|drake) /.test(text);
  const female = / female /.test(text);
  return male === female ? "UNKNOWN" : male ? "MALE" : "FEMALE";
}

/** One candidate, judged on its own evidence. */
export function verifyCandidate(
  candidate: ProviderCandidate,
  identity: SpeciesImageIdentity,
  lexicon: NameLexicon,
  review: ReviewDecision | null = null,
): CandidateVerdict {
  const caption = candidate.description ?? "";
  const reading = readNames(caption, identity, lexicon);
  const altReading = readNames(candidate.altDescription ?? "", identity, lexicon);
  const captionWords = words(caption);
  const altWords = words(candidate.altDescription);
  const notAnimal = [...new Set([...mentions(captionWords, NOT_A_LIVE_ANIMAL), ...mentions(altWords, NOT_A_LIVE_ANIMAL)])];
  if (HISTORIC_YEAR.test(captionWords)) notAnimal.push("a pre-photography date");
  const base = {
    candidate,
    captive: mentions(captionWords, CAPTIVE).length > 0 || mentions(altWords, CAPTIVE).length > 0,
    lowResolution: Math.min(candidate.width, candidate.height) < MIN_SHORT_SIDE,
    subjectSex: subjectSexFrom(caption),
    review,
  };
  let excluded: string | null = null;
  if (!isUnsplashImageUrl(candidate.imageUrl)) excluded = "not served from images.unsplash.com (Unsplash+ or foreign host)";
  else if (candidate.sponsored) excluded = "sponsored placement";
  else if (notAnimal.length) excluded = `not a photograph of a live animal (“${notAnimal.join("”, “")}”)`;

  const others = [...new Set([...reading.others, ...altReading.others])];
  let status: ImageVerificationStatus;
  let reason: string;
  if (reading.otherBinomials.length && (reading.scientific || reading.identifying.length || reading.weak.length)) {
    status = "NEEDS_REVIEW";
    reason = `caption gives the binomial ${reading.otherBinomials.join(", ")}, not ${identity.scientificName}`;
  } else if (others.length && (reading.scientific || reading.identifying.length || reading.weak.length)) {
    status = "NEEDS_REVIEW";
    reason = `caption or alt text also names ${others.map((id) => id.replace(/^(species|external):/, "")).join(", ")}`;
  } else if (reading.scientific) {
    status = "VERIFIED";
    reason = `photographer's caption names the binomial ${identity.scientificName}`;
  } else if (reading.identifying.length) {
    status = "HIGH_CONFIDENCE";
    reason = `photographer's caption names “${reading.identifying.join("”, “")}”`;
  } else if (reading.weak.length) {
    status = "NEEDS_REVIEW";
    const why = identity.weakNames.filter(({ name }) => reading.weak.includes(name));
    reason = `caption says only “${reading.weak.join("”, “")}”, which cannot identify it (${[...new Set(why.map(({ reason: r }) => r.toLowerCase().replace(/_/g, " ")))].join("; ") || "shared name"})`;
  } else {
    status = "NO_MATCH";
    reason = "caption does not name this species";
  }
  return { ...base, status, reason, excluded };
}

const STATUS_ORDER: ImageVerificationStatus[] = ["VERIFIED", "HIGH_CONFIDENCE", "NEEDS_REVIEW", "NO_MATCH"];

/** Identity first, always; then a wild, landscape, large, well-liked photograph. */
export function compareCandidates(a: CandidateVerdict, b: CandidateVerdict): number {
  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    || Number(a.captive) - Number(b.captive)
    || Number(a.candidate.height > a.candidate.width) - Number(b.candidate.height > b.candidate.width)
    || Number(Math.min(b.candidate.width, b.candidate.height) >= 2000) - Number(Math.min(a.candidate.width, a.candidate.height) >= 2000)
    || b.candidate.likes - a.candidate.likes
    || a.candidate.rank - b.candidate.rank
    || a.candidate.id.localeCompare(b.candidate.id);
}

export function publishable(verdict: CandidateVerdict): boolean {
  return PUBLISHABLE_STATUSES.includes(verdict.status) && !verdict.excluded && !verdict.lowResolution
    && verdict.review?.decision !== "REJECT";
}

/**
 * Every candidate a species' searches returned, judged and ranked. The chosen
 * candidate is the best publishable one; the visual check can only remove
 * candidates, never add one.
 */
export function verifySpecies(
  identity: SpeciesImageIdentity,
  lexicon: NameLexicon,
  searches: Array<{ query: string; total: number; candidates: ProviderCandidate[] }>,
  reviews: Record<string, ReviewDecision> = {},
): SpeciesVerdict {
  const byId = new Map<string, ProviderCandidate>();
  for (const search of searches) for (const candidate of search.candidates) if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  const verdicts = [...byId.values()]
    .map((candidate) => {
      const review = reviews[`${candidate.provider}:${candidate.id}`];
      return verifyCandidate(candidate, identity, lexicon, review && review.speciesId === identity.speciesId ? review : null);
    });
  const named = verdicts.filter((verdict) => verdict.status !== "NO_MATCH" && !verdict.excluded).sort(compareCandidates);
  const searched = searches.map(({ query, total, candidates }) => ({ query, results: candidates.length, total }));
  const chosen = named.find(publishable) ?? null;
  if (chosen) {
    return { speciesId: identity.speciesId, status: chosen.status, reason: chosen.reason, chosen, named, searched };
  }
  if (!searches.length) {
    return { speciesId: identity.speciesId, status: "NO_MATCH", reason: "not searched yet", chosen: null, named, searched };
  }
  const identified = named.filter((verdict) => PUBLISHABLE_STATUSES.includes(verdict.status));
  if (identified.length) {
    const rejected = identified.filter((verdict) => verdict.review?.decision === "REJECT");
    const why = rejected.length === identified.length
      ? `${identified.length} named candidate(s) failed the visual check: ${rejected.map((verdict) => verdict.review?.reason).filter(Boolean).slice(0, 3).join("; ")}`
      : `named candidates are below ${MIN_SHORT_SIDE}px on the short side`;
    return { speciesId: identity.speciesId, status: "NEEDS_REVIEW", reason: why, chosen: null, named, searched };
  }
  if (named.length) {
    return { speciesId: identity.speciesId, status: "NEEDS_REVIEW", reason: named[0].reason, chosen: null, named, searched };
  }
  const queries = searched.map(({ query, results }) => `“${query}” (${results} results)`).join(", ");
  return {
    speciesId: identity.speciesId,
    status: "NO_MATCH",
    reason: identity.requireScientificName
      ? `no caption gives the binomial ${identity.scientificName}, the only identification accepted for this species; searched ${queries}`
      : `no photographer's caption names this species; searched ${queries}`,
    chosen: null,
    named,
    searched,
  };
}

/** The fields of an Unsplash search result this module reads. */
export interface UnsplashPhoto {
  id: string;
  description?: string | null;
  alt_description?: string | null;
  width?: number;
  height?: number;
  likes?: number;
  sponsorship?: unknown;
  urls?: { raw?: string; small?: string };
  links?: { html?: string; download_location?: string };
  user?: { name?: string; links?: { html?: string } };
}

/** A raw Unsplash search result, as the candidate this module judges. */
export function unsplashCandidate(photo: UnsplashPhoto, query: string, rank: number): ProviderCandidate {
  return {
    provider: "unsplash",
    id: String(photo.id),
    description: photo.description ?? null,
    altDescription: photo.alt_description ?? null,
    width: Number(photo.width) || 0,
    height: Number(photo.height) || 0,
    likes: Number(photo.likes) || 0,
    imageUrl: String(photo.urls?.raw ?? ""),
    thumbUrl: String(photo.urls?.small ?? ""),
    photographerName: String(photo.user?.name ?? ""),
    photographerProfileUrl: String(photo.user?.links?.html ?? ""),
    sourcePageUrl: String(photo.links?.html ?? ""),
    downloadLocation: String(photo.links?.download_location ?? ""),
    sponsored: Boolean(photo.sponsorship),
    query,
    rank,
  };
}
