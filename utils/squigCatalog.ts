/** Squig phone_book.json reader. Measurement files remain on their owner's server. */
export interface CatalogItem { name: string; brand: string; file: string; variant: string; }
export function parseSquigCatalog(data: unknown): CatalogItem[] {
  if (!Array.isArray(data)) throw new Error('Expected a Squig phone_book.json array');
  const items: CatalogItem[] = [];
  for (const brand of data) {
    if (!brand || typeof brand.name !== 'string' || !Array.isArray(brand.phones)) continue;
    for (const phone of brand.phones) {
      const name = typeof phone === 'string' ? phone : phone?.name;
      if (typeof name !== 'string' || !name.trim()) continue;
      const files = typeof phone === 'string' ? [name] : Array.isArray(phone.file) ? phone.file : [phone.file || name];
      const suffixes = typeof phone === 'object' && Array.isArray(phone.suffix) ? phone.suffix : [''];
      for (const file of files) for (const suffix of suffixes) {
        if (typeof file !== 'string' || typeof suffix !== 'string') continue;
        const prefix = typeof phone === 'object' && typeof phone.prefix === 'string' ? phone.prefix + ' ' : '';
        const variant = suffix.trim();
        const basename = `${prefix}${file}${variant ? ' ' + variant : ''}${typeof brand.suffix === 'string' && brand.suffix ? ' ' + brand.suffix : ''}`;
        items.push({ name: `${brand.name} ${name}`, brand: brand.name, file: basename, variant });
        if (items.length > 30000) throw new Error('Catalog has too many entries');
      }
    }
  }
  if (!items.length) throw new Error('No compatible measurements found in this catalog');
  return items;
}
export function catalogMatch(name: string, query: string) {
  return query.toLowerCase().trim().split(/\s+/).every(token => {
    const haystack = name.toLowerCase(); let at = 0;
    for (const c of token) { at = haystack.indexOf(c, at); if (at < 0) return false; at++; }
    return true;
  });
}
export function catalogFileUrl(base: string, file: string, channel: 'L'|'R') {
  const url = new URL(base);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public HTTP or HTTPS catalog URL');
  return new URL(encodeURIComponent(file.replace(/\.txt$/i, '') + ` ${channel}.txt`), url).href;
}
