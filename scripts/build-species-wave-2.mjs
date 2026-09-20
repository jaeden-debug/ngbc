#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NOW = "2026-09-20T20:00:00Z";
const REVIEWED = "2026-09-20";

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
  "2a": ["gray-wolf","eastern-wolf","coyote","red-fox","gray-fox","arctic-fox","canada-lynx","bobcat","eastern-cottontail","arctic-hare","american-red-squirrel","eastern-gray-squirrel","beaver","raccoon","american-mink","fisher","american-marten"],
  "2b": ["willow-ptarmigan","rock-ptarmigan","ring-necked-pheasant","gray-partridge","american-woodcock","wilsons-snipe","sandhill-crane","mourning-dove"],
  "2c": ["american-black-duck","wood-duck","northern-pintail","gadwall","american-wigeon","green-winged-teal","blue-winged-teal","northern-shoveler","canvasback","redhead","ring-necked-duck","greater-scaup","lesser-scaup","common-goldeneye","barrows-goldeneye","bufflehead","snow-goose","cackling-goose","greater-white-fronted-goose","brant"],
  "2d": ["elk","caribou","mule-deer","pronghorn","brown-bear"],
};

const details = {
  "gray-wolf": ["Large canid with a broad muzzle, proportionally small rounded ears and a long, low-carried bushy tail; colour alone is unreliable.", "Forests, tundra, mountains and open country across much of Canada and Alaska.", ["eastern-wolf","coyote"]],
  "eastern-wolf": ["A medium-sized wolf of the Great Lakes–St. Lawrence region; appearance overlaps gray wolf and coyote, and visual identification may be inconclusive.", "Forested landscapes of central Ontario and neighbouring Québec; taxonomy and hybrid ancestry are treated differently by authorities.", ["gray-wolf","coyote"]],
  coyote: ["Slender canid with a narrow muzzle, relatively large pointed ears and a bushy tail usually carried below the back.", "Highly adaptable across forest, farmland, prairie and urban-edge landscapes.", ["gray-wolf","eastern-wolf"]],
  "red-fox": ["Usually red-orange with black legs, pointed ears and a white-tipped tail; silver and cross colour forms also occur.", "Open woodland, farmland, tundra and urban-edge habitat across most of North America.", ["gray-fox","arctic-fox"]],
  "gray-fox": ["Grizzled gray upperparts, rusty sides and a black stripe ending in a black tail tip distinguish it from red fox.", "Woodland and brushy habitat in the southern part of Canada and much of the United States.", ["red-fox"]],
  "arctic-fox": ["Compact fox with small rounded ears and a very full tail; winter coats may be white or blue-gray and summer coats are brown-gray.", "Arctic tundra and coastal environments north of the treeline.", ["red-fox"]],
  "canada-lynx": ["Long legs, very large furry feet, long black ear tufts and a short tail with a completely black tip.", "Boreal forest strongly associated with snowshoe hare populations.", ["bobcat"]],
  bobcat: ["Short-tailed cat with barred forelegs and a tail tip that is black above and pale below; feet are smaller than a Canada lynx's.", "Forest, brush, rocky country and agricultural edges across southern Canada and the United States.", ["canada-lynx"]],
  "eastern-cottontail": ["Compact brown-gray rabbit with a rusty nape and conspicuous white cotton-like tail; it does not turn white in winter.", "Brushy fields, hedgerows and suburban edges in eastern and central North America.", ["snowshoe-hare","mountain-cottontail"]],
  "arctic-hare": ["Large northern hare with short ears and a winter-white coat; summer animals retain white feet and tail.", "Treeless Arctic tundra and rocky polar landscapes.", ["snowshoe-hare"]],
  "american-red-squirrel": ["Small reddish squirrel with a pale eye ring and whitish belly; it is much smaller than an eastern gray squirrel.", "Coniferous and mixed forests across northern North America.", ["eastern-gray-squirrel"]],
  "eastern-gray-squirrel": ["Medium tree squirrel, usually gray with a white belly and large bushy tail; black colour morphs are common in parts of Canada.", "Deciduous and mixed woodland, parks and urban areas in eastern North America.", ["american-red-squirrel"]],
  beaver: ["Large aquatic rodent with a broad flat scaly tail, webbed hind feet and orange incisors.", "Ponds, lakes, rivers and wetlands where woody vegetation is available.", []],
  raccoon: ["Stocky mammal with a black facial mask and a ringed tail.", "Woodland, wetlands, farmland and urban areas, usually near water or cover.", []],
  "american-mink": ["Long, low dark-brown mustelid with a narrow tail and a small white chin patch; substantially smaller than a river otter.", "Shorelines, marshes and wooded waterways across North America.", []],
  fisher: ["Large dark mustelid with a long body, pointed face and long bushy tapering tail.", "Mature and regenerating forest across northern North America.", ["american-marten"]],
  "american-marten": ["Slender mustelid with rounded ears, a bushy tail and a yellow-orange throat bib.", "Coniferous and mixed forests with structural cover across northern North America.", ["fisher"]],
  "willow-ptarmigan": ["Stocky ptarmigan with a relatively heavy bill; breeding males show rich chestnut head and neck, while winter birds are white with black tails.", "Willow thickets and low tundra across the North.", ["rock-ptarmigan"]],
  "rock-ptarmigan": ["Smaller, finer-billed ptarmigan; breeding males have gray upperparts and winter males retain a black eye stripe.", "Rocky Arctic and alpine tundra, generally more exposed than willow ptarmigan habitat.", ["willow-ptarmigan"]],
  "ring-necked-pheasant": ["Male has an iridescent green head, red face and very long barred tail; female is mottled buff-brown with a long pointed tail.", "Introduced populations occupy agricultural fields, grasslands and dense edge cover.", ["gray-partridge"]],
  "gray-partridge": ["Small round gamebird with orange face and throat, barred flanks and a chestnut belly patch that varies by sex and age.", "Open farmland and grassland with hedgerows in introduced North American populations.", ["ruffed-grouse"]],
  "american-woodcock": ["Plump, cryptically patterned shorebird with very short legs, large high-set eyes and a long straight bill.", "Moist young forest and thickets near open singing grounds in eastern North America.", ["wilsons-snipe"]],
  "wilsons-snipe": ["Cryptic marsh bird with a very long straight bill, striped back and a fast zigzag flush.", "Wet meadows, bogs and marsh edges across North America.", ["american-woodcock"]],
  "sandhill-crane": ["Very large gray bird with long legs, outstretched neck in flight and a red forehead; distinguish carefully from endangered whooping crane.", "Open wetlands, grasslands and agricultural landscapes.", []],
  "mourning-dove": ["Slender tan-gray dove with black wing spots, a small head and a long pointed tail edged in white.", "Open woodland, farms, roadsides and urban areas across much of North America.", []],
  "american-black-duck": ["Large dark dabbling duck with a pale head, dark body and violet-blue speculum; females and hybrids can resemble female Mallards.", "Eastern wooded wetlands, salt marshes and coastal estuaries.", ["mallard"]],
  "wood-duck": ["Compact crested duck; males are multicoloured with bold white facial lines, females gray-brown with a distinct white eye patch.", "Wooded swamps, beaver ponds and tree-lined wetlands.", []],
  "northern-pintail": ["Long-necked, slender duck with a pointed tail; males have a chocolate head and white neck stripe, females are finely patterned brown.", "Shallow open wetlands, prairie potholes, marshes and coastal flats.", []],
  gadwall: ["Subtle gray-brown dabbling duck with a white wing patch; males have fine vermiculation and a black rear, females resemble female Mallards but show white in the wing.", "Shallow wetlands with abundant aquatic vegetation.", []],
  "american-wigeon": ["Compact dabbling duck with a short pale bill; males have a green eye patch and white crown, females have a warm gray-brown head.", "Marshes, ponds, lakes and grazed fields.", []],
  "green-winged-teal": ["Very small dabbling duck; males have a chestnut head with green eye patch, and both sexes show a green speculum.", "Shallow marshes, ponds, mudflats and flooded fields.", ["blue-winged-teal"]],
  "blue-winged-teal": ["Small dabbling duck with a powder-blue forewing patch; males show a white facial crescent and females are mottled brown.", "Shallow vegetated wetlands and prairie potholes.", ["green-winged-teal"]],
  "northern-shoveler": ["Dabbling duck with an unmistakably long, broad spoon-shaped bill; males have a green head, white chest and chestnut sides.", "Shallow productive wetlands where the broad bill strains small food from water.", []],
  canvasback: ["Large diving duck with a long sloping forehead and wedge-shaped bill; males have a chestnut head, black chest and pale back.", "Deep marshes, lakes and bays with submerged vegetation.", ["redhead"]],
  redhead: ["Medium diving duck with a rounded head and blue-gray bill; males have a red head, black chest and gray body.", "Prairie marshes, lakes and coastal bays.", ["canvasback"]],
  "ring-necked-duck": ["Compact diving duck with a peaked head and bold bill rings; the chestnut neck ring is usually hard to see.", "Freshwater ponds and lakes, often with emergent vegetation.", []],
  "greater-scaup": ["Broad-headed diving duck with a rounded crown; males have a greenish head sheen and pale finely barred back, but separation from lesser scaup can be difficult.", "Large lakes, coastal bays and estuaries.", ["lesser-scaup"]],
  "lesser-scaup": ["Medium diving duck with a peaked rear crown; males often show a purplish head sheen, but structure and habitat are more useful than sheen alone.", "Inland lakes, ponds and sheltered coastal waters.", ["greater-scaup"]],
  "common-goldeneye": ["Compact diving duck with a large angular head; males have a round white spot before the golden eye, females have a brown head.", "Lakes and rivers near boreal forest, and coastal waters in winter.", ["barrows-goldeneye"]],
  "barrows-goldeneye": ["Males have a crescent-shaped white face patch and black shoulder marks; females are best separated from common goldeneye with multiple traits.", "Rocky lakes and fast rivers in western mountains, with a smaller eastern population.", ["common-goldeneye"]],
  bufflehead: ["Very small diving duck with a large rounded head; males show a broad white head patch and females a smaller white cheek patch.", "Small wooded lakes and ponds, moving to sheltered coastal water in winter.", []],
  "snow-goose": ["White morph is mostly white with black wingtips; blue morph has a dark body and white head. Both have a pink bill with a dark grin patch.", "Arctic breeding grounds, agricultural stopovers and coastal wintering areas.", []],
  "cackling-goose": ["Small, short-necked goose with a steep forehead and short bill; overlaps the smallest Canada geese and requires attention to structure and voice.", "Tundra breeding grounds and open fields, wetlands and coasts during migration and winter.", ["canada-goose"]],
  "greater-white-fronted-goose": ["Brown-gray goose with orange legs, a white patch around the bill and irregular black belly bars on adults.", "Arctic tundra in summer and wetlands or agricultural fields during migration and winter.", []],
  brant: ["Small dark coastal goose with a black head and neck, small white neck patch and short bill.", "Arctic tundra breeding areas and marine coasts rich in eelgrass or algae outside breeding season.", []],
  elk: ["Large deer with a pale rump patch and dark neck; adult bulls carry long branching antlers, while cows do not.", "Western forests, foothills and grasslands, plus some restored eastern populations.", []],
  caribou: ["Medium-large deer with broad hooves and a pale neck and rump; both sexes can grow antlers, so antlers do not establish sex.", "Tundra and boreal landscapes; population and ecotype distinctions are important.", []],
  "mule-deer": ["Large-eared deer with a black-tipped tail and bounding gait; tail and antler form help distinguish it from white-tailed deer.", "Western shrublands, mountains, forests and open country.", ["white-tailed-deer"]],
  pronghorn: ["Tan-and-white ungulate with bold white rump, dark facial markings and branched horn sheaths; it is not a true antelope.", "Open prairie, sagebrush and semi-arid grassland of western North America.", []],
  "brown-bear": ["Large bear with a prominent shoulder hump, dish-shaped facial profile and long foreclaws; colour ranges from blond to nearly black.", "Alaska and western or northern Canada in habitats from coast to alpine and tundra.", ["american-black-bear"]],
};

