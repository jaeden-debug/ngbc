import { HUNT_DEFAULT_TIME_ZONE, jurisdictionTodayIso } from "../date.ts";
import type { ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * Québec hunting zones — `zones de chasse`.
 *
 * Published by the ministry's own GeoServer, which is the service behind the
 * government's Forêt ouverte map. Ontario's layer is ArcGIS and Québec's is WFS,
 * which is exactly the difference `ZoneLayerSource` exists to absorb: the fetch
 * differs, everything downstream does not.
 *
 * Two things about this layer shape the adapter.
 *
 * The authority divides a numbered zone into named parts — 05E and 05O, 19N,
 * 19SE, 19SO and 19SNO — and its season tables are written per part, not per
 * number. So the PART is the regulatory unit and `Zone` is the identifier kept,
 * never `No_zone`. Collapsing 19SE into 19 would merge four different seasons.
 *
 * And the geography is genuinely lopsided: 28 numbered zones become 59
 * designations and 9,503 polygons, of which zone 19SE alone contributes 8,091
 * islands. Paging is therefore small and ordered, and features for one
 * designation are merged into a single MultiPolygon rather than staged as
 * thousands of separate zones.
 */

export const QUEBEC_ZONE_WFS = "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows";
export const QUEBEC_ZONE_TYPE_NAME = "SmartFaunePub:Zone_chasse_da3_sefaq";

/* The service caps a page at 1,000 and drops the connection on sustained large
   pages, so this is deliberately well under both. */
const PAGE_SIZE = 500;

interface WfsGeoJson {
  features?: Array<{
    id?: string;
    properties?: Record<string, unknown>;
    geometry?: { type: string; coordinates: unknown } | null;
  }>;
  numberMatched?: number;
  totalFeatures?: number;
}

function pageUrl(startIndex: number): string {
  const parameters = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: QUEBEC_ZONE_TYPE_NAME,
    outputFormat: "application/json",
    /* The layer is natively EPSG:32198 (Québec Lambert). The service reprojects
       on request, so the authority does the transform rather than North Ground
       putting itself between the authority and its own boundary. */
    srsName: "EPSG:4326",
    count: String(PAGE_SIZE),
    startIndex: String(startIndex),
  });
  return `${QUEBEC_ZONE_WFS}?${parameters}`;
}

