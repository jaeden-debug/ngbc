#!/usr/bin/env node
/* Wave 3: the 73 researched species not yet published (research/hunting/species-master.csv). Same pipeline as wave 2. */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NOW = "2026-09-30T12:00:00Z";
const REVIEWED = "2026-09-30";

function parseCsv(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...records] = rows;
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const speciesRows = parseCsv(await readFile(resolve(ROOT, "research/hunting/species-master.csv"), "utf8"));
const aliasRows = parseCsv(await readFile(resolve(ROOT, "research/hunting/species-aliases.csv"), "utf8"));
const groupRows = parseCsv(await readFile(resolve(ROOT, "research/hunting/species-groups.csv"), "utf8"));
const speciesById = new Map(speciesRows.map((row) => [row.species_id, row]));

const waves = {
  "3a": ["aberts-squirrel","american-badger","american-bison","axis-deer","barbary-sheep","bighorn-sheep","black-tailed-jackrabbit","brush-rabbit","collared-peccary","dall-sheep","desert-cottontail","fallow-deer","fox-squirrel","mountain-cottontail","mountain-goat","mountain-lion","muskox","muskrat","new-england-cottontail","nilgai","north-american-river-otter","nutria","polar-bear","sika-deer","striped-skunk","swamp-rabbit","virginia-opossum","white-tailed-jackrabbit","wild-boar","wolverine","woodchuck"],
  "3b": ["california-quail","chukar","dusky-grouse","gambels-quail","greater-prairie-chicken","greater-sage-grouse","gunnison-sage-grouse","lesser-prairie-chicken","montezuma-quail","mountain-quail","northern-bobwhite","scaled-quail","sooty-grouse","white-tailed-ptarmigan"],
  "3c": ["american-coot","american-crow","band-tailed-pigeon","black-scoter","cinnamon-teal","common-eider","common-gallinule","common-merganser","eurasian-collared-dove","fish-crow","harlequin-duck","hooded-merganser","king-eider","king-rail","long-tailed-duck","mute-swan","purple-gallinule","red-breasted-merganser","rosss-goose","ruddy-duck","sora","surf-scoter","trumpeter-swan","tundra-swan","virginia-rail","white-tailed-ptarmigan-placeholder","white-winged-dove","white-winged-scoter","whooping-crane"].filter((slug) => !slug.endsWith("-placeholder")),
};