const existingEntityIds = new Set(["species:american-black-duck", "species:cackling-goose", "species:gray-partridge"]);
const existingGroupIds = new Set(["species_group:big-game","species_group:deer","species_group:turkey","species_group:hares-rabbits","species_group:ducks","species_group:geese","species_group:grouse"]);
const emittedGroups = new Set();
const productionSpeciesIds = new Set([
  "species:ruffed-grouse","species:spruce-grouse","species:sharp-tailed-grouse","species:wild-turkey","species:white-tailed-deer","species:moose","species:american-black-bear","species:snowshoe-hare","species:mallard","species:canada-goose",
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
  if (wave === "2a") entities.push({ id:"activity:trapping", type:"activity", status:"active", names:[{locale:"en-CA",value:"Trapping"},{locale:"fr-CA",value:"Piégeage"}], createdAt:NOW, updatedAt:NOW });
  for (const row of selected) {
    if (existingEntityIds.has(row.species_id)) continue;
    const relevantAliases = aliasRows.filter((alias) => alias.species_id === row.species_id || alias.candidate_species_ids.split("|").includes(row.species_id));
    const categoryAliases = row.major_group === "species_group:hares-rabbits" ? ["rabbit","hare"] : [];
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
      speciesProfile:{speciesId:row.species_id,commonNames:[{locale:"en-CA",value:row.common_name_en},{locale:"fr-CA",value:row.common_name_fr,official:true}],scientificName:row.scientific_name,taxonomy:{order:row.order,family:row.family,genus:row.genus,species:row.species,taxonomySourceId:source.id},...(slug === "eastern-wolf" ? {taxonomicStatus:"contested",taxonomicNotes:[{text:"Authorities differ on eastern wolf taxonomy and ancestry; North Ground preserves the named entity and the uncertainty.",sourceIds:[source.id]}]} : {}),speciesGroupIds:groupLineage(row.major_group),rangeSummary:[{locale:"en-CA",value:row.range_summary}],identification:[{text:identification,sourceIds:[source.id]}],similarSpeciesIds:related.map((id)=>`species:${id}`).filter((id)=>productionSpeciesIds.has(id)),habitat:[{text:habitat,sourceIds:[source.id]}],huntingContext:[{text:"Use Hunt and the responsible authority for current place-, date-, method- and animal-class rules. Library inclusion is not evidence of legal opportunity.",sourceIds:[source.id]}],...(activityContexts ? {activityContexts} : {}),...(sexAge[slug] ? {sexAgeInfo:{terminology:sexAge[slug]}} : {}),sourceIds:[source.id],verificationStatus:"verified",lastReviewed:REVIEWED},
    };
  });
  const relationships = selected.flatMap((row) => {
    const slug = row.species_id.slice(8), source = sourceFor(row);
    return [{id:`rel:${slug}-member-${row.major_group.slice(14)}`,fromId:row.species_id,toId:row.major_group,type:"member_of",direction:"directed",origin:"manual",sourceIds:[source.id],status:"active",createdAt:NOW,updatedAt:NOW}, ...details[slug][2].filter((other)=>productionSpeciesIds.has(`species:${other}`)).map((other)=>({id:`rel:${slug}-similar-${other}`,fromId:row.species_id,toId:`species:${other}`,type:"similar_to",direction:"bidirectional",origin:"manual",sourceIds:[source.id],status:"active",createdAt:NOW,updatedAt:NOW}))];
  });
  const blocks = selected.filter((row)=>details[row.species_id.slice(8)][2].length).map((row)=>({id:`content_block:${row.species_id.slice(8)}.identification.01`,type:"identification_warning",ownerId:row.species_id,status:"published",locale:"en-CA",title:"Lookalike caution",content:{plainText:`Do not identify ${row.common_name_en} from colour alone. Compare structure, size, range and the listed similar species before making a field decision.`},priority:90,applicability:{speciesIds:[row.species_id],activityIds:["activity:hunting"]},sourceIds:[sourceFor(row).id],verificationStatus:"verified",lastReviewed:REVIEWED,publishedAt:NOW,updatedAt:NOW}));
  const bundle = {contractVersion:"1.0",generatedAt:NOW,entities,resources,blocks,relationships,sources,claims:[],media:[]};
  await writeFile(resolve(ROOT,`content/published/species-wave-${wave}.json`),`${JSON.stringify(bundle,null,2)}\n`);
  console.log(`wave ${wave}: ${resources.length} production species`);
}
