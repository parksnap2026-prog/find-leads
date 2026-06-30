import { OSM_TAGS } from "./constants";

export type OsmTagPair = [string, string];

export function formatOsmTag([key, value]: OsmTagPair) {
  return `${key}=${value}`;
}

export function parseOsmTagInput(raw: string): OsmTagPair | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!key || !value) return null;
  return [key, value];
}

function tagKey(pair: OsmTagPair) {
  return `${pair[0]}|${pair[1]}`;
}

export function dedupeOsmTags(tags: OsmTagPair[]): OsmTagPair[] {
  const seen = new Set<string>();
  const out: OsmTagPair[] = [];
  for (const pair of tags) {
    const k = tagKey(pair);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(pair);
  }
  return out;
}

export function getDefaultScopeTags(businessType: string): OsmTagPair[] {
  if (businessType === "all") return [];
  return [...(OSM_TAGS[businessType] ?? [])];
}

export function scopeTagsMatchDefaults(
  businessType: string,
  scopeTags: OsmTagPair[],
): boolean {
  const defaults = getDefaultScopeTags(businessType);
  if (defaults.length !== scopeTags.length) return false;
  const active = new Set(scopeTags.map(formatOsmTag));
  return defaults.every((tag) => active.has(formatOsmTag(tag)));
}

/** @deprecated Use getDefaultScopeTags + scopeTags directly */
export function getOsmTagsForType(
  businessType: string,
  extraTags: OsmTagPair[] = [],
): OsmTagPair[] {
  if (businessType === "all") {
    return dedupeOsmTags(extraTags);
  }
  const base = OSM_TAGS[businessType] ?? [];
  return dedupeOsmTags([...base, ...extraTags]);
}

export function describeSearchScope(
  businessType: string,
  scopeTags: OsmTagPair[] = [],
) {
  const tags = scopeTags.length
    ? scopeTags
    : getDefaultScopeTags(businessType);

  if (businessType === "all" && !tags.length) {
    return "All named shops, amenities, offices, leisure, tourism & craft businesses in radius.";
  }
  if (!tags.length) {
    return "Add at least one search rule below.";
  }
  const customized = !scopeTagsMatchDefaults(businessType, tags);
  let summary = `${tags.length} search rule(s) for this type.`;
  if (customized) {
    summary += " You edited the default rules.";
  } else {
    summary += ` Includes ${tags.slice(0, 2).map(formatOsmTag).join(", ")}${tags.length > 2 ? ", …" : ""}.`;
  }
  return summary;
}