const details = {
  "aberts-squirrel": ["Large tree squirrel with prominent ear tufts, a gray back often with a reddish stripe, and a white-fringed tail.", "Ponderosa pine forests of the southwestern United States, including Arizona, New Mexico and Colorado.", ["fox-squirrel"]],
  "american-badger": ["Flat, low-bodied mustelid with a white stripe from the nose over the head, black facial patches and long front claws.", "Open grassland, prairie, farmland and sagebrush with soils suited to digging.", []],
  "american-bison": ["The largest North American land mammal: a massive head, high shoulder hump, short curved horns in both sexes and a shaggy dark-brown coat on the forequarters.", "Managed herds on prairie and parkland; free-ranging herds are limited and mostly on public or protected lands.", ["muskox"]],
  "american-coot": ["Slate-gray, duck-like rail with a white bill and frontal shield, red eye and lobed rather than webbed toes.", "Freshwater marshes, ponds and lakes with emergent vegetation; winters on open water farther south.", ["common-gallinule"]],
  "american-crow": ["All-black bird with a stout bill, a fan-shaped tail in flight and a familiar 'caw' call.", "Farmland, woodland edges, towns and cities across most of North America.", ["fish-crow"]],
  "axis-deer": ["Rufous-brown deer that keeps white spots into adulthood, with a white throat patch and, in males, long three-tined antlers.", "Introduced to Texas and Hawaii; open woodland and savanna-like ranchland.", ["fallow-deer","white-tailed-deer"]],
  "band-tailed-pigeon": ["Large gray pigeon with a yellow bill, a white crescent on the nape and a pale gray band at the tail tip.", "Mountain and coastal forests of western North America, especially oak and conifer woodland.", ["mourning-dove","eurasian-collared-dove"]],
  "barbary-sheep": ["Sandy-brown wild sheep (aoudad) with a long fringe of hair on the throat, chest and forelegs and heavy outward-curving horns in both sexes.", "Introduced to rugged arid country of Texas and New Mexico.", ["bighorn-sheep"]],
  "bighorn-sheep": ["Stocky brown sheep with a white rump patch and muzzle; rams carry massive curling horns, ewes short slender horns.", "Steep rocky terrain, alpine meadows and desert mountains of western North America.", ["dall-sheep","mountain-goat"]],
  "black-scoter": ["Males are entirely black with a knobbed orange-yellow bill; females are dark brown with pale cheeks.", "Breeds in northern wetlands; winters on coastal ocean waters.", ["surf-scoter","white-winged-scoter"]],
  "black-tailed-jackrabbit": ["Large hare with very long black-tipped ears and a black stripe along the top of the tail; it does not turn white in winter.", "Deserts, grasslands and farmland of the western United States.", ["white-tailed-jackrabbit","desert-cottontail"]],
  "brush-rabbit": ["Small dark-brown rabbit with short ears and a small tail that shows little white.", "Dense brush and chaparral of the Pacific coast from Oregon to Baja California.", ["desert-cottontail","mountain-cottontail"]],
  "california-quail": ["Plump gray-and-brown quail with a forward-drooping black head plume; males have a black face bordered in white.", "Brushy foothills, farm edges and suburbs of the Pacific states, with introduced populations in British Columbia and elsewhere.", ["gambels-quail","mountain-quail"]],
  chukar: ["Gray-brown partridge with a red bill and legs, a black band from the eye around the throat, and boldly barred flanks.", "Introduced; steep, rocky arid slopes and canyons of the western United States and southern British Columbia.", ["gray-partridge"]],
  "cinnamon-teal": ["Breeding males are deep cinnamon-red with a red eye; females resemble blue-winged teal but are warmer brown with a longer bill.", "Western marshes and wetlands, breeding mainly in the western United States and southwestern Canada.", ["blue-winged-teal","green-winged-teal"]],
  "collared-peccary": ["Pig-like but not a pig: a grizzled gray-black coat, a pale collar around the shoulders and short straight tusks.", "Deserts, brushland and oak woodland of Texas, New Mexico and Arizona.", ["wild-boar"]],
  "common-eider": ["Large sea duck with a long sloping bill profile; males are black and white with a green nape, females barred brown.", "Northern coasts; breeds on islands and coastal tundra and winters on cold ocean waters.", ["king-eider"]],
  "common-gallinule": ["Dark rail with a red frontal shield, a yellow-tipped red bill and a white line along the flanks.", "Freshwater marshes with dense emergent vegetation, mainly in the eastern and southern United States.", ["american-coot","purple-gallinule"]],
  "common-merganser": ["Large diving duck with a narrow serrated red bill; males are white-bodied with a dark green head, females gray with a rusty crested head.", "Rivers, lakes and reservoirs with clear water across northern and western North America.", ["red-breasted-merganser","hooded-merganser"]],
  "dall-sheep": ["Thinhorn sheep with slender amber horns that flare outward; the coat is white in Dall's sheep and dark in the Stone's form.", "Alpine and subalpine mountains of Alaska, Yukon, northern British Columbia and the Northwest Territories.", ["bighorn-sheep","mountain-goat"]],
  "desert-cottontail": ["Pale gray-brown cottontail with relatively long ears and a white cottony tail.", "Arid grassland, desert and brush of the western and southwestern United States.", ["mountain-cottontail","black-tailed-jackrabbit"]],
  "dusky-grouse": ["Large dark grouse; males are slate-gray with a black tail and, in display, a red neck patch bordered by white feathers.", "Interior mountain conifer forests of the Rockies, interior British Columbia and Yukon.", ["sooty-grouse","spruce-grouse","ruffed-grouse"]],
  "eurasian-collared-dove": ["Pale sandy-gray dove with a black half-collar on the nape and a squared tail with white corners.", "Introduced; towns, farms and suburbs across much of the United States, expanding into southern Canada.", ["mourning-dove","white-winged-dove"]],
  "fallow-deer": ["Medium deer with a spotted coat in many colour forms, a long tail and palmated antlers in males.", "Introduced; parkland, farms and ranches, with free-ranging populations in limited areas.", ["axis-deer","sika-deer"]],
  "fish-crow": ["Nearly identical to American crow but smaller; its nasal 'uh-uh' call is the most reliable distinction.", "Coastal and river lowlands of the eastern and southern United States.", ["american-crow"]],
  "fox-squirrel": ["Large tree squirrel, typically rusty-orange below, with colour forms from gray to black; larger than eastern gray squirrel.", "Open woodland, woodlots and river bottoms of the eastern and central United States and far southern Canada.", ["eastern-gray-squirrel","aberts-squirrel"]],
  "gambels-quail": ["Gray quail with a forward-drooping head plume and chestnut flanks; males have a black belly patch and a rusty crown.", "Desert scrub and washes of the southwestern United States.", ["california-quail","scaled-quail"]],
  "greater-prairie-chicken": ["Barred brown grouse with a short dark tail; displaying males inflate orange neck sacs and raise long neck feathers.", "Tallgrass and mixed-grass prairie of the central United States.", ["lesser-prairie-chicken","sharp-tailed-grouse"]],
  "greater-sage-grouse": ["The largest North American grouse: mottled gray-brown with a black belly and a long pointed tail; displaying males show white chest ruffs and yellow air sacs.", "Sagebrush steppe of the western United States and very limited parts of Alberta and Saskatchewan.", ["gunnison-sage-grouse","sharp-tailed-grouse"]],
  "gunnison-sage-grouse": ["Smaller than greater sage-grouse, with bold white bands across the tail and thicker plumes behind the head in displaying males.", "Sagebrush of southwestern Colorado and southeastern Utah only.", ["greater-sage-grouse"]],
  "harlequin-duck": ["Small sea duck; males are slate-blue with chestnut flanks and bold white markings, females dark with white face spots.", "Breeds on fast mountain streams and winters along rocky coastal surf.", ["bufflehead","long-tailed-duck"]],
  "hooded-merganser": ["Small merganser with a thin bill; males show a large white fan-shaped crest bordered in black, females a cinnamon crest.", "Forested ponds, rivers and wetlands with cavity-nesting trees.", ["common-merganser","bufflehead"]],
  "king-eider": ["Males have a large orange frontal shield outlined in black and a pale blue-gray crown; females are rich brown with an upturned bill line.", "Breeds in the High Arctic and winters on northern ocean waters.", ["common-eider"]],
  "king-rail": ["Large rusty rail with a long bill and barred black-and-white flanks.", "Freshwater and brackish marshes of the eastern and central United States.", ["virginia-rail","sora"]],
  "lesser-prairie-chicken": ["Smaller and paler than greater prairie-chicken; displaying males show red-orange air sacs.", "Sand-sage and shinnery-oak prairie of the southern Great Plains.", ["greater-prairie-chicken"]],
  "long-tailed-duck": ["Compact sea duck; males have long central tail feathers, and plumage changes strongly between seasons.", "Breeds on Arctic tundra ponds and winters on large lakes and coastal waters.", ["harlequin-duck","black-scoter"]],
  "montezuma-quail": ["Round, short-tailed quail; males have a bold black-and-white harlequin face and white-spotted dark flanks.", "Grassy oak and pine woodland of southeastern Arizona, southwestern New Mexico and west Texas.", ["scaled-quail","gambels-quail"]],
  "mountain-cottontail": ["Gray-brown cottontail with short black-tipped ears and furry hind feet.", "Sagebrush, brush and mountain forest openings of the interior West and southern interior British Columbia.", ["desert-cottontail","eastern-cottontail"]],
  "mountain-goat": ["White goat-antelope with a shaggy coat, a beard and short black dagger-like horns in both sexes.", "Steep cliffs and alpine terrain of western mountains from Alaska and Yukon to the northern Rockies.", ["dall-sheep","bighorn-sheep"]],
  "mountain-lion": ["Large, uniformly tawny cat with a long black-tipped tail; kittens are spotted.", "Mountains, forests, canyons and brush of western North America, with a small population in Florida.", ["bobcat","canada-lynx"]],
  "mountain-quail": ["Large quail with a long straight head plume, a chestnut throat outlined in white and bold white flank bars.", "Brushy mountain slopes and chaparral of the Pacific states and parts of the Great Basin.", ["california-quail"]],
  muskox: ["Stocky Arctic ungulate with a long shaggy dark coat and broad horns that sweep down and up from a central boss.", "Arctic tundra of Canada, Greenland and Alaska.", ["american-bison"]],
  muskrat: ["Large aquatic rodent with dark brown fur and a long, scaly, vertically flattened tail.", "Marshes, ponds, streams and ditches across most of North America.", ["beaver","nutria"]],
  "mute-swan": ["Large white swan with an orange bill topped by a black knob; often holds its neck in an S-curve.", "Introduced; ponds, lakes and coastal waters of the northeastern United States and the Great Lakes.", ["tundra-swan","trumpeter-swan"]],
  "new-england-cottontail": ["Very similar to eastern cottontail; reliable separation often needs a skull or genetic check.", "Early-successional shrubland in parts of New England and eastern New York.", ["eastern-cottontail"]],
  nilgai: ["Large antelope with a sloping back; bulls are blue-gray with short horns and a throat tuft, cows tawny.", "Introduced to the coastal plains and brushland of south Texas.", []],
  "north-american-river-otter": ["Long streamlined mustelid with dense brown fur, webbed feet and a thick tapered tail.", "Rivers, lakes, marshes and coastal waters across much of North America.", ["american-mink","beaver"]],
  "northern-bobwhite": ["Small round quail; males have a white throat and eyebrow stripe, females a buff one.", "Farmland, grassland and open pine woodland of the eastern and central United States.", ["scaled-quail"]],
  nutria: ["Large introduced aquatic rodent with orange incisors, white whiskers and a round, sparsely haired tail.", "Introduced; marshes and waterways of the southern United States and the Pacific Northwest.", ["beaver","muskrat"]],
  "polar-bear": ["Large white to cream bear with a long neck and a relatively small head.", "Arctic sea ice and coasts of Canada, Alaska and Greenland.", ["brown-bear"]],
  "purple-gallinule": ["Brilliant purple-blue and green rail with a pale blue frontal shield and yellow legs.", "Southern freshwater marshes with floating vegetation.", ["common-gallinule","american-coot"]],
  "red-breasted-merganser": ["Merganser with a shaggy double crest; males have a speckled rusty breast and a white collar.", "Breeds on northern lakes and rivers and winters mainly on coastal saltwater.", ["common-merganser","hooded-merganser"]],
  "rosss-goose": ["Small white goose with black wingtips and a short stubby bill without the black 'grin patch' of snow goose.", "Breeds in the central Canadian Arctic; migrates and winters with snow geese.", ["snow-goose"]],
  "ruddy-duck": ["Small stiff-tailed duck; breeding males are chestnut with a bright blue bill and white cheeks.", "Freshwater marshes and ponds; winters on lakes and bays.", ["bufflehead","lesser-scaup"]],
  "scaled-quail": ["Pale blue-gray quail with scaly-looking breast feathers and a white-tipped cottony crest.", "Arid grassland and desert scrub of the southern Great Plains and Southwest.", ["gambels-quail","northern-bobwhite"]],
  "sika-deer": ["Small Asian deer with a spotted summer coat, a white rump patch and simple branched antlers in males.", "Introduced; marsh and forest of Maryland and Virginia and some private ranches.", ["white-tailed-deer","fallow-deer"]],
  "sooty-grouse": ["Large dark grouse very like dusky grouse; displaying males show a yellow neck patch, and the tail usually has a gray band.", "Coastal conifer forests from southeastern Alaska through coastal British Columbia to California.", ["dusky-grouse","spruce-grouse","ruffed-grouse"]],
  sora: ["Small gray-brown rail with a short yellow bill and a black face patch.", "Freshwater marshes across North America.", ["virginia-rail","king-rail"]],
  "striped-skunk": ["Black mammal with a white stripe on the forehead and two white stripes along the back, and a bushy tail.", "Farmland, woodland edges and towns across southern Canada and the United States.", []],
  "surf-scoter": ["Males are black with white patches on the forehead and nape and a colourful swollen bill; females are dark brown with pale face patches.", "Breeds in northern boreal wetlands and winters on coastal waters.", ["black-scoter","white-winged-scoter"]],
  "swamp-rabbit": ["Large cottontail with dark brown fur, short rounded ears and a white tail; it readily swims.", "Bottomland swamps and river floodplains of the south-central United States.", ["eastern-cottontail"]],
  "trumpeter-swan": ["The largest North American waterfowl: all white with a long all-black bill that meets the eye in a V.", "Breeds in Alaska, western Canada and restored areas of the northern United States; winters on open water.", ["tundra-swan","mute-swan"]],
  "tundra-swan": ["White swan with a black bill that usually shows a small yellow spot in front of the eye; smaller than trumpeter swan.", "Breeds on Arctic tundra and winters on large wetlands and coasts.", ["trumpeter-swan","mute-swan"]],
  "virginia-opossum": ["Cat-sized marsupial with a pale face, dark ears and a long bare prehensile tail.", "Woodland, farmland and towns across the eastern United States and southern Ontario.", ["raccoon"]],
  "virginia-rail": ["Small rusty rail with gray cheeks and a long, slightly downcurved red bill.", "Freshwater and brackish marshes across much of North America.", ["sora","king-rail"]],
  "white-tailed-jackrabbit": ["Large hare with long ears and an all-white tail; in the north it turns white in winter.", "Open prairie, sagebrush and grassland of the northern Great Plains and interior West.", ["black-tailed-jackrabbit","snowshoe-hare"]],
  "white-tailed-ptarmigan": ["The smallest ptarmigan: an all-white tail in every season, white in winter and mottled gray-brown in summer.", "Alpine tundra above the treeline in western mountains from Alaska to New Mexico.", ["rock-ptarmigan","willow-ptarmigan"]],
  "white-winged-dove": ["Brown dove with a bold white bar across the wing and a squared tail with white corners.", "Desert, brushland and towns of the southern United States.", ["mourning-dove","eurasian-collared-dove"]],
  "white-winged-scoter": ["The largest scoter, with a white wing patch in flight; males are black with a white teardrop by the eye.", "Breeds on northern lakes and winters on coastal waters and the Great Lakes.", ["surf-scoter","black-scoter"]],
  "whooping-crane": ["Very tall all-white crane with a red crown and black wingtips visible in flight.", "Breeds in and near Wood Buffalo National Park, winters on the Texas coast and migrates through the Great Plains.", ["sandhill-crane"]],
  "wild-boar": ["Wild pig with a coarse bristly coat, a long snout and tusks; feral populations vary from black to brown or spotted.", "Introduced; feral populations across much of the southern United States, and invasive wild pigs in parts of the Canadian Prairies.", ["collared-peccary"]],
  wolverine: ["Stocky, bear-like mustelid with dark brown fur and pale bands along the sides and across the forehead.", "Remote boreal forest, tundra and mountains of northern and western North America.", ["fisher","american-badger"]],
  woodchuck: ["Heavy-bodied ground squirrel with grizzled brown fur, short legs and a short bushy tail.", "Fields, meadows and forest edges across eastern North America and much of Canada.", []],
};

