#!/usr/bin/env python3
"""Offline structural checks for the hunting research inventory."""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ID_RE = re.compile(r"^[a-z_]+:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

VERIFICATION = {
    "DISCOVERED", "SOURCE_FOUND", "PARTIALLY_VERIFIED", "VERIFIED",
    "CONFLICT", "STALE", "NEEDS_REVIEW",
}
RELATIONSHIPS = {
    "DOCUMENTED_HUNTING", "PARTIAL_OR_SPECIAL", "PERMIT_OR_QUOTA",
    "UNCLEAR", "PROTECTED_OR_CLOSED", "NOT_FOUND", "NEEDS_REVIEW",
}
COUNTRIES = {"CA", "US"}

errors: list[str] = []
warnings: list[str] = []


def load(name: str) -> list[dict[str, str]]:
    path = ROOT / name
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        if reader.fieldnames is None:
            errors.append(f"{name}: missing header")
            return []
        for line, row in enumerate(rows, 2):
            if None in row:
                errors.append(f"{name}:{line}: too many CSV columns: {row[None]}")
            missing = [key for key, value in row.items() if key is not None and value is None]
            if missing:
                errors.append(f"{name}:{line}: missing CSV columns: {missing}")
        return rows


def unique(rows: list[dict[str, str]], field: str, name: str) -> set[str]:
    values = [row[field].strip() for row in rows if row.get(field, "").strip()]
    for value, count in Counter(values).items():
        if count > 1:
            errors.append(f"{name}: duplicate {field} {value!r}")
    return set(values)


def canonical(values: set[str], name: str) -> None:
    for value in sorted(values):
        if len(value) > 120 or not ID_RE.fullmatch(value):
            errors.append(f"{name}: invalid canonical ID {value!r}")


jurisdictions = load("jurisdictions.csv")
authorities = load("authorities.csv")
sources = load("regulatory-sources.csv")
groups = load("species-groups.csv")
species = load("species-master.csv")
aliases = load("species-aliases.csv")
evidence = load("species-jurisdiction-evidence.csv")
gis = load("gis-sources.csv")

jurisdiction_ids = unique(jurisdictions, "jurisdiction_id", "jurisdictions.csv")
authority_ids = unique(authorities, "authority_id", "authorities.csv")
source_ids = unique(sources, "source_id", "regulatory-sources.csv")
group_ids = unique(groups, "species_group_id", "species-groups.csv")
species_ids = unique(species, "species_id", "species-master.csv")
unique(aliases, "alias_id", "species-aliases.csv")
unique(evidence, "evidence_id", "species-jurisdiction-evidence.csv")
unique(gis, "gis_source_id", "gis-sources.csv")

for values, name in [
    (jurisdiction_ids, "jurisdictions.csv"), (authority_ids, "authorities.csv"),
    (source_ids, "regulatory-sources.csv"), (group_ids, "species-groups.csv"),
    (species_ids, "species-master.csv"),
]:
    canonical(values, name)

for row in jurisdictions:
    if row["country_code"] not in COUNTRIES:
        errors.append(f"jurisdictions.csv: invalid country {row['country_code']!r}")
    parent = row["parent_jurisdiction_id"].strip()
    if parent and parent not in jurisdiction_ids:
        errors.append(f"jurisdictions.csv: orphan parent {parent!r}")
    authority = row["primary_authority_id"].strip()
    if authority and authority not in authority_ids:
        errors.append(f"jurisdictions.csv: orphan primary authority {authority!r}")

for row in authorities:
    if row["jurisdiction_id"] not in jurisdiction_ids:
        errors.append(f"authorities.csv: unknown jurisdiction {row['jurisdiction_id']!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"authorities.csv: invalid verification status {row['verification_status']!r}")
    if not DATE_RE.fullmatch(row["retrieved_at"]):
        errors.append(f"authorities.csv: invalid retrieved date {row['retrieved_at']!r}")

for row in sources:
    jurisdiction = row["jurisdiction_id"].strip()
    authority = row["authority_id"].strip()
    if jurisdiction and jurisdiction not in jurisdiction_ids:
        errors.append(f"regulatory-sources.csv: unknown jurisdiction {jurisdiction!r}")
    if authority and authority not in authority_ids:
        errors.append(f"regulatory-sources.csv: orphan authority {authority!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"regulatory-sources.csv: invalid verification status {row['verification_status']!r}")
    if not DATE_RE.fullmatch(row["retrieved_at"]):
        errors.append(f"regulatory-sources.csv: invalid retrieved date {row['retrieved_at']!r}")

urls = [row["url"].strip() for row in sources if row["url"].strip()]
for value, count in Counter(urls).items():
    if count > 1:
        warnings.append(f"regulatory-sources.csv: duplicate URL used by {count} records: {value}")

scientific_names = [row["scientific_name"].strip().casefold() for row in species]
for value, count in Counter(scientific_names).items():
    if value and count > 1:
        errors.append(f"species-master.csv: duplicate scientific name {value!r}")
for row in species:
    if row["taxonomy_source_id"] not in source_ids:
        errors.append(f"species-master.csv: orphan taxonomy source {row['taxonomy_source_id']!r}")
    if row["major_group"] not in group_ids:
        errors.append(f"species-master.csv: unknown major group {row['major_group']!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"species-master.csv: invalid verification status {row['verification_status']!r}")

for row in groups:
    parent = row["parent_group_id"].strip()
    if parent and parent not in group_ids:
        errors.append(f"species-groups.csv: orphan parent group {parent!r}")

for row in aliases:
    target = row["species_id"].strip()
    candidates = [value for value in row["candidate_species_ids"].split("|") if value]
    if target and target not in species_ids:
        errors.append(f"species-aliases.csv: orphan target {target!r}")
    for candidate in candidates:
        if candidate not in species_ids:
            errors.append(f"species-aliases.csv: orphan candidate {candidate!r}")
    if row["ambiguity"] == "AMBIGUOUS" and target:
        errors.append(f"species-aliases.csv: ambiguous alias must not have exact target {row['alias_id']!r}")
    if row["ambiguity"] == "AMBIGUOUS" and len(candidates) < 2:
        warnings.append(f"species-aliases.csv: ambiguous alias has fewer than two known candidates {row['alias_id']!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"species-aliases.csv: invalid verification status {row['verification_status']!r}")

for row in evidence:
    if row["species_id"] not in species_ids:
        errors.append(f"species-jurisdiction-evidence.csv: orphan species {row['species_id']!r}")
    if row["jurisdiction_id"] not in jurisdiction_ids:
        errors.append(f"species-jurisdiction-evidence.csv: unknown jurisdiction {row['jurisdiction_id']!r}")
    if row["authority_id"] not in authority_ids:
        errors.append(f"species-jurisdiction-evidence.csv: orphan authority {row['authority_id']!r}")
    if row["source_id"] not in source_ids:
        errors.append(f"species-jurisdiction-evidence.csv: orphan source {row['source_id']!r}")
    if row["country_code"] not in COUNTRIES:
        errors.append(f"species-jurisdiction-evidence.csv: invalid country {row['country_code']!r}")
    if row["relationship_status"] not in RELATIONSHIPS:
        errors.append(f"species-jurisdiction-evidence.csv: invalid relationship {row['relationship_status']!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"species-jurisdiction-evidence.csv: invalid verification status {row['verification_status']!r}")
    if not DATE_RE.fullmatch(row["retrieved_at"]):
        errors.append(f"species-jurisdiction-evidence.csv: invalid retrieved date {row['retrieved_at']!r}")
    if not row["evidence_note"].strip():
        errors.append(f"species-jurisdiction-evidence.csv: evidence note missing for {row['evidence_id']!r}")

for row in gis:
    if row["jurisdiction_id"] not in jurisdiction_ids:
        errors.append(f"gis-sources.csv: unknown jurisdiction {row['jurisdiction_id']!r}")
    if row["authority_id"] not in authority_ids:
        errors.append(f"gis-sources.csv: orphan authority {row['authority_id']!r}")
    if row["verification_status"] not in VERIFICATION:
        errors.append(f"gis-sources.csv: invalid verification status {row['verification_status']!r}")
    if not DATE_RE.fullmatch(row["retrieved_at"]):
        errors.append(f"gis-sources.csv: invalid retrieved date {row['retrieved_at']!r}")

for message in warnings:
    print(f"WARNING: {message}")
for message in errors:
    print(f"ERROR: {message}")

print(
    "Checked "
    f"{len(jurisdictions)} jurisdictions, {len(authorities)} authorities, "
    f"{len(sources)} regulatory/scientific sources, {len(gis)} GIS records, "
    f"{len(species)} species, {len(aliases)} aliases, and {len(evidence)} evidence rows."
)
if errors:
    print(f"Validation failed with {len(errors)} error(s) and {len(warnings)} warning(s).")
    sys.exit(1)
print(f"Validation passed with {len(warnings)} warning(s).")
