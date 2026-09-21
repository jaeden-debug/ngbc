export type HuntMapMode = "EXPLORE" | "FIND_GAME" | "CHECK_HUNT";
export type LayerGroup = "HUNTING" | "LAND" | "ACCESS" | "WILDLIFE" | "CONDITIONS" | "MAP";

export interface IntelligenceLayerDefinition {
  id: string;
  label: string;
  group: LayerGroup;
  modes: HuntMapMode[];
  temporal: boolean;
  legalDecision: boolean;
  description: string;
}

/** Product vocabulary only. Availability comes from the coverage registry. */
export const INTELLIGENCE_LAYERS: readonly IntelligenceLayerDefinition[] = [
  { id: "management-zones", label: "Management Zones", group: "HUNTING", modes: ["EXPLORE", "CHECK_HUNT"], temporal: false, legalDecision: false, description: "Official management geography; geometry standing is shown separately." },
  { id: "specie-heat-map", label: "SPECIE HEAT MAP", group: "HUNTING", modes: ["FIND_GAME"], temporal: true, legalDecision: false, description: "Relative evidence about where to investigate, never a legality or presence guarantee." },
  { id: "open-seasons", label: "Open Seasons", group: "HUNTING", modes: ["CHECK_HUNT"], temporal: true, legalDecision: true, description: "Canonical regulatory-engine results only." },
  { id: "crown-public-land", label: "Crown/Public Land", group: "LAND", modes: ["EXPLORE", "FIND_GAME"], temporal: true, legalDecision: false, description: "Ownership context; never synonymous with access or permission to hunt." },
  { id: "potential-hunting-areas", label: "Potential Hunting Areas", group: "LAND", modes: ["FIND_GAME"], temporal: true, legalDecision: false, description: "Explainable planning intersections that still require Hunt evaluation." },
  { id: "protected-restricted", label: "Protected/Restricted Areas", group: "LAND", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: true, description: "Source-backed prohibitions or restrictions composed with parent zones." },
  { id: "roads-trails", label: "Roads & Trails", group: "ACCESS", modes: ["EXPLORE", "FIND_GAME"], temporal: true, legalDecision: false, description: "Mapped access features with independent access status." },
  { id: "access-points", label: "Parking / Access Points", group: "ACCESS", modes: ["EXPLORE", "FIND_GAME"], temporal: true, legalDecision: false, description: "Authority-backed parking, trailheads and access points." },
  { id: "boat-launches", label: "Boat Launches", group: "ACCESS", modes: ["EXPLORE", "FIND_GAME"], temporal: true, legalDecision: false, description: "Authority-backed launches only." },
  { id: "species-range", label: "Species Range", group: "WILDLIFE", modes: ["FIND_GAME"], temporal: true, legalDecision: false, description: "Known, seasonal, breeding, winter or migration range as the source defines it." },
  { id: "harvest-data", label: "Harvest Data", group: "WILDLIFE", modes: ["FIND_GAME"], temporal: true, legalDecision: false, description: "Original reported units and methodology preserved." },
  { id: "habitat", label: "Habitat", group: "WILDLIFE", modes: ["FIND_GAME"], temporal: true, legalDecision: false, description: "Source-backed habitat evidence, not an exact animal-location claim." },
  { id: "cwd-disease", label: "CWD / Disease", group: "WILDLIFE", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: true, description: "Surveillance and regulatory consequences remain distinct." },
  { id: "weather", label: "Weather", group: "CONDITIONS", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: false, description: "Observed or forecast environmental context." },
  { id: "wind", label: "Wind", group: "CONDITIONS", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: false, description: "Direction, speed and gust context." },
  { id: "snow", label: "Snow", group: "CONDITIONS", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: false, description: "Observed and forecast snow kept distinct." },
  { id: "wildfire", label: "Wildfire / Fire Restrictions", group: "CONDITIONS", modes: ["EXPLORE", "CHECK_HUNT"], temporal: true, legalDecision: true, description: "Fire conditions do not become closures without an authoritative order." },
  { id: "standard", label: "Standard", group: "MAP", modes: ["EXPLORE", "FIND_GAME", "CHECK_HUNT"], temporal: false, legalDecision: false, description: "Standard basemap." },
  { id: "satellite", label: "Satellite", group: "MAP", modes: ["EXPLORE", "FIND_GAME", "CHECK_HUNT"], temporal: false, legalDecision: false, description: "Provider imagery with overlays and attribution preserved." },
  { id: "terrain", label: "Terrain/Topo", group: "MAP", modes: ["EXPLORE", "FIND_GAME", "CHECK_HUNT"], temporal: false, legalDecision: false, description: "Provider terrain or licensed topographic data." },
] as const;
