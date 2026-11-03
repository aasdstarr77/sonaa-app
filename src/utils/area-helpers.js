export function normalizeAreaSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ar-EG');
}

export function isReservedAreaLabel(value) {
  return normalizeAreaSearch(value).replace(/\s+/g, '') === normalizeAreaSearch('جميع المناطق').replace(/\s+/g, '');
}

export function filterAreaOptions(options, query) {
  const source = Array.isArray(options) ? options : [];
  const normalizedQuery = normalizeAreaSearch(query);
  return source.filter(area => !isReservedAreaLabel(area) &&
    (!normalizedQuery || normalizeAreaSearch(area).includes(normalizedQuery)));
}