/**
 * Species whose take eligibility is not plain HUNTABLE. Every species not named
 * here was researched as taken as game somewhere; these were not.
 * - PROTECTED: no authority permits take; the page is identification safety.
 * - REMOVAL: nuisance or invasive take, not a game season, and not protected for
 *   being untraditional (the research notes: "legal treatment varies from game to
 *   invasive control", "control classification differs from game hunting").
 * - UNVERIFIED: no current take established. Lesser prairie-chicken seasons are
 *   closed under federal listing and New England cottontail was included for
 *   identification; neither is called protected without a source saying so.
 */
const takeEligibility = {
  "whooping-crane": "PROTECTED", "trumpeter-swan": "PROTECTED", "gunnison-sage-grouse": "PROTECTED",
  "wild-boar": "REMOVAL", "nutria": "REMOVAL", "mute-swan": "REMOVAL",
  "lesser-prairie-chicken": "UNVERIFIED", "new-england-cottontail": "UNVERIFIED",
};

const protectedLookalikes = {
  "whooping-crane": {
    quick: "Whooping crane is a very tall white crane that is easily confused with sandhill crane at distance or in poor light.",
    marks: [
      "At range: whooping crane is white with black wingtips that show only in flight; sandhill crane is gray (often rust-stained) with no black in the wing.",
      "Size: whooping crane stands about 1.5 m tall, noticeably larger than sandhill crane; in mixed flocks it stands out as the white bird.",
      "Head: whooping crane has a red crown and black facial moustache on a white head; sandhill crane has a red forehead on a gray head.",
    ],
    rule: "Whooping cranes migrate through the same prairie country and at the same time of year as sandhill cranes, often in mixed flocks. Identify every bird before you shoot: at dawn, in fog or against the sky, colour can be hard to read. If any bird in a flock could be a whooping crane, do not shoot.",
    appliesTo: ["species:sandhill-crane"],
    status: { text: "Whooping crane is listed as Endangered on Schedule 1 of Canada's Species at Risk Act and is protected under the Migratory Birds Convention Act, 1994.",
      source: { id:"source:ca-sara-whooping-crane", authority:"Environment and Climate Change Canada", title:"Whooping crane (Grus americana) recovery strategy", url:"https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/recovery-strategies/whooping-crane.html", publisher:"Government of Canada", retrievedAt:"2026-09-30T12:00:00Z", type:"official", verificationStatus:"verified" } },
  },
  "trumpeter-swan": {
    quick: "Trumpeter swan is the largest North American waterfowl and is easily confused with tundra swan.",
    marks: [
      "Bill: trumpeter swan has an all-black bill; most tundra swans show a small yellow spot in front of the eye, but some do not, so a missing spot does not prove a trumpeter.",
      "Profile: the trumpeter's black bill meets the eye in a broad V and its bill looks long and straight; the tundra swan's facial skin narrows to a point at the eye.",
      "Voice: trumpeter swans give a deep, horn-like honk; tundra swans have a higher, yelping call.",
    ],
    rule: "Swans are hard to tell apart at hunting distance, and a missing yellow spot is not proof. Where a swan season is open, confirm the species before you shoot; if you are not certain, do not shoot.",
    appliesTo: ["species:tundra-swan"],
  },
  "gunnison-sage-grouse": {
    quick: "Gunnison sage-grouse is a smaller relative of greater sage-grouse found only in southwestern Colorado and southeastern Utah.",
    marks: [
      "Tail: Gunnison sage-grouse show distinct pale bands across the tail; greater sage-grouse tails are more uniformly marked.",
      "Size: Gunnison sage-grouse are about one-third smaller than greater sage-grouse.",
      "Range: the two species do not overlap; any sage-grouse in southwestern Colorado or southeastern Utah should be treated as Gunnison until the responsible authority's map says otherwise.",
    ],
    rule: "Sage-grouse seasons, where they exist, are set for greater sage-grouse in specific areas. Check the responsible authority's map and species before hunting near the Gunnison range, and if you are not certain which species you are looking at, do not shoot.",
    appliesTo: ["species:greater-sage-grouse"],
  },
};
for (const slug of Object.keys(protectedLookalikes)) if (takeEligibility[slug] !== "PROTECTED") throw new Error(`${slug} is a protected lookalike page but not PROTECTED`);

