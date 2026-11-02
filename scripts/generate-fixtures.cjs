const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');

(async () => {
  const res = await esbuild.build({
    stdin: {
      contents: [
        "export * from './utils/shareCodec';",
        "export * from './store/labStore';",
        "export * from './store/audioWorkspace';",
        "export * from './utils/workspaceBackup';",
        "export * from './utils/graphTools';",
        "export * from './utils/localRetrieval';",
        "export * from './constants/sampleProfile';",
        "export * from './types';",
      ].join('\n'),
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const mod = new Module('fixture-gen');
  mod.paths = Module._nodeModulePaths(process.cwd());
  mod._compile(res.outputFiles[0].text, 'fixture-gen.cjs');
  const {
    encodeLabStateToUrl,
    decodeUrlToLabState,
    labStore,
    freshDraft,
    validateDraft,
    validateLabState,
    validateMeasurementRecord,
    validateBackup,
    DEFAULT_GRAPH_SETTINGS,
    DEFAULT_FIT_LIMITS,
    DEFAULT_RETRIEVAL_SETTINGS,
    SAMPLE_AUDIOPHILE_PROFILE,
  } = mod.exports;

  // Candidate provenance only; this command never replaces committed golden data.
  const commitHash = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  // Candidate output only. Committed golden fixtures must never be regenerated.
  const outputDirectory = path.join('artifacts', 'fixture-candidates');
  fs.mkdirSync(outputDirectory, { recursive: true });

  // 1. Candidate URLs (3 synthetic cases + 2 automated browser captures, not historical user links)
  const baseLab = labStore.getSnapshot();

  const state1 = {
    ...baseLab,
    targetCurveId: 'crinacle-ief-2025',
    smoothing: '1/12 OCT',
    normDb: 0,
    normHz: 1000,
    zoomRange: 'full',
    viewMode: 'rawFilter',
    deltaMode: false,
    normalizationMode: 'frequency',
    baselineId: null,
    fitSmoothing: '1/12 OCT',
    fitNormalize: true,
    curves: [
      ...baseLab.curves,
      {
        id: 'golden-hd600-measured',
        name: 'Sennheiser HD600 Measured',
        color: '#6FC9A6',
        provenance: 'measured',
        provenanceDetails: 'Golden fixture measurement',
        points: [
          { freq: 20, gain: -4.2 },
          { freq: 100, gain: 1.5 },
          { freq: 1000, gain: 0.0 },
          { freq: 3000, gain: 6.8 },
          { freq: 10000, gain: -2.1 },
          { freq: 20000, gain: -8.4 },
        ],
        offset: -1.5,
        visible: true,
        solo: false,
        pinned: true,
        rig: 'B&K 5128',
      },
    ],
  };

  const state2 = {
    ...baseLab,
    targetCurveId: 'harman-ie-2019',
    smoothing: '1/6 OCT',
    normDb: 1.5,
    normHz: 500,
    zoomRange: 'bass',
    graphSettings: { ...DEFAULT_GRAPH_SETTINGS, minFreq: 20, maxFreq: 250 },
    viewMode: 'rawFilter',
    deltaMode: true,
    normalizationMode: 'mean',
    baselineId: 'golden-stereo-iem',
    fitSmoothing: 'RAW',
    fitNormalize: true,
    curves: [
      {
        id: 'golden-stereo-iem',
        name: 'Stereo Paired IEM',
        color: '#79aaff',
        provenance: 'measured',
        provenanceDetails: 'Imported left/right measurements paired by filename',
        channel: 'both',
        channels: {
          left: [
            { freq: 20, gain: 5.0 },
            { freq: 100, gain: 3.0 },
            { freq: 1000, gain: 0.0 },
            { freq: 10000, gain: -4.0 },
            { freq: 20000, gain: -7.0 },
          ],
          right: [
            { freq: 20, gain: 5.4 },
            { freq: 100, gain: 3.2 },
            { freq: 1000, gain: 0.1 },
            { freq: 10000, gain: -3.6 },
            { freq: 20000, gain: -6.8 },
          ],
        },
        points: [
          { freq: 20, gain: 5.2 },
          { freq: 100, gain: 3.1 },
          { freq: 1000, gain: 0.05 },
          { freq: 10000, gain: -3.8 },
          { freq: 20000, gain: -6.9 },
        ],
        offset: 0,
        visible: true,
        solo: false,
      },
    ],
  };

  const state3 = {
    ...baseLab,
    targetCurveId: 'crinacle-ief-2025',
    smoothing: 'RAW',
    normDb: 0,
    normHz: 1000,
    zoomRange: 'treble',
    graphSettings: { ...DEFAULT_GRAPH_SETTINGS, minFreq: 4000, maxFreq: 20000 },
    fitLimits: { ...DEFAULT_FIT_LIMITS, maxFreq: 12000, minGain: -10, maxGain: 4 },
    viewMode: 'netPostEq',
    deltaMode: false,
    normalizationMode: 'frequency',
    baselineId: null,
    fitSmoothing: '1/24 OCT',
    fitNormalize: false,
    curves: [
      {
        id: 'golden-filter-curve',
        name: 'Audio draft correction',
        color: '#d28ef0',
        provenance: 'eq-compensated',
        provenanceDetails: 'Golden filter curve',
        points: [
          { freq: 20, gain: -2.5 },
          { freq: 200, gain: -1.0 },
          { freq: 1000, gain: 0.0 },
          { freq: 3000, gain: -3.2 },
          { freq: 8000, gain: -4.5 },
          { freq: 20000, gain: 1.0 },
        ],
        offset: 0.5,
        visible: true,
        solo: true,
        isFilterCurve: true,
        sourceTargetId: 'crinacle-ief-2025',
        isInverted: true,
        deltaCompensate: true,
        preserveAbsolute: true,
      },
    ],
  };

  const syntheticCases = [
    {
      id: 'single-measured-with-offset',
      description: 'Single measured curve with Crinacle IEF 2025 target, 1/12 OCT smoothing, -1.5 dB offset, and B&K 5128 rig metadata',
      url: encodeLabStateToUrl(state1),
    },
    {
      id: 'stereo-paired-mean-delta',
      description: 'Stereo L/R paired curve (channel=both) with bass zoom, mean normalization, delta mode, and baseline',
      url: encodeLabStateToUrl(state2),
    },
    {
      id: 'filter-curve-posteq-pinned',
      description: 'Filter correction curve in netPostEq view with solo, inverted polarity, deltaCompensate, preserveAbsolute, and custom fitLimits',
      url: encodeLabStateToUrl(state3),
    },
  ];

  // Literal share links captured from real browser "Share graph" button clicks
  const realBrowserCases = [
    {
      id: 'real-browser-qa-measurement-share',
      description: 'Real browser Share graph link captured after importing qa-measurement.csv with Crinacle IEF 2025 target and 1/6 OCT smoothing',
      url: 'http://127.0.0.1:3000/#/lab?c=eyJncmFwaFNldHRpbmdzIjp7Im1pbkZyZXEiOjIwLCJtYXhGcmVxIjoyMDAwMCwieVJhbmdlIjpudWxsLCJpbnNwZWN0Ijp0cnVlLCJzaG93TGFiZWxzIjpmYWxzZX0sImZpdExpbWl0cyI6eyJtaW5GcmVxIjoyMCwibWF4RnJlcSI6MjAwMDAsIm1pbkdhaW4iOi0xMiwibWF4R2FpbiI6MTIsIm1pblEiOjAuNSwibWF4USI6NCwidHlwZXMiOlsiUEsiLCJMUyIsIkhTIl19LCJiYXNlbGluZUlkIjpudWxsLCJub3JtYWxpemF0aW9uTW9kZSI6ImZyZXF1ZW5jeSIsInYiOjEsIm5vcm0iOlswLDEwMDBdLCJ6b29tIjoiZnVsbCIsInRhcmdldElkIjoiY3JpbmFjbGUtaWVmLTIwMjUiLCJkZWx0YSI6ZmFsc2UsImN1cnZlcyI6W3siaWQiOiJjdXN0b20tMWJiODQ3NjYtMWU1YS00ZGFkLThmYTktNjA3NDYyM2Q5OWM2IiwidGFyZ2V0IjpmYWxzZSwibiI6InFhIG1lYXN1cmVtZW50IiwiYyI6IiNlZGFiNzciLCJwIjoibWVhc3VyZWQiLCJmaWx0ZXIiOmZhbHNlLCJ2aXNpYmxlIjp0cnVlLCJzb2xvIjpmYWxzZSwicHRzIjpbWzIwLDg2XSxbMzAsODVdLFs1MCw4NF0sWzEwMCw4M10sWzIwMCw4MF0sWzUwMCw3OV0sWzEwMDAsODBdLFsyMDAwLDg2XSxbNDAwMCw4M10sWzYwMDAsODZdLFs4MDAwLDgzXSxbMTAwMDAsNzhdLFsxNjAwMCw3M10sWzIwMDAwLDcxXV19XSwidmlldyI6InJhd0ZpbHRlciIsInNtb290aGluZyI6IjEvNiBPQ1QiLCJmaXRTbW9vdGhpbmciOiJSQVciLCJmaXROb3JtYWxpemUiOnRydWV9',
    },
    {
      id: 'real-browser-auto-peq-compare-share',
      description: 'Real browser Share graph link captured after Generate correction -> Compare these curves (measured + correction + post-EQ)',
      url: 'http://127.0.0.1:3000/#/lab?c=eyJncmFwaFNldHRpbmdzIjp7Im1pbkZyZXEiOjIwLCJtYXhGcmVxIjoyMDAwMCwieVJhbmdlIjpudWxsLCJpbnNwZWN0Ijp0cnVlLCJzaG93TGFiZWxzIjpmYWxzZX0sImZpdExpbWl0cyI6eyJtaW5GcmVxIjoyMCwibWF4RnJlcSI6MjAwMDAsIm1pbkdhaW4iOi0xMiwibWF4R2FpbiI6MTIsIm1pblEiOjAuNSwibWF4USI6NCwidHlwZXMiOlsiUEsiLCJMUyIsIkhTIl19LCJiYXNlbGluZUlkIjpudWxsLCJub3JtYWxpemF0aW9uTW9kZSI6ImZyZXF1ZW5jeSIsInYiOjEsIm5vcm0iOlswLDEwMDBdLCJ6b29tIjoiZnVsbCIsInRhcmdldElkIjoiY3JpbmFjbGUtaWVmLTIwMjUiLCJkZWx0YSI6ZmFsc2UsImN1cnZlcyI6W3siaWQiOiJtZWFzdXJlbWVudC04ZjRkZGE3MjQyNTVkYmNhOTk2NmVlZDIwNTI0Y2M5ZjlhMzc0MmUyYjVmMTU0ODUzZDA2Y2I2MGY2ZjRiNjU4IiwidGFyZ2V0IjpmYWxzZSwibiI6InFhIG1lYXN1cmVtZW50IiwiYyI6IiNmMGI0N2MiLCJwIjoibWVhc3VyZWQiLCJmaWx0ZXIiOmZhbHNlLCJ2aXNpYmxlIjp0cnVlLCJzb2xvIjpmYWxzZSwicHRzIjpbWzIwLDg2XSxbMzAsODVdLFs1MCw4NF0sWzEwMCw4M10sWzIwMCw4MF0sWzUwMCw3OV0sWzEwMDAsODBdLFsyMDAwLDg2XSxbNDAwMCw4M10sWzYwMDAsODZdLFs4MDAwLDgzXSxbMTAwMDAsNzhdLFsxNjAwMCw3M10sWzIwMDAwLDcxXV19LHsiaWQiOiJhdWRpby1kcmFmdC1jb3JyZWN0aW9uIiwibiI6InFhIG1lYXN1cmVtZW50IEF1dG8tUEVRIGNvcnJlY3Rpb24iLCJjIjoiIzc5YWFmZiIsInAiOiJlcS1jb21wZW5zYXRlZCIsImZpbHRlciI6dHJ1ZSwic291cmNlVGFyZ2V0IjoiY3JpbmFjbGUtaWVmLTIwMjUiLCJ2aXNpYmxlIjp0cnVlLCJzb2xvIjpmYWxzZSwicHRzIjpbWzIwLDEuNTQ5XSxbMjEuNiwxLjc3Nl0sWzIzLjMyLDIuMDI2XSxbMjUuMTgsMi4yOTldLFsyNy4xOSwyLjU5XSxbMjkuMzYsMi44OTFdLFszMS43LDMuMTldLFszNC4yMywzLjQ3MV0sWzM2Ljk2LDMuNzEzXSxbMzkuOTEsMy44OTNdLFs0My4wOSwzLjk5M10sWzQ2LjUzLDQuMDAxXSxbNTAuMjQsMy45MTVdLFs1NC4yNSwzLjc0N10sWzU4LjU3LDMuNTE1XSxbNjMuMjUsMy4yNDFdLFs2OC4yOSwyLjk0OF0sWzczLjc0LDIuNjUxXSxbNzkuNjIsMi4zNjNdLFs4NS45NywyLjA5NF0sWzkyLjgzLDEuODQ3XSxbMTAwLjI0LDEuNjI1XSxbMTA4LjIzLDEuNDI5XSxbMTE2Ljg3LDEuMjU4XSxbMTI2LjE5LDEuMTFdLFsxMzYuMjYsMC45ODZdLFsxNDcuMTMsMC44ODJdLFsxNTguODcsMC43OThdLFsxNzEuNTQsMC43MzNdLFsxODUuMjIsMC42ODddLFsyMDAsMC42Nl0sWzIxNS45NiwwLjY1Ml0sWzIzMy4xOCwwLjY2N10sWzI1MS43OSwwLjcwNl0sWzI3MS44NywwLjc3NF0sWzI5My41NiwwLjg3OF0sWzMxNi45OCwxLjAyNF0sWzM0Mi4yNywxLjIxOV0sWzM2OS41NywxLjQ2XSxbMzk5LjA1LDEuNzI1XSxbNDMwLjg5LDEuOTU3XSxbNDY1LjI2LDIuMDcyXSxbNTAyLjM4LDIuMDE0XSxbNTQyLjQ1LDEuODAzXSxbNTg1LjczLDEuNTE4XSxbNjMyLjQ2LDEuMjMzXSxbNjgyLjkxLDAuOTg0XSxbNzM3LjM5LDAuNzc5XSxbNzk2LjIxLDAuNjE1XSxbODU5LjczLDAuNDgzXSxbOTI4LjMyLDAuMzcyXSxbMTAwMi4zNywwLjI3NF0sWzEwODIuMzQsMC4xNzhdLFsxMTY4LjY4LDAuMDY3XSxbMTI2MS45MSwtMC4wOF0sWzEzNjIuNTgsLTAuMzAyXSxbMTQ3MS4yOCwtMC42MjldLFsxNTg4LjY2LC0wLjk0XSxbMTcxNS4zOSwtMC44MjldLFsxODUyLjI0LC0wLjI2N10sWzIwMDAsMC40MDJdLFsyMTU5LjU1LDEuMTY5XSxbMjMzMS44MywyLjI1N10sWzI1MTcuODUsMy42MzhdLFsyNzE4LjcxLDQuNjQ3XSxbMjkzNS42LDUuNzQ1XSxbMzE2OS43OSw1Ljk4OV0sWzM0MjIuNjYsNS4wNF0sWzM2OTUuNyw0LjE2N10sWzM5OTAuNTIsMi42MzJdLFs0MzA4Ljg3LDEuMTczXSxbNDY1Mi42MSwwLjE3M10sWzUwMjMuNzcsLTAuNzEzXSxbNTQyNC41NSwtMS44NzNdLFs1ODU3LjI5LC0zLjQyOV0sWzYzMjQuNTYsLTMuNDg1XSxbNjgyOS4xLC0yLjY0Ml0sWzczNzMuODksLTIuNDE1XSxbNzk2Mi4xNCwtMi41OV0sWzg1OTcuMzIsLTIuOTYzXSxbOTI4My4xOCwtMy40MTJdLFsxMDAyMy43NCwtMy44MTJdLFsxMDgyMy4zOSwtNC4wNDhdLFsxMTY4Ni44MywtNC4yMzddLFsxMjYxOS4xNSwtMy44ODddLFsxMzYyNS44NCwtMS45NzddLFsxNDcxMi44NSwtMC4zOTNdLFsxNTg4Ni41NiwxLjAyM10sWzE3MTUzLjkyLDEuNDc5XSxbMTg1MjIuMzcsMC43NjRdLFsyMDAwMCwwLjI0XV19LHsiaWQiOiJhdWRpby1kcmFmdC1wb3N0ZXEiLCJuIjoicWEgbWVhc3VyZW1lbnQgQXV0by1QRVEgY3VycmVudCBwb3N0LUVRIiwiYyI6IiNkMjhlZjAiLCJwIjoiZXEtY29tcGVuc2F0ZWQiLCJ2aXNpYmxlIjp0cnVlLCJzb2xvIjpmYWxzZSwiYWJzb2x1dGUiOnRydWUsInB0cyI6W1syMCwxLjE0OV0sWzIxLjYsMS4xODZdLFsyMy4zMiwxLjI0Nl0sWzI1LjE4LDEuMzI5XSxbMjcuMTksMS40M10sWzI5LjM2LDEuNTQxXSxbMzEuNywxLjY4XSxbMzQuMjMsMS44MTFdLFszNi45NiwxLjkwM10sWzM5LjkxLDEuOTMzXSxbNDMuMDksMS44ODNdLFs0Ni41MywxLjc0MV0sWzUwLjI0LDEuNTA1XSxbNTQuMjUsMS4yMjddLFs1OC41NywwLjg4NV0sWzYzLjI1LDAuNTAxXSxbNjguMjksMC4wOThdLFs3My43NCwtMC4zMDldLFs3OS42MiwtMC43MDddLFs4NS45NywtMS4wODZdLFs5Mi44MywtMS40NDNdLFsxMDAuMjQsLTEuNzg1XSxbMTA4LjIzLC0yLjMxMV0sWzExNi44NywtMi44MTJdLFsxMjYuMTksLTMuM10sWzEzNi4yNiwtMy43NTRdLFsxNDcuMTMsLTQuMTg4XSxbMTU4Ljg3LC00LjYwMl0sWzE3MS41NCwtNS4wMDddLFsxODUuMjIsLTUuMzgzXSxbMjAwLC01Ljc0XSxbMjE1Ljk2LC01LjgyOF0sWzIzMy4xOCwtNS45MDNdLFsyNTEuNzksLTUuOTQ0XSxbMjcxLjg3LC01Ljk2Nl0sWzI5My41NiwtNS45NDJdLFszMTYuOTgsLTUuODc2XSxbMzQyLjI3LC01Ljc3MV0sWzM2OS41NywtNS42MV0sWzM5OS4wNSwtNS40MjVdLFs0MzAuODksLTUuMjgzXSxbNDY1LjI2LC01LjI0OF0sWzUwMi4zOCwtNS4zNzZdLFs1NDIuNDUsLTUuNDc3XSxbNTg1LjczLC01LjY1Ml0sWzYzMi40NiwtNS44MjddLFs2ODIuOTEsLTUuOTY2XSxbNzM3LjM5LC02LjA2MV0sWzc5Ni4yMSwtNi4xMTVdLFs4NTkuNzMsLTYuMTM3XSxbOTI4LjMyLC02LjEzOF0sWzEwMDIuMzcsLTYuMTA2XSxbMTA4Mi4zNCwtNS41NDJdLFsxMTY4LjY4LC00Ljk4M10sWzEyNjEuOTEsLTQuNDddLFsxMzYyLjU4LC00LjAyMl0sWzE0NzEuMjgsLTMuNjg5XSxbMTU4OC42NiwtMy4zM10sWzE3MTUuMzksLTIuNTU5XSxbMTg1Mi4yNCwtMS4zMjddLFsyMDAwLDAuMDAyXSxbMjE1OS41NSwwLjQzOV0sWzIzMzEuODMsMS4xOTddLFsyNTE3Ljg1LDIuMjM4XSxbMjcxOC43MSwyLjkxN10sWzI5MzUuNiwzLjY4NV0sWzMxNjkuNzksMy41OTldLFszNDIyLjY2LDIuMzFdLFszNjk1LjcsMS4xMDddLFszOTkwLjUyLC0wLjc1OF0sWzQzMDguODcsLTEuNjc3XSxbNDY1Mi42MSwtMi4xMDddLFs1MDIzLjc3LC0yLjQyM10sWzU0MjQuNTUsLTMuMDIzXSxbNTg1Ny4yOSwtNC4wMDldLFs2MzI0LjU2LC00LjQzNV0sWzY4MjkuMSwtNC4zOTJdLFs3MzczLjg5LC00Ljk2NV0sWzc5NjIuMTQsLTUuOTRdLFs4NTk3LjMyLC03Ljk3M10sWzkyODMuMTgsLTEwLjE0Ml0sWzEwMDIzLjc0LC0xMi4yNDJdLFsxMDgyMy4zOSwtMTMuMjg4XSxbMTE2ODYuODMsLTE0LjI5N10sWzEyNjE5LjE1LC0xNC43NTddLFsxMzYyNS44NCwtMTMuNjY3XSxbMTQ3MTIuODUsLTEyLjkwM10sWzE1ODg2LjU2LC0xMi4yOTddLFsxNzE1My45MiwtMTIuNTQxXSxbMTg1MjIuMzcsLTEzLjk0Nl0sWzIwMDAwLC0xNS4xNl1dfV0sInZpZXciOiJyYXdGaWx0ZXIiLCJzbW9vdGhpbmciOiIxLzYgT0NUIiwiZml0U21vb3RoaW5nIjoiUkFXIiwiZml0Tm9ybWFsaXplIjp0cnVlfQ',
    },
  ];

  const shareCases = [...syntheticCases, ...realBrowserCases].map(({ id, description, url }) => {
    const expectedDecoded = decodeUrlToLabState(url);
    return { id, description, url, expectedDecoded };
  });

  fs.writeFileSync(
    path.join(outputDirectory, 'golden-share-urls.json'),
    JSON.stringify({ generatedFromCommit: commitHash, cases: shareCases }, null, 2) + '\n',
  );

  // 2. Golden Storage Snapshot (localStorage + IndexedDB records & comparison)
  const measurementRecord = {
    id: 'measurement-golden-hd600-sha256',
    kind: 'measurement',
    value: {
      name: 'Sennheiser HD600 Golden',
      smoothing: '1/12 OCT',
      normOffset: 80,
      sampleCount: 6,
      rawPoints: [
        { freq: 20, gain: -4.2, rawSpl: 75.8 },
        { freq: 100, gain: 1.5, rawSpl: 81.5 },
        { freq: 1000, gain: 0.0, rawSpl: 80.0 },
        { freq: 3000, gain: 6.8, rawSpl: 86.8 },
        { freq: 10000, gain: -2.1, rawSpl: 77.9 },
        { freq: 20000, gain: -8.4, rawSpl: 71.6 },
      ],
      smoothedPoints: [
        { freq: 20, gain: -4.2 },
        { freq: 100, gain: 1.5 },
        { freq: 1000, gain: 0.0 },
        { freq: 3000, gain: 6.8 },
        { freq: 10000, gain: -2.1 },
        { freq: 20000, gain: -8.4 },
      ],
      channels: {
        left: [
          { freq: 20, gain: -4.2, rawSpl: 75.8 },
          { freq: 1000, gain: 0.0, rawSpl: 80.0 },
          { freq: 20000, gain: -8.4, rawSpl: 71.6 },
        ],
        right: [
          { freq: 20, gain: -4.0, rawSpl: 76.0 },
          { freq: 1000, gain: 0.1, rawSpl: 80.1 },
          { freq: 20000, gain: -8.2, rawSpl: 71.8 },
        ],
      },
    },
  };

  const leftFilters = [
    { id: 'f-left-1', type: 'LS', freq: 80, gain: 3.5, q: 0.71, enabled: true },
    { id: 'f-left-2', type: 'PK', freq: 3200, gain: -2.5, q: 2.0, enabled: true },
  ];
  const rightFilters = [
    { id: 'f-right-1', type: 'LS', freq: 80, gain: 3.3, q: 0.71, enabled: true },
    { id: 'f-right-2', type: 'PK', freq: 3200, gain: -2.7, q: 2.0, enabled: true },
  ];

  const goldenDraft = {
    ...freshDraft(),
    editingPresetId: 'kefine-delci-ae-golden-nozzle',
    presetName: 'HD600 Studio Reference',
    hardwareAssigned: 'Sennheiser HD600',
    gearId: null,
    dirty: true,
    eqMode: 'peq',
    selectedTargetId: 'crinacle-ief-2025',
    measurementRef: measurementRecord.id,
    targetMeasurementRef: null,
    gains10: [2, 1.5, 0.5, 0, -0.5, -1, -1.5, -2, 0, 1],
    gains15: [2, 1.5, 1, 0.5, 0, 0, -0.5, -1, -1.5, -2, -1, 0, 0.5, 1, 1],
    gains31: Array(31)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 0.5 : -0.5)),
    peqFilters: leftFilters,
    stereoFilters: { left: leftFilters, right: rightFilters },
    eqChannel: 'left',
    selectedBand: 'f-left-1',
    requestedPreamp: -3.6,
    preampMode: 'automatic',
    sampleRate: 96000,
    graphView: 'compensated',
    responseLevel: 'absolute',
    smoothing: '1/12 OCT',
    normalize: true,
    maxAutoFilters: 10,
    workbenchState: 'ADDING',
    originalFit: {
      filters: leftFilters,
      preamp: -3.6,
      initialRms: 3.42,
      finalRms: 0.68,
      matchPercentage: 91,
      evaluatedPoints: 180,
      correctedPoints: [
        { freq: 20, gain: -0.7 },
        { freq: 1000, gain: 0.0 },
        { freq: 20000, gain: -8.4 },
      ],
      residualPoints: [
        { freq: 20, gain: 0.2 },
        { freq: 1000, gain: 0.0 },
        { freq: 20000, gain: -0.4 },
      ],
    },
  };

  if (!validateDraft(goldenDraft)) throw new Error('goldenDraft failed validateDraft');
  if (!validateMeasurementRecord(measurementRecord)) throw new Error('measurementRecord failed validateMeasurementRecord');
  if (!validateLabState(state1)) throw new Error('state1 failed validateLabState');

  const storageSnapshot = {
    generatedFromCommit: commitHash,
    localStorage: {
      audiosage_audio_draft_v2: goldenDraft,
      audiosage_profile_v1: SAMPLE_AUDIOPHILE_PROFILE,
      audiosage_retrieval_v1: DEFAULT_RETRIEVAL_SETTINGS,
    },
    indexedDB: {
      databaseName: 'audiosage_audio_v2',
      version: 2,
      records: [measurementRecord],
      comparison: { ...state1, isOpen: false },
    },
  };

  fs.writeFileSync(
    path.join(outputDirectory, 'golden-storage-snapshot.json'),
    JSON.stringify(storageSnapshot, null, 2) + '\n',
  );

  // 3. Golden v3 WorkspaceBackup
  const rawBackup = {
    application: 'AudioSage',
    version: 3,
    timestamp: '2026-11-01T12:00:00.000Z',
    profile: SAMPLE_AUDIOPHILE_PROFILE,
    chats: [
      {
        id: 'chat-golden-1',
        title: 'HD600 vs Sundara Treble Analysis',
        createdAt: 1754600000000,
        updatedAt: 1754600060000,
        isStarred: true,
        isSummarized: false,
        messages: [
          { id: 'msg-1', role: 'user', text: 'Compare HD600 and Sundara treble.', timestamp: 1754600000000 },
          {
            id: 'msg-2',
            role: 'model',
            text: 'HD600 has smoother upper treble.',
            timestamp: 1754600010000,
            requestedModel: 'gemini-3.8-flash',
            answeringModel: 'gemini-3.8-flash',
          },
        ],
      },
    ],
    knowledgeBase: [
      {
        id: 'note-golden-1',
        topic: 'Comparison: HD600 vs Sundara',
        summary: 'User prefers HD600 natural decay and mid-range timbre.',
        keyFacts: ['Prefers natural decay', 'Sensitive to 8kHz peaks'],
        timestamp: 1754600060000,
        sourceSessionId: 'chat-golden-1',
        enabled: true,
        pinned: true,
      },
    ],
    audio: {
      version: 2,
      draft: goldenDraft,
      measurements: [measurementRecord],
      comparison: { ...state1, isOpen: false },
      retrievalSettings: DEFAULT_RETRIEVAL_SETTINGS,
    },
  };

  const validatedBackup = validateBackup(rawBackup);
  fs.writeFileSync(
    path.join(outputDirectory, 'golden-v3-backup.json'),
    JSON.stringify({ generatedFromCommit: commitHash, backup: validatedBackup }, null, 2) + '\n',
  );
  console.log('Generated candidate snapshots under artifacts/fixture-candidates; committed fixtures untouched. Automated links are not historical user links.');
})();
