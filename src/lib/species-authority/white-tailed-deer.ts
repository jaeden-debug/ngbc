import type { SpeciesAuthorityPage } from "./types.ts";

const c = (sourceId: string, locator?: string) => ({ sourceId, ...(locator ? { locator } : {}) });

export const whiteTailedDeerAuthorityPage: SpeciesAuthorityPage = {
  schemaVersion: "1.0.0",
  speciesId: "species:white-tailed-deer",
  slug: "white-tailed-deer",
  canonicalPath: "/hunting/species/white-tailed-deer",
  status: "REFERENCE_IMPLEMENTATION",
  huntingCompatibility: "HUNTABLE",
  reviewedAt: "2026-10-06",
  identity: {
    commonName: "White-tailed deer",
    scientificName: "Odocoileus virginianus",
    frenchName: "Cerf de Virginie",
    family: "Cervidae",
    directAnswer: "A highly adaptable North American deer identified most reliably by the broad white underside of its tail, which it raises as a flag when alarmed. Biology can help you find and identify deer; only the responsible authority can say whether a particular animal is legal to hunt.",
  },
  facts: [
    { label: "Best field mark", value: "Broad white tail underside; tail often raised when alarmed", sourceIds: ["source:ndgf-whitetail"] },
    { label: "Food", value: "A seasonally flexible browser: woody browse, forbs, mast and crops", sourceIds: ["source:usfs-feis-whitetail"] },
    { label: "Peak activity", value: "Often crepuscular; pressure and local conditions can shift movement", sourceIds: ["source:ndgf-whitetail", "source:usfs-feis-whitetail"] },
    { label: "Habitat pattern", value: "Edges and mosaics that place forage close to escape and thermal cover", sourceIds: ["source:usfs-feis-whitetail"] },
    { label: "Track", value: "Two pointed, heart-shaped hoof impressions; size and substrate vary", sourceIds: ["source:mdc-whitetail"] },
    { label: "Range", value: "Broad North American range; local occurrence and density are uneven", sourceIds: ["source:hww-whitetail"] },
  ],
  sectionOrder: ["overview", "identification", "habitat", "diet", "behaviour", "tracks-and-sign", "seasonal-pattern", "how-to-hunt", "shot-placement", "equipment", "regulations", "range-and-map", "faq", "sources"],
  sections: [
    { id: "overview", title: "Overview", shortTitle: "Overview", layer: "BIOLOGY", directAnswer: "White-tailed deer succeed across a remarkable range of landscapes because they adjust food, cover use and movement to local seasons and disturbance.", claims: [
      { id: "overview-adaptable", text: "The species occupies forests, farms, shrublands, wetlands and developed edges; the useful unit for fieldwork is the local cover-and-food pattern, not a generic habitat label.", citations: [c("source:usfs-feis-whitetail", "Habitat and plant communities")] },
      { id: "overview-variation", text: "Body size, antler development, timing and behaviour vary across latitude, nutrition, age and local conditions. Treat regional averages as context, never as an identification test.", citations: [c("source:hww-whitetail"), c("source:ndgf-whitetail")] },
    ] },
    { id: "identification", title: "Identification", shortTitle: "ID", layer: "BIOLOGY", directAnswer: "Confirm the tail, rump, ears, antlers and gait together. Do not identify a deer from antlers or apparent body size alone.", claims: [
      { id: "id-coat", text: "Adults are reddish-brown in summer and grey-brown in winter; fawns are spotted. The throat, belly, inner legs and underside of the tail carry conspicuous white.", citations: [c("source:ndgf-whitetail", "Description")] },
      { id: "id-antlers", text: "Adult males usually grow antlers with tines rising from a main beam. Antler size is strongly affected by age and nutrition and is not a dependable age measure by itself.", citations: [c("source:hww-whitetail", "Description")] },
    ], subsections: [
      { id: "similar-species", title: "Similar species", directAnswer: "Where ranges overlap, separate white-tailed deer from mule deer by combining tail pattern, ear proportions, antler branching and escape gait.", claims: [
        { id: "id-mule-deer", text: "Mule deer typically show larger ears, a narrower white tail with a black tip, forked antlers and a bounding or stotting escape gait; white-tailed deer more often run with the broad white tail raised.", citations: [c("source:ndgf-whitetail", "Identification") ] },
      ], caution: "If the species, sex, age class or antler class is uncertain, do not shoot. Legal definitions are jurisdiction-specific." },
      { id: "sex-and-age", title: "Sex and age", directAnswer: "Use several body traits at close, unhurried range; biological sex and age are not substitutes for the legal animal-class definition.", claims: [
        { id: "id-sex-age", text: "Neck, chest, belly line, leg-to-body proportions and behaviour can support an estimate. Obscured antlers, shed antlers and young males make single-feature decisions unsafe.", citations: [c("source:ontario-deer-guide", "Identification and harvest selection")] },
      ] },
    ] },
    { id: "habitat", title: "Habitat", shortTitle: "Habitat", layer: "BIOLOGY", directAnswer: "The strongest white-tail habitat puts food near secure cover. Productive edges matter, but an edge with no usable forage or refuge is just a line on a map.", claims: [
      { id: "habitat-mosaic", text: "Mixed woodland, regenerating cuts, old fields, riparian corridors, cropland margins and brush can form useful mosaics when forage, concealment and seasonal shelter occur close together.", citations: [c("source:usfs-feis-whitetail", "Preferred habitat")] },
      { id: "habitat-north", text: "In northern winters, conifer shelter can reduce wind and snow costs while nearby browse supplies food. Winter concentration areas should not be disturbed unnecessarily.", citations: [c("source:maine-whitetail", "Winter habitat")] },
    ], subsections: [
      { id: "habitat-reading", title: "How to read habitat", directAnswer: "Start with transitions: bedding cover to feeding cover, upland to wet ground, mature timber to regeneration, or a barrier that narrows travel.", claims: [
        { id: "habitat-transition", text: "Aerial imagery proposes a pattern; tracks, pellets, browse, beds and current trails must confirm that deer are using it now.", citations: [c("source:indiana-scouting", "Where to scout")] },
      ] },
    ] },
    { id: "diet", title: "Diet", shortTitle: "Diet", layer: "BIOLOGY", directAnswer: "White-tailed deer are selective, flexible feeders. The locally important food changes with plant community, weather and season.", claims: [
      { id: "diet-foods", text: "Diet may include leaves and stems of woody plants, forbs, grasses, fungi, fruits, nuts and agricultural crops. Mast such as acorns can reorganize autumn movement where it is abundant.", citations: [c("source:usfs-feis-whitetail", "Food habits")] },
      { id: "diet-browse", text: "Browsed twig tips, clipped vegetation and a visible browse line can show repeated feeding, but they are not species proof without tracks, pellets or direct observation.", citations: [c("source:wdfw-deer", "Signs")] },
    ] },
    { id: "behaviour", title: "Behaviour", shortTitle: "Behaviour", layer: "FIELD_KNOWLEDGE", directAnswer: "Movement is often strongest around dawn and dusk, but cover, weather, food, breeding and human pressure can move activity into other hours or denser cover.", claims: [
      { id: "behaviour-activity", text: "White-tails commonly use familiar home ranges and travel routes. They may tighten movement, favour thicker cover or become more nocturnal where disturbance is repeated.", citations: [c("source:usfs-feis-whitetail", "Cover and human disturbance"), c("source:ndgf-whitetail", "Habits")] },
      { id: "behaviour-alarm", text: "A raised flagging tail, abrupt snort or bounding retreat signals alarm. Freeze, identify the wind and avoid pushing deer toward roads, property boundaries or other hunters.", citations: [c("source:hww-whitetail", "Behaviour")] },
    ] },
    { id: "tracks-and-sign", title: "Tracks and sign", shortTitle: "Sign", layer: "FIELD_KNOWLEDGE", directAnswer: "A single track says a deer passed. Direction, freshness, repetition and the surrounding cover are what turn sign into useful field knowledge.", claims: [
      { id: "sign-tracks", text: "Typical tracks show two pointed toes and an overall heart shape. Soft ground, speed and splayed toes can enlarge or distort them, so dimensions are supporting evidence only.", citations: [c("source:mdc-whitetail", "Tracks")] },
      { id: "sign-rubs", text: "Rubs are bark-scraped stems associated mainly with antlered deer. Scrapes are pawed ground often beneath an overhanging branch. Neither guarantees daylight use or an animal's current location.", citations: [c("source:indiana-scouting", "Rubs and scrapes")] },
    ], subsections: [
      { id: "sign-interpretation", title: "Interpret sign in context", directAnswer: "Look for converging evidence: several fresh tracks, current droppings, browsed plants and a trail connecting known cover or food.", claims: [
        { id: "sign-freshness", text: "Moist edges, sharp detail, displaced leaves and sign laid over recent weather can suggest recency, but substrate and exposure change ageing quickly. State uncertainty plainly.", citations: [c("source:indiana-scouting", "Scouting basics")] },
      ] },
    ] },
    { id: "seasonal-pattern", title: "Seasonal pattern", shortTitle: "Season", layer: "FIELD_KNOWLEDGE", directAnswer: "Season changes what deer need most: emerging forage in spring, security and growth in summer, breeding movement in autumn, and energy conservation plus shelter in winter.", claims: [
      { id: "season-spring-summer", text: "Spring green-up and summer cover spread feeding opportunities. Does use secluded cover around fawning; observe from distance and leave apparently hidden fawns alone.", citations: [c("source:hww-whitetail", "Life cycle")] },
      { id: "season-autumn", text: "Breeding occurs in autumn across much of the range, but peak timing and visible movement vary geographically and locally. Photoperiod is important; weather and pressure affect what hunters observe.", citations: [c("source:ndgf-whitetail", "Reproduction"), c("source:ontario-deer-guide", "Deer biology")] },
      { id: "season-winter", text: "Cold, deep snow and declining food can concentrate deer in sheltered habitat. Repeated disturbance then costs energy and can damage sensitive wintering areas.", citations: [c("source:maine-whitetail", "Winter survival")] },
    ] },
    { id: "how-to-hunt", title: "How to hunt", shortTitle: "Hunt", layer: "HUNTING_INTELLIGENCE", directAnswer: "Find a current food-cover-travel relationship, confirm legal access and wind, then choose a low-impact position that offers a close, controlled shot.", claims: [
      { id: "hunt-scout", text: "Scout from large pattern to small proof: locate habitat transitions and funnels, then verify fresh sign and a safe approach before committing to a setup.", citations: [c("source:indiana-scouting", "Scouting strategies")] },
      { id: "hunt-wind", text: "Plan entry and exit around the wind and expected deer path. Avoid crossing the trail, bedding edge or feeding area you intend to observe.", citations: [c("source:ontario-deer-guide", "Hunting techniques and safety")] },
    ], subsections: [
      { id: "still-hunting", title: "Still-hunting", directAnswer: "Move slower than feels necessary, glass first and use cover to break your outline; stop more than you walk.", claims: [{ id: "hunt-still", text: "Still-hunting works best when wind, wet ground or soft snow reduce noise and visibility is sufficient to identify a deer and backstop before raising a firearm or bow.", citations: [c("source:ontario-deer-guide", "Hunting techniques")] }] },
      { id: "stand-and-ambush", title: "Stand or ground ambush", directAnswer: "Set up downwind of a verified route, not directly on it, and retain a safe shot lane and exit.", claims: [{ id: "hunt-stand", text: "Funnels, crossings and inside corners can concentrate travel, but stale sign and attractive map geometry do not replace present field evidence.", citations: [c("source:indiana-scouting", "Funnels and travel corridors")] }] },
    ] },
    { id: "shot-placement", title: "Ethical shot placement", shortTitle: "Shot", layer: "HUNTING_INTELLIGENCE", directAnswer: "Wait for a broadside or modest quartering-away presentation that exposes the heart-lung area, with a clear path and safe backstop. If any part is uncertain, do not shoot.", claims: [
      { id: "shot-vitals", text: "Aim through the centre of the chest's heart-lung area, accounting for the near and far legs and the animal's angle. The intended path matters more than a surface mark on the hide.", citations: [c("source:illinois-shot", "Heart and lungs") ] },
      { id: "shot-avoid", text: "Avoid head, neck, spine-only, rear-facing and steep quartering-to shots. They offer small targets, heavy bone or a poor path through both lungs and carry a higher wounding risk.", citations: [c("source:illinois-shot", "Shot angles") ] },
      { id: "shot-followup", text: "After the shot, mark the exact location, watch the direction of travel, wait an appropriate interval and follow local retrieval rules. Never assume a miss because a deer did not fall immediately.", citations: [c("source:ontario-deer-guide", "After the shot") ] },
    ], subsections: [
      { id: "shot-visual", title: "Anatomy visual", directAnswer: "No unreviewed stock diagram is shown. The text-first guidance remains complete while an original, anatomically reviewed broadside and quartering-away illustration is commissioned.", claims: [{ id: "shot-visual-contract", text: "The future asset must show entry-to-exit paths, leg position, heart-lung volume, unsafe angles and a visible 'do not shoot' state; it must never imply a universal aiming dot.", citations: [c("source:illinois-shot", "Anatomy and angles") ] }], caution: "Every shot depends on angle, distance, equipment, the hunter's capability, a clear target and what lies beyond." },
    ] },
    { id: "equipment", title: "Equipment", shortTitle: "Gear", layer: "HUNTING_INTELLIGENCE", directAnswer: "Use legal, well-maintained equipment that you can place accurately at the distance and angle offered. Regulation, proficiency and field conditions matter more than brand or maximum range.", claims: [
      { id: "equipment-core", text: "Core field equipment includes an appropriate legal hunting implement and ammunition or arrows, positive identification optics, blaze clothing where required, navigation, weather protection, first aid and a retrieval plan.", citations: [c("source:ontario-deer-guide", "Equipment and safety")] },
      { id: "equipment-practice", text: "Confirm zero or tune, practice from realistic field positions and set a personal maximum distance based on repeatable groups—not the equipment's advertised capability.", citations: [c("source:illinois-shot", "Preparation and shot selection")] },
    ] },
    { id: "regulations", title: "Regulations", shortTitle: "Rules", layer: "REGULATORY_HANDOFF", directAnswer: "This page does not tell you that a hunt is legal. A legal answer requires the exact place, date, licence, season, animal class, method and current authority source.", claims: [
      { id: "rules-separation", text: "White-tailed deer are managed as game in many jurisdictions, but seasons, zones, tags, antler definitions, legal methods and reporting duties differ and change. Use Hunt for the covered place and date, then read the linked authority.", citations: [c("source:ontario-hunting-regulations", "Deer seasons and requirements")] },
      { id: "rules-access", text: "A season does not grant access. Confirm land ownership, permission, discharge restrictions, protected areas and local rules separately.", citations: [c("source:ontario-hunting-regulations", "General regulations")] },
    ] },
    { id: "range-and-map", title: "Range and map", shortTitle: "Map", layer: "GEOSPATIAL_INTELLIGENCE", directAnswer: "North Ground's Species Heat layer shows range-constrained habitat opportunity—not animals, population density, property access or an open season.", claims: [
      { id: "map-range", text: "White-tailed deer occur broadly across southern Canada, most of the continental United States and farther south, but distribution and abundance are patchy and change with habitat and climate.", citations: [c("source:hww-whitetail", "Range")] },
      { id: "map-model", text: "The current North Ground layer is a production-verified RANGE_HABITAT surface at approximately 11 km habitat resolution. Its confidence is moderate and its source age is reported as ageing; use it to choose where to investigate, then verify in the field.", citations: [c("source:north-ground-whitetail-surface", "surface:range-habitat-white-tailed-deer-2.1.0")] },
    ] },
    { id: "faq", title: "Frequently asked questions", shortTitle: "FAQ", layer: "FIELD_KNOWLEDGE", directAnswer: "Short answers to the field questions most likely to change an identification, scouting or ethical-shot decision.", claims: [] },
    { id: "sources", title: "Sources and review", shortTitle: "Sources", layer: "BIOLOGY", directAnswer: "Claims are linked to biological, field, hunting-education, regulatory and geospatial sources. Source type is shown because one kind of evidence cannot silently answer another kind of question.", claims: [] },
  ],
  faq: [
    { id: "faq-tail", question: "Is every deer with white on its tail a white-tailed deer?", directAnswer: "No. Confirm the broad white underside and use rump pattern, ears, antlers, gait and local range together.", citations: [c("source:ndgf-whitetail", "Identification")] },
    { id: "faq-rut", question: "When is the white-tail rut?", directAnswer: "Autumn across much of the range, but timing varies by latitude and local population. Do not treat one calendar week as universal.", citations: [c("source:ndgf-whitetail", "Reproduction")] },
    { id: "faq-track", question: "Can track size identify a buck?", directAnswer: "No. Substrate, gait and individual size overlap; a large track may support an interpretation but cannot establish sex by itself.", citations: [c("source:mdc-whitetail", "Tracks")] },
    { id: "faq-map", question: "Does a hot map cell mean deer are there?", directAnswer: "No. It means the model found comparatively stronger range-constrained habitat opportunity at its stated resolution—not a current animal count.", citations: [c("source:north-ground-whitetail-surface", "Limitations")] },
    { id: "faq-legal", question: "Does this page mean I can hunt white-tailed deer here today?", directAnswer: "No. Check the exact location and date in Hunt and verify the linked authority, licence, access, method and animal-class requirements.", citations: [c("source:ontario-hunting-regulations", "Deer seasons and requirements")] },
  ],
  sources: [
    { id: "source:hww-whitetail", title: "White-tailed Deer", publisher: "Hinterland Who's Who / Canadian Wildlife Federation", url: "https://www.hww.ca/en/wildlife/mammals/white-tailed-deer.html", kind: "BIOLOGICAL", reviewedAt: "2026-10-06", note: "Canadian biology, range, life cycle and behaviour overview." },
    { id: "source:usfs-feis-whitetail", title: "Odocoileus virginianus: Fire Effects Information System species review", publisher: "U.S. Forest Service", url: "https://research.fs.usda.gov/feis/species-reviews/odvi", kind: "BIOLOGICAL", reviewedAt: "2026-10-06", note: "Research synthesis for habitat, food habits, cover and regional variation." },
    { id: "source:ndgf-whitetail", title: "White-tailed Deer", publisher: "North Dakota Game and Fish Department", url: "https://gf.nd.gov/wildlife/id/ungulates/white-tailed-deer", kind: "BIOLOGICAL", reviewedAt: "2026-10-06", note: "Identification, description, food, habits and reproduction." },
    { id: "source:mdc-whitetail", title: "White-tailed Deer field guide", publisher: "Missouri Department of Conservation", url: "https://mdc.mo.gov/discover-nature/field-guide/white-tailed-deer", kind: "FIELD_GUIDANCE", reviewedAt: "2026-10-06", note: "Track form, dimensions and field signs." },
    { id: "source:indiana-scouting", title: "Deer scouting basics", publisher: "Indiana Department of Natural Resources", url: "https://www.in.gov/dnr/fish-and-wildlife/wildlife-resources/animals/white-tailed-deer/deer-scouting-basics/", kind: "FIELD_GUIDANCE", reviewedAt: "2026-10-06", note: "Trails, funnels, rubs, scrapes and sign interpretation." },
    { id: "source:wdfw-deer", title: "Deer species facts", publisher: "Washington Department of Fish and Wildlife", url: "https://wdfw.wa.gov/species-habitats/living/species-facts/deer", kind: "FIELD_GUIDANCE", reviewedAt: "2026-10-06", note: "Tracks, trails, browse and coexistence signs." },
    { id: "source:maine-whitetail", title: "White-tailed Deer", publisher: "Maine Department of Inland Fisheries & Wildlife", url: "https://www.maine.gov/ifw/fish-wildlife/wildlife/species-information/mammals/deer.html", kind: "BIOLOGICAL", reviewedAt: "2026-10-06", note: "Northern winter habitat, diet and survival context." },
    { id: "source:illinois-shot", title: "Taking Your Shot", publisher: "Illinois Natural History Survey", url: "https://hunt.inhs.illinois.edu/hunting-trapping/deer-hunting/taking-your-shot/", kind: "HUNTING_EDUCATION", reviewedAt: "2026-10-06", note: "Anatomy, heart-lung target, shot angles and ethical selection." },
    { id: "source:ontario-deer-guide", title: "White-tailed deer hunting guide", publisher: "Government of Ontario", url: "https://docs.ontario.ca/documents/2811/guide-whitetail-deer.pdf", kind: "HUNTING_EDUCATION", reviewedAt: "2026-10-06", note: "Ontario deer biology, hunting practice, safety and retrieval." },
    { id: "source:ontario-hunting-regulations", title: "Ontario hunting regulations summary", publisher: "Government of Ontario", url: "https://www.ontario.ca/document/ontario-hunting-regulations-summary", kind: "REGULATORY_AUTHORITY", reviewedAt: "2026-10-06", note: "Current authority handoff for Ontario rules; page content is not a substitute." },
    { id: "source:north-ground-whitetail-surface", title: "White-tailed deer Species Heat surface 2.1.0", publisher: "North Ground", url: "https://www.northgroundbushcraft.com/hunt?species=white-tailed-deer&explore=1", kind: "GEOSPATIAL", reviewedAt: "2026-10-06", note: "Production-verified range-and-habitat model, methodology, confidence and limitations." },
  ],
  speciesReferences: [{ speciesId: "species:mule-deer", label: "Mule deer", path: "/hunting/species/mule-deer" }],
  huntLinks: { legality: "/hunt?species=white-tailed-deer", map: "/hunt?species=white-tailed-deer&explore=1" },
  visualAssets: [
    { id: "visual:primary-photo", purpose: "Hero identification photograph", status: "AVAILABLE", requirement: "Use only the verified species-media PRIMARY record with creator, licence and source." },
    { id: "visual:shot-placement", purpose: "Broadside and quartering-away anatomy", status: "NEEDS_ORIGINAL_DIAGRAM", requirement: "Original anatomically reviewed vector; show heart-lung volume, both legs, path through chest, unsafe angles and no universal aiming dot." },
    { id: "visual:track-comparison", purpose: "Track and gait comparison", status: "NEEDS_ORIGINAL_DIAGRAM", requirement: "Original scale-aware white-tail vs mule-deer track and gait plate with substrate caveat." },
    { id: "visual:seasonal-habitat", purpose: "Seasonal needs diagram", status: "NEEDS_ORIGINAL_DIAGRAM", requirement: "Four-season food-cover movement model labelled as a conceptual guide, not occurrence data." },
  ],
};