async function fetchPage(startIndex: number, fetcher: typeof fetch): Promise<WfsGeoJson> {
  const response = await fetcher(pageUrl(startIndex), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(180_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Québec zone service returned ${response.status} at startIndex ${startIndex}`);
  }
  return await response.json() as WfsGeoJson;
}

/**
 * The upper half of code page 850, as that code page itself defines it.
 *
 * Generated from the platform's own CP850 codec rather than transcribed, because
 * a single wrong character here would silently rename a hunting zone.
 */
const CP850_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎ" +
  "Ï┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u00ad±‗¾¶§÷¸°¨·¹³²■\u00a0";

/**
 * A byte this layer could only have produced by mis-encoding, never by meaning it.
 *
 * C1 controls are not text, and a multiplication sign is not part of a French
 * place name. Either one in a part name is the defect below; neither can appear
 * in a name that arrived correctly.
 */
const MISENCODED = /[\u0080-\u009f\u00d7]/;

/**
 * The published part name, with this layer's encoding defect reversed.
 *
 * `Partie_zon` arrives as CP850 bytes decoded as Latin-1: the authority's "Île"
 * reaches us as "×le" (CP850 0xD7) and "Beaupré" as "Beaupr\u0082" (CP850 0x82).
 * The neighbouring `Chasse_Interdite` layer on the same server returns its
 * accents correctly, so this is a defect in this one layer's attributes rather
 * than a service-wide problem.
 *
 * The repair reads every byte back through CP850, which is what the ministry
 * meant by it — not a list of phrase substitutions, which would fix the names
 * that happen to exist today and quietly mangle the next one. A name is only put
 * through it when it carries a byte the defect produces, so a correct name is
 * returned untouched, including after the ministry fixes the layer.
 */
export function repairPartName(value: string): string {
  if (!MISENCODED.test(value)) return value;
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x80 && code <= 0xff ? CP850_HIGH[code - 0x80] : character;
    })
    .join("");
}

function asMultiPolygonCoordinates(geometry: { type: string; coordinates: unknown }): unknown[] {
  return geometry.type === "MultiPolygon"
    ? geometry.coordinates as unknown[]
    : [geometry.coordinates];
}

export function createQuebecZoneSource(fetcher: typeof fetch = fetch): ZoneLayerSource {
  return {
    layerId: "layer:ca-qc-zone-chasse",
    jurisdictionCanonicalId: "jurisdiction:ca-qc",
    officialTerm: "zone de chasse",
    officialTermShort: "Zone",
    zoneType: "ZONE",
    authority: "Ministère des Forêts, de la Faune et des Parcs",
    sourceCanonicalId: "source:ca-qc-zone-chasse-service",
    sourceUrl: QUEBEC_ZONE_WFS,

    /* Designations are alphanumeric parts ("05E", "19SNO", "08NMR"), kept as the
       authority writes them and only lower-cased for the id. */
    canonicalZoneId: (identifier) =>
      `management_zone:ca-qc-zone-${identifier.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    /* French is the official language of this authority's terminology, so the
       name is built in French rather than translated. */
    officialName: (identifier) => `Zone de chasse ${identifier.trim()}`,

    async fetchFeatures() {
      /* One entry per designation, accumulating every polygon that belongs to it.
         Zone 19SE is 8,091 islands and is one regulatory area, not 8,091. */
      const byDesignation = new Map<string, {
        record: Omit<ZoneFeatureRecord, "geometry">;
        polygons: unknown[];
      }>();

      let startIndex = 0;
      let expected: number | null = null;

      for (;;) {
        const page = await fetchPage(startIndex, fetcher);
        const rows = page.features ?? [];
        if (expected === null) {
          expected = page.numberMatched ?? page.totalFeatures ?? null;
        }
        if (!rows.length) break;

        for (const row of rows) {
          const properties = row.properties ?? {};
          const designation = typeof properties.Zone === "string" ? properties.Zone.trim() : "";
          const geometry = row.geometry;
          if (!designation || !geometry) continue;
          if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue;

          const existing = byDesignation.get(designation);
          if (existing) {
            existing.polygons.push(...asMultiPolygonCoordinates(geometry));
            continue;
          }

          const part = typeof properties.Partie_zon === "string" ? repairPartName(properties.Partie_zon.trim()) : "";
          byDesignation.set(designation, {
            record: {
              /* The designation is the stable key here: individual island feature
                 ids are not meaningful and change with every redraw. */
              sourceFeatureId: designation,
              officialIdentifier: designation,
              attributes: {
                zoneNumber: properties.No_zone ?? null,
                partName: part || null,
                sourceCrs: "EPSG:32198",
              },
            },
            polygons: asMultiPolygonCoordinates(geometry),
          });
        }

        startIndex += rows.length;
        if (expected !== null && startIndex >= expected) break;
        if (rows.length < PAGE_SIZE) break;
      }

      const features: ZoneFeatureRecord[] = [...byDesignation.values()].map(({ record, polygons }) => ({
        ...record,
        attributes: { ...record.attributes, sourcePolygonCount: polygons.length },
        geometry: { type: "MultiPolygon", coordinates: polygons },
      }));

      features.sort((left, right) => left.officialIdentifier.localeCompare(right.officialIdentifier, "fr-CA"));

      /* Dated on the ministry's clock, not the runtime's. Quebec is on Eastern
         time, so a UTC stamp would date an evening retrieval to the following
         day and leave the provenance record disagreeing with the day the source
         was actually read. */
      const retrievedOn = jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE);
      return { features, sourceVersion: `retrieved-${retrievedOn}` };
    },
  };
}