/* Entities and groups already published are read from the bundles rather than
   listed by hand, so a wave never re-emits one and never misses one. */
const publishedFiles = ["en-CA","species-wave-1","species-wave-2a","species-wave-2b","species-wave-2c","species-wave-2d"];
const publishedBundles = await Promise.all(publishedFiles.map(async (name) => JSON.parse(await readFile(resolve(ROOT, `content/published/${name}.json`), "utf8"))));
const existingEntityIds = new Set(publishedBundles.flatMap((bundle) => (bundle.entities ?? []).map((entity) => entity.id)));
const existingGroupIds = new Set([...existingEntityIds].filter((id) => id.startsWith("species_group:")));
const publishedSpeciesIds = publishedBundles.flatMap((bundle) => (bundle.resources ?? []).filter((resource) => resource.type === "species").map((resource) => resource.speciesProfile.speciesId));
const emittedGroups = new Set();
const productionSpeciesIds = new Set([
  ...publishedSpeciesIds,
  ...Object.values(waves).flat().map((slug) => `species:${slug}`),
]);

function groupLineage(groupId) {
  const lineage = [];
  let current = groupRows.find((row) => row.species_group_id === groupId);
  while (current) {
    lineage.push(current.species_group_id);
    current = current.parent_group_id ? groupRows.find((row) => row.species_group_id === current.parent_group_id) : undefined;
  }
  return lineage;
}

