const NSFW_SECTION_PATTERN = /(^|[^a-z0-9])nsfw([^a-z0-9]|$)/i;

export const isNanobananaSectionSafe = (section) => {
  if (!section || typeof section !== "object") return false;
  if (section.isRestricted === true) return false;

  const sectionIdentity = [section.id, section.title]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return !NSFW_SECTION_PATTERN.test(sectionIdentity);
};

export const filterSafeNanobananaSections = (sections) =>
  (Array.isArray(sections) ? sections : []).filter(isNanobananaSectionSafe);
