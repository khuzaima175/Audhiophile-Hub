const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: `export * from './utils/curveSynthesizer';export * from './utils/biquad';export * from './utils/measurementParser';export * from './utils/autoPeqGenerator';export * from './utils/importExportParser';`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const compiledModule = new Module('dsp-tests');
  compiledModule.paths = Module._nodeModulePaths(process.cwd());
  compiledModule._compile(result.outputFiles[0].text, 'dsp-tests.cjs');
  const dsp = compiledModule.exports;
  const near = (a, b, tol = 1e-5) =>
    assert.ok(Math.abs(a - b) <= tol, `${a} should equal ${b} within ${tol}`);
  for (const rate of [44100, 48000, 96000])
    for (const gain of [-12, 6, 18])
      for (const q of [0.5, 0.7071067811865476, 1.4, 4, 10]) {
        near(dsp.calculateFilterGainAtFreq(1000, 'PK', 1000, gain, q, rate), gain);
        near(
          dsp.calculateFilterGainAtFreq(1000, 'PK', 1000, gain, q, rate) +
            dsp.calculateFilterGainAtFreq(1000, 'PK', 1000, -gain, q, rate),
          0,
        );
      }
  near(dsp.calculateFilterGainAtFreq(1000, 'HP', 1000, 0, Math.SQRT1_2), -3.0102999566);
  near(dsp.calculateFilterGainAtFreq(1000, 'LP', 1000, 0, Math.SQRT1_2), -3.0102999566);
  assert.ok(dsp.calculateFilterGainAtFreq(1000, 'NOTCH', 1000, 0, 1) < -100);
  const filters = [{ id: 'hp', type: 'HP', freq: 1000, gain: 0, q: Math.SQRT1_2 }];
  near(dsp.evaluateCompositeCurve([1000], [], [], filters)[0].gain, -3.0102999566);
  const disabled = [{ id: 'off', type: 'PK', freq: 1000, gain: 18, q: 1, enabled: false }];
  near(dsp.safePreamp(disabled), 0);
  const overlapping = [
    { id: 'a', type: 'PK', freq: 1000, gain: 6, q: 10 },
    { id: 'b', type: 'PK', freq: 1000, gain: 6, q: 10 },
  ];
  assert.ok(dsp.safePreamp(overlapping) <= -12.2);
  const graphic = [100, 1000, 10000],
    gains = [6, -3, 4];
  const nodes = dsp.graphicFilters(graphic, gains);
  for (const f of [20, 200, 1000, 6000, 20000])
    near(
      dsp.evaluateCompositeCurve([f], graphic, gains)[0].gain,
      nodes.reduce((sum, p) => sum + dsp.calculateFilterGainAtFreq(f, p.type, p.freq, p.gain, p.q), 0),
    );
  const phase = dsp.parseMeasurementFile(
    'Frequency,SPL,Phase\n100,70,120\n1000,80,-170\n10000,75,30',
    'phase.csv',
    'RAW',
  );
  near(phase.normOffset, 80);
  near(phase.rawPoints[0].gain, -10);
  const stereo = dsp.parseMeasurementFile(
    'Frequency,Left,Right\n100,70,72\n1000,80,82\n10000,75,77',
    'stereo.csv',
    'RAW',
  );
  near(stereo.normOffset, 81);
  const duplicates = dsp.parseMeasurementFile(
    '1000 80\n100 70\n1000 82\n10000 75\n200 Infinity',
    'duplicates.txt',
    'RAW',
  );
  near(duplicates.normOffset, 81);
  assert.equal(duplicates.rawPoints.length, 3);
  assert.equal(dsp.parseMeasurementFile('100 70\n100 71\n100 72'), null);
  const target = dsp.SYNTHESIS_FREQUENCIES.map((freq) => ({ freq, gain: 0 }));
  const measured = target.map((p) => ({
    ...p,
    gain: dsp.calculateFilterGainAtFreq(p.freq, 'PK', 1000, 6, 1.4),
  }));
  const fit = dsp.synthesizeAutoPeq(measured, target, { maxFilters: 5, targetCurveId: 'flat' });
  assert.ok(fit.finalRms < fit.initialRms * 0.2);
  assert.ok(fit.filters.length <= 5);
  assert.ok(fit.matchPercentage >= 0 && fit.matchPercentage <= 100);
  const response = dsp.evaluateCompositeCurve(
    fit.correctedPoints.map((p) => p.freq),
    [],
    [],
    fit.filters,
  );
  fit.correctedPoints.forEach((p, i) => near(p.gain, measured[i].gain + response[i].gain, 0.011));
  const constant = target.map((p) => ({ ...p, gain: 5 }));
  const same = dsp.synthesizeAutoPeq(constant, target, {
    maxFilters: 10,
    targetCurveId: 'flat',
    normalize: true,
  });
  assert.equal(same.filters.length, 0);
  assert.equal(same.matchPercentage, 100);
  assert.throws(
    () =>
      dsp.synthesizeAutoPeq(
        [
          { freq: 20, gain: 0 },
          { freq: 100, gain: 0 },
        ],
        [
          { freq: 1000, gain: 0 },
          { freq: 2000, gain: 0 },
        ],
        { maxFilters: 10, targetCurveId: 'flat' },
      ),
    /overlap/,
  );
  console.log(
    'PASS DSP anchors, complementary filters, graphic cascade, headroom, measurement parsing, Auto-PEQ consistency and normalization',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
