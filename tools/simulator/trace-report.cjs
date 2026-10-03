// node trace-report.cjs <trace.json>...: one line per Chrome performance trace (saved by the chrome-devtools tools):
// busy ms per second on the renderer main thread, compositor, raster workers and GPU, and paints/s.
for (const f of process.argv.slice(2)) {
  const t = JSON.parse(require('fs').readFileSync(f)); const E = t.traceEvents || t;
  const names = {}; for (const e of E) if (e.ph === 'M' && e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
  const all = E.filter(e => e.ph === 'X' && e.dur && /RunTask/.test(e.name)), t0 = Math.min(...all.map(e => e.ts)) + 1e6;
  const top = all.filter(e => e.ts > t0);
  const span = (Math.max(...top.map(e => e.ts + e.dur)) - Math.min(...top.map(e => e.ts))) / 1e6;
  const by = {}; for (const e of top) { let k = names[e.pid + ':' + e.tid] || '?'; if (/Raster|CompositorTile/.test(k)) k = 'raster'; by[k] = (by[k] || 0) + e.dur / 1000; }
  const paints = E.filter(e => e.name === 'Paint' && e.ph === 'X' && e.ts > t0).length;
  const r = k => ((by[k] || 0) / span).toFixed(0).padStart(5);
  console.log(f.padEnd(22), 'main', r('CrRendererMain'), 'comp', r('Compositor'), 'raster', r('raster'), 'gpu', r('CrGpuMain'), 'viz', r('VizCompositorThread'), ' paints/s', (paints / span).toFixed(0));
}