function sourceFor(row) {
  const slug = row.species_id.slice(8);
  const bird = ["Galliformes","Charadriiformes","Gruiformes","Columbiformes","Anseriformes"].includes(row.order);
  if (bird) {
    const page = row.common_name_en.replace(/[’']/g, "").replace(/ /g, "_");
    return { id:`source:cornell-${slug}`, authority:"Cornell Lab of Ornithology", title:`${row.common_name_en} identification and life history`, url:`https://www.allaboutbirds.org/guide/${page}/id`, publisher:"Cornell Lab of Ornithology", retrievedAt:NOW, type:"scientific", verificationStatus:"verified" };
  }
  const special = {
    "eastern-wolf":["Environment and Climate Change Canada","Eastern Wolf COSEWIC assessment and status report","https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/eastern-wolf-canis-sp-cf-lycaon-2015.html"],
    "gray-wolf":["Gouvernement du Québec","Loup gris","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/loup"],
    coyote:["Gouvernement du Québec","Coyote","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/coyote"],
    "red-fox":["Gouvernement du Québec","Renard roux","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/renard-roux"],
    "gray-fox":["Government of Ontario","Gray fox","https://www.ontario.ca/page/grey-fox"],
    "arctic-fox":["Gouvernement du Québec","Renard arctique","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/renard-arctique"],
    "canada-lynx":["Gouvernement du Québec","Lynx du Canada","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/lynx-canada"],
    bobcat:["Gouvernement du Québec","Lynx roux","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/lynx-roux"],
    "eastern-cottontail":["Gouvernement du Québec","Lapin à queue blanche","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/lapin-queue-blanche"],
    "arctic-hare":["Gouvernement du Québec","Lièvre arctique","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/lievre-arctique"],
    "american-red-squirrel":["Gouvernement du Québec","Écureuil roux","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/ecureuil-roux"],
    "eastern-gray-squirrel":["Gouvernement du Québec","Écureuil gris","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/ecureuil-gris"],
    beaver:["Gouvernement du Québec","Castor","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/castor"],
    raccoon:["Gouvernement du Québec","Raton laveur","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/raton-laveur"],
    "american-mink":["Gouvernement du Québec","Vison d'Amérique","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/vison-amerique"],
    fisher:["Gouvernement du Québec","Pékan","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/pekan"],
    "american-marten":["Gouvernement du Québec","Martre d'Amérique","https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/martre-amerique"],
    elk:["Parks Canada","Elk in Banff National Park","https://parks.canada.ca/pn-np/ab/banff/nature/faune-wildlife/mammal/ongules/cervids/wapiti"],
    "mule-deer":["Parks Canada","Deer family — Kootenay National Park","https://parks.canada.ca/pn-np/bc/kootenay/nature/faune-fauna/cervids"],
    pronghorn:["Government of Alberta","Watchable Wildlife — Pronghorn","https://open.alberta.ca/dataset/adbc7152-9e43-48f3-8ad2-79167cac7a9c/resource/465fc01f-899e-4ce2-99c1-9fb38e58a0eb/download/2014-12-19-watchable-wildlife-calendar-2015.pdf"],
    "brown-bear":["Parks Canada","Grizzly bear identification","https://parks.canada.ca/pn-np/nt/thaidene-nene/security-safety/ours-bears/identification"],
    caribou:["Parks Canada","Southern Mountain Caribou conservation","https://parks.canada.ca/nature/science/especes-species/caribou"],
  }[slug];
  if (special) return { id:`source:official-${slug}`, authority:special[0], title:special[1], url:special[2], publisher:special[0], retrievedAt:NOW, type:"official", verificationStatus:"verified" };
  return { id:`source:itis-${slug}`, authority:"Integrated Taxonomic Information System", title:`${row.common_name_en} taxonomic record`, url:"https://www.itis.gov/", publisher:"Integrated Taxonomic Information System", retrievedAt:NOW, type:"scientific", verificationStatus:"verified" };
}

function term(value, kind, dimension, intentValue, regulatory = false) {
  return { value, locale:"en-CA", kind, intent: regulatory ? { kind:"REGULATORY_CLASS", dimension, value:intentValue } : { kind:"BIOLOGICAL", dimension, value:intentValue } };
}

const sexAge = {
  elk: [term("bull elk","sex_term","SEX","MALE"),term("cow elk","sex_term","SEX","FEMALE"),term("elk calf","age_term","AGE_CLASS","CALF")],
  caribou: [term("bull caribou","sex_term","SEX","MALE"),term("cow caribou","sex_term","SEX","FEMALE"),term("caribou calf","age_term","AGE_CLASS","CALF")],
  "mule-deer": [term("mule deer buck","sex_term","SEX","MALE"),term("mule deer doe","sex_term","SEX","FEMALE"),term("mule deer fawn","age_term","AGE_CLASS","FAWN")],
};

for (const [wave, slugs] of Object.entries(waves)) {
  const selected = slugs.map((slug) => speciesById.get(`species:${slug}`));
  if (selected.some((row) => !row)) throw new Error(`Missing research species in wave ${wave}`);
  const sources = selected.map(sourceFor);
  const entities = [];
  const groupsNeeded = new Set(selected.flatMap((row) => groupLineage(row.major_group)));
  for (const groupId of groupsNeeded) {
    if (existingGroupIds.has(groupId) || emittedGroups.has(groupId)) continue;
    const group = groupRows.find((row) => row.species_group_id === groupId);
    entities.push({ id:groupId, type:"species_group", status:"active", names:[{locale:"en-CA",value:group.name_en},{locale:"fr-CA",value:group.name_fr}], aliases: groupId === "species_group:waterfowl" ? [{value:"waterfowl",locale:"en-CA",type:"common_name",verificationStatus:"verified"}] : groupId === "species_group:upland-game-birds" ? [{value:"upland bird",locale:"en-CA",type:"common_name",verificationStatus:"verified"}] : groupId === "species_group:migratory-game-birds" ? [{value:"migratory bird",locale:"en-CA",type:"common_name",verificationStatus:"verified"}] : [], createdAt:NOW, updatedAt:NOW });
    emittedGroups.add(groupId);
  }
  if (false) entities.push({ id:"activity:trapping", type:"activity", status:"active", names:[{locale:"en-CA",value:"Trapping"},{locale:"fr-CA",value:"Piégeage"}], createdAt:NOW, updatedAt:NOW });
  for (const row of selected) {
    if (existingEntityIds.has(row.species_id)) continue;
    const relevantAliases = aliasRows.filter((alias) => alias.species_id === row.species_id || alias.candidate_species_ids.split("|").includes(row.species_id));
    /* Names a hunter types for a species, published as verified common names.
       Feral swine: the research flags that agency DEFINITIONS vary (wild boar,
       feral domestic pigs, hybrids); the names themselves all denote feral Sus
       scrofa, and hunting pages use them. */
    const huntersNames = { "wild-boar": ["feral swine","feral hog","wild pig","wild hog","feral pig"], sora: ["sora rail"] }[row.species_id.slice(8)] ?? [];
    const categoryAliases = [...(row.major_group === "species_group:hares-rabbits" ? ["rabbit","hare"] : []), ...huntersNames];
    const aliases = [{value:row.scientific_name,type:"scientific_name",verificationStatus:"verified",sourceIds:[sourceFor(row).id]}, ...relevantAliases.map((alias) => ({value:alias.alias,locale:alias.language === "fr" ? "fr-CA" : "en-CA",type:alias.alias_type === "historical_name" ? "historical_name" : "common_name",verificationStatus:alias.verification_status === "SOURCE_FOUND" ? "verified" : "needs_review",sourceIds:[sourceFor(row).id]})), ...categoryAliases.map((value) => ({value,locale:"en-CA",type:"common_name",verificationStatus:"verified",sourceIds:[sourceFor(row).id]}))];
    const dedupedAliases = aliases.filter((alias, index) => aliases.findIndex((candidate) => `${candidate.locale ?? "*"}|${candidate.value.toLocaleLowerCase("en-CA")}` === `${alias.locale ?? "*"}|${alias.value.toLocaleLowerCase("en-CA")}`) === index);
    entities.push({
      id:row.species_id, type:"species", status:"active",
      names:[{locale:"en-CA",value:row.common_name_en},{locale:"fr-CA",value:row.common_name_fr,official:true}],
      slugs:[{locale:"en-CA",value:row.species_id.slice(8)}],
      aliases:dedupedAliases,
      createdAt:NOW, updatedAt:NOW,
    });
  }
  const resources = selected.map((row) => {
    const slug = row.species_id.slice(8), [identification, habitat, related] = details[slug], source = sourceFor(row);
    const activityContexts = row.major_group === "species_group:furbearers" ? [{activityId:"activity:trapping",note:"This species may be managed under trapping or furbearer frameworks; identity does not establish an open season.",sourceIds:[source.id]}] : undefined;
    return {
      id:row.species_id,type:"species",status:"published",locale:"en-CA",slug,canonicalUrl:`/hunting/species/${slug}`,title:row.common_name_en,
      description:`Identify ${row.common_name_en}, compare important lookalikes, and understand its North American range without inferring legal hunting status.`,primaryQuery:row.common_name_en.toLowerCase(),searchIntent:"informational",
      entityIds:[row.species_id,...groupLineage(row.major_group)],speciesIds:[row.species_id],quickAnswer:`${row.common_name_en} (${row.scientific_name}) can be identified as follows: ${identification} This biological profile does not establish whether hunting or trapping is legal.`,
      keyFacts:[{id:"scientific-name",label:"Scientific name",value:row.scientific_name,sourceIds:[source.id]},{id:"family",label:"Family",value:row.family,sourceIds:[source.id]},{id:"range",label:"Range context",value:row.range_summary,sourceIds:[source.id]}],
      sourceIds:[source.id],relatedResourceIds:["tool:season-finder"],relatedSpeciesIds:related.map((id)=>`species:${id}`).filter((id)=>productionSpeciesIds.has(id)),verificationStatus:"verified",fieldTested:false,lastReviewed:REVIEWED,publishedAt:NOW,updatedAt:NOW,
      speciesProfile:{speciesId:row.species_id,commonNames:[{locale:"en-CA",value:row.common_name_en},{locale:"fr-CA",value:row.common_name_fr,official:true}],scientificName:row.scientific_name,takeEligibility:takeEligibility[slug] ?? "HUNTABLE",taxonomy:{order:row.order,family:row.family,genus:row.genus,species:row.species,taxonomySourceId:source.id},...(slug === "eastern-wolf" ? {taxonomicStatus:"contested",taxonomicNotes:[{text:"Authorities differ on eastern wolf taxonomy and ancestry; North Ground preserves the named entity and the uncertainty.",sourceIds:[source.id]}]} : {}),speciesGroupIds:groupLineage(row.major_group),rangeSummary:[{locale:"en-CA",value:row.range_summary}],identification:[{text:identification,sourceIds:[source.id]}],similarSpeciesIds:related.map((id)=>`species:${id}`).filter((id)=>productionSpeciesIds.has(id)),habitat:[{text:habitat,sourceIds:[source.id]}],huntingContext:[{text:"Use Hunt and the responsible authority for current place-, date-, method- and animal-class rules. Library inclusion is not evidence of legal opportunity.",sourceIds:[source.id]}],...(activityContexts ? {activityContexts} : {}),...(sexAge[slug] ? {sexAgeInfo:{terminology:sexAge[slug]}} : {}),sourceIds:[source.id],verificationStatus:"verified",lastReviewed:REVIEWED},
    };
  });
  const relationships = selected.flatMap((row) => {
    const slug = row.species_id.slice(8), source = sourceFor(row);
    return [{id:`rel:${slug}-member-${row.major_group.slice(14)}`,fromId:row.species_id,toId:row.major_group,type:"member_of",direction:"directed",origin:"manual",sourceIds:[source.id],status:"active",createdAt:NOW,updatedAt:NOW}, ...details[slug][2].filter((other)=>productionSpeciesIds.has(`species:${other}`)).map((other)=>({id:`rel:${slug}-similar-${other}`,fromId:row.species_id,toId:`species:${other}`,type:"similar_to",direction:"bidirectional",origin:"manual",sourceIds:[source.id],status:"active",createdAt:NOW,updatedAt:NOW}))];
  });
  const blocks = selected.filter((row)=>details[row.species_id.slice(8)][2].length).map((row)=>({id:`content_block:${row.species_id.slice(8)}.identification.01`,type:"identification_warning",ownerId:row.species_id,status:"published",locale:"en-CA",title:"Lookalike caution",content:{plainText:`Do not identify ${row.common_name_en} from colour alone. Compare structure, size, range and the listed similar species before making a field decision.`},priority:90,applicability:{speciesIds:[row.species_id],activityIds:["activity:hunting"]},sourceIds:[sourceFor(row).id],verificationStatus:"verified",lastReviewed:REVIEWED,publishedAt:NOW,updatedAt:NOW}));
  /*
   * Protected lookalikes are published as identification SAFETY content: the
   * page exists to stop a misidentification, so it carries field marks that work
   * at range and a plain rule for uncertainty. Legal status is stated only where
   * an official source was read (whooping crane, Canada's SARA registry); nothing
   * else about status is claimed.
   */
  for (const resource of resources) {
    const safety = protectedLookalikes[resource.slug];
    if (!safety) continue;
    const source = sources.find((item) => item.id === resource.sourceIds[0]);
    resource.speciesProfile.identification.push(...safety.marks.map((text) => ({ text, sourceIds: [source.id] })));
    resource.quickAnswer = `${safety.quick} Do not shoot unless you are certain of the species.`;
    blocks.push({ id:`content_block:${resource.slug}.safety.01`, type:"safety_note", ownerId:resource.id, status:"published", locale:"en-CA", title:"If you are not certain, do not shoot",
      content:{ plainText: safety.rule }, priority:100, applicability:{ speciesIds:[...safety.appliesTo, resource.id], activityIds:["activity:hunting"] },
      sourceIds:[source.id], verificationStatus:"verified", lastReviewed:REVIEWED, publishedAt:NOW, updatedAt:NOW });
    if (safety.status) {
      if (!sources.some((item) => item.id === safety.status.source.id)) sources.push(safety.status.source);
      resource.sourceIds.push(safety.status.source.id);
      resource.speciesProfile.sourceIds.push(safety.status.source.id);
      blocks.push({ id:`content_block:${resource.slug}.legal.01`, type:"legal_note", ownerId:resource.id, status:"published", locale:"en-CA", title:"Protection status",
        content:{ plainText: safety.status.text }, priority:95, applicability:{ speciesIds:[resource.id], activityIds:["activity:hunting"] },
        sourceIds:[safety.status.source.id], verificationStatus:"verified", lastReviewed:REVIEWED, publishedAt:NOW, updatedAt:NOW });
    }
  }
  const bundle = {contractVersion:"1.0",generatedAt:NOW,entities,resources,blocks,relationships,sources,claims:[],media:[]};
  await writeFile(resolve(ROOT,`content/published/species-wave-${wave}.json`),`${JSON.stringify(bundle,null,2)}\n`);
  console.log(`wave ${wave}: ${resources.length} production species`);
}
