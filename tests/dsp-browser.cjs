const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || '/usr/bin/chromium', headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000');
  const result = await page.evaluate(async () => {
    const dsp = await import('/utils/biquad.ts');
    const curve = await import('/utils/curveSynthesizer.ts');
    let maxError = 0,
      cases = 0;
    for (const rate of [44100, 48000, 96000]) {
      const ctx = new OfflineAudioContext(1, 128, rate);
      for (const type of ['PK', 'LS', 'HS', 'HP', 'LP', 'NOTCH'])
        for (const freq of [30, 1000, 12000])
          for (const gain of [-12, 6, 18])
            for (const q of [0.5, Math.SQRT1_2, 1.4, 4]) {
              // Native Biquad shelves have fixed Q, so compare them at the matching cookbook Q.
              if ((type === 'LS' || type === 'HS') && q !== Math.SQRT1_2) continue;
              const filter = { id: 'ref', type, freq, gain, q };
              const node = ctx.createBiquadFilter();
              node.type = dsp.filterTypeMap[type];
              node.frequency.value = freq;
              node.gain.value = gain;
              node.Q.value = type === 'HP' || type === 'LP' ? 20 * Math.log10(q) : q;
              const frequencies = Float32Array.from(
                [20, 40, 100, 500, 1000, 3000, 8000, 12000, 16000, 20000].filter((f) => f < rate / 2),
              );
              const magnitude = new Float32Array(frequencies.length),
                phase = new Float32Array(frequencies.length);
              node.getFrequencyResponse(frequencies, magnitude, phase);
              for (let i = 0; i < frequencies.length; i++) {
                if (magnitude[i] < 1e-8 || (type === 'NOTCH' && frequencies[i] === freq)) continue;
                const actual = curve.calculateFilterGainAtFreq(frequencies[i], type, freq, gain, q, rate);
                maxError = Math.max(maxError, Math.abs(actual - 20 * Math.log10(magnitude[i])));
                cases++;
              }
            }
      // Browser IIR response also verifies arbitrary shelf Q used during playback.
      for (const type of ['LS', 'HS'])
        for (const q of [0.5, 1.4, 4]) {
          const c = dsp.biquadCoefficients(type, 1000, 9, q, rate),
            n = ctx.createIIRFilter(c.b, c.a);
          const f = Float32Array.from([20, 1000, 20000]),
            m = new Float32Array(3),
            p = new Float32Array(3);
          n.getFrequencyResponse(f, m, p);
          for (let i = 0; i < 3; i++) {
            maxError = Math.max(
              maxError,
              Math.abs(dsp.coefficientGain(f[i], c, rate) - 20 * Math.log10(m[i])),
            );
            cases++;
          }
        }
    }
    let renderMaxError = 0, renderedCases = 0;
    for (const rate of [44100,48000,96000]) {
      const filters = [{id:'bell',type:'PK',freq:1000,gain:6,q:1.4},{id:'shelf',type:'LS',freq:200,gain:-3,q:1.4},{id:'disabled',type:'HS',freq:4000,gain:12,q:.71,enabled:false}];
      for (const frequency of [1000,8000]) {
        const ctx = new OfflineAudioContext(1,rate,rate), osc=ctx.createOscillator(), preamp=ctx.createGain();
        osc.frequency.value=frequency; let tail=osc;
        filters.filter(f=>f.enabled!==false).forEach(f=>{const node=dsp.createDSPNode(ctx,f);tail.connect(node);tail=node;});
        const attenuation=dsp.safePreamp(filters,rate);preamp.gain.value=10**(attenuation/20);tail.connect(preamp);preamp.connect(ctx.destination);osc.start();
        const rendered=await ctx.startRendering(), data=rendered.getChannelData(0);let energy=0;
        for(let i=rate/2;i<rate;i++)energy+=data[i]**2;
        const measured=20*Math.log10(Math.sqrt(energy/(rate/2))*Math.SQRT2);
        const expected=filters.filter(f=>f.enabled!==false).reduce((sum,f)=>sum+curve.calculateFilterGainAtFreq(frequency,f.type,f.freq,f.gain,f.q,rate),attenuation);
        renderMaxError=Math.max(renderMaxError,Math.abs(measured-expected));renderedCases++;
      }
    }
    return { maxError, cases, renderMaxError, renderedCases };
  });
  assert.ok(result.maxError < 0.005, JSON.stringify(result));
  assert.ok(result.renderMaxError < .01, JSON.stringify(result));
  console.log('PASS independent browser DSP response:', result);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
