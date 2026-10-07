import React, { useState } from 'react';
import { CatalogItem, parseSquigCatalog, catalogMatch, catalogFileUrl } from '../../utils/squigCatalog';
export function MeasurementCatalog({ onImport }: { onImport: (files: File[], context: {url:string;rig:string}) => Promise<void> }) {
  const [url, setUrl] = useState('https://squig.link/data/phone_book.json');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [base, setBase] = useState('');
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [rig, setRig] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = async (resource: string) => {
    const response = await fetch(resource, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Measurement server returned ${response.status}`);
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error('Remote file exceeds 5 MB');
    return text;
  };
  const load = async () => {
    setBusy(true); setError('');
    try {
      const parsed = new URL(url); catalogFileUrl(parsed.href, 'check', 'L');
      const data = parseSquigCatalog(JSON.parse(await request(parsed.href)));
      setItems(data); setBase(new URL('./', parsed).href); setBrand('');
    } catch (e) { setError(`Could not load catalog: ${(e as Error).message}. The server must allow browser CORS. You can download its measurement text and import files instead.`); }
    finally { setBusy(false); }
  };
  const importItem = async (item: CatalogItem) => {
    setBusy(true); setError('');
    try {
      const files: File[] = [];
      const failures: string[] = [];
      for (const channel of ['L','R'] as const) {
        try { const text = await request(catalogFileUrl(base, item.file, channel)); files.push(new File([text], `${item.name}${item.variant ? ' '+item.variant : ''} ${channel}.txt`, {type:'text/plain'})); }
        catch (e) { failures.push(`${channel}: ${(e as Error).message}`); }
      }
      if (!files.length) throw new Error(failures.join('; '));
      await onImport(files, {url:base,rig});
      if (failures.length) setError('Imported one available channel. '+failures.join('; '));
    } catch (e) { setError(`Import failed: ${(e as Error).message}. Check the data directory and filename convention for this Squig server.`); }
    finally { setBusy(false); }
  };
  const results = items.filter(item => (!brand || item.brand === brand) && catalogMatch(item.name+' '+item.variant,query));
  return <details className="section-disclosure measurement-catalog"><summary>Browse Squig measurements</summary>
    <p>Load a public Squig catalog, search models and import original channels. Measurements stay attributed to their source. Compare measurements from the same rig.</p>
    <label className="control-field">Catalog URL<input aria-label="Squig catalog URL" type="url" value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <button className="secondary-button" disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Load catalog'}</button>
    {items.length > 0 && <><label className="control-field">Measurement directory URL<input aria-label="Squig data directory" type="url" value={base} onChange={e=>setBase(e.target.value)}/></label><label className="control-field">Brand<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">All brands</option>{[...new Set(items.map(i=>i.brand))].sort().map(b=><option key={b}>{b}</option>)}</select></label>
    <label className="control-field">Find measurement<input aria-label="Find Squig measurement" type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="control-field">Measurement rig<input value={rig} onChange={e=>setRig(e.target.value)} placeholder="Check source documentation"/></label>
    <p>{results.length} variants{results.length>40?' · refine your search to see more':''}</p>
    <div className="catalog-results">{results.slice(0,40).map((item,i)=><button className="secondary-button" key={item.file+i} disabled={busy} onClick={()=>void importItem(item)}>{item.name}{item.variant?' · '+item.variant:''} +</button>)}</div></>}
    {error && <p role="alert">{error}</p>}
    <a href="https://squig.link/" target="_blank" rel="noopener noreferrer">Open Squig ↗</a>
  </details>;
}
