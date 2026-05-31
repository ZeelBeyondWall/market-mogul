import { useEffect, useRef } from 'react';
import { ASSETS, CANDLE_MS } from '../../../shared/engine/constants';
import { fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { bestAsk, bestBid } from '../../../shared/engine/orderbook';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function Chart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const chartLine = useGame(s => s.chartLine);
  const chartCandles = useGame(s => s.chartCandles);
  const chartVol = useGame(s => s.chartVol);
  const toggleChartLayer = useGame(s => s.toggleChartLayer);

  const a = ASSETS.find(x => x.id === eng.state.active)!;
  const ast = eng.state.assets[a.id];

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      canvas.width = Math.max(100, r.width * devicePixelRatio);
      canvas.height = Math.max(100, r.height * devicePixelRatio);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const cctx = canvas.getContext('2d'); if (!cctx) return;
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    if (w < 10 || h < 10) return;
    cctx.clearRect(0, 0, w, h);
    const bg = cctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0d1421'); bg.addColorStop(1, '#03060b');
    cctx.fillStyle = bg; cctx.fillRect(0, 0, w, h);
    const volH = chartVol ? Math.min(50, h * 0.15) : 0;
    const cyh = h - volH;
    cctx.strokeStyle = 'rgba(245,185,66,.06)'; cctx.lineWidth = 1; cctx.beginPath();
    for (let i = 1; i < 5; i++) { const y = Math.floor(cyh * i / 5) + 0.5; cctx.moveTo(0, y); cctx.lineTo(w, y); }
    for (let i = 1; i < 8; i++) { const x = Math.floor(w * i / 8) + 0.5; cctx.moveTo(x, 0); cctx.lineTo(x, cyh); }
    cctx.stroke();

    const hist = ast.history;
    const padL = 8, padR = 64, padT = 10, padB = 10;
    const cw = w - padL - padR;
    const ch = cyh - padT - padB;

    const VISIBLE = 30;
    const candleW = cw / VISIBLE;
    const now = performance.now();
    const candleProgress = ast.curCandle && ast.candleStartT
      ? Math.min(1, (now - ast.candleStartT) / CANDLE_MS) : 0;
    const allCandles = ast.candles.concat(ast.curCandle ? [ast.curCandle] : []);
    const visStart = Math.max(0, allCandles.length - VISIBLE - 1);
    const visible = allCandles.slice(visStart);

    const LINE_POINTS = 120;
    const lineStart = Math.max(0, hist.length - LINE_POINTS - 1);
    const lineHist = hist.slice(lineStart);
    const sliceW = cw / (LINE_POINTS - 1);
    const tickFrac = eng.tickFrac;

    let pMin = Infinity, pMax = -Infinity;
    // Prefer candle range when candles are shown (gives visible wicks).
    // Line only widens range if candles are off.
    if (chartCandles && visible.length) {
      visible.forEach(c => { pMin = Math.min(pMin, c.l); pMax = Math.max(pMax, c.h); });
    } else if (chartLine) {
      lineHist.forEach(p => { pMin = Math.min(pMin, p); pMax = Math.max(pMax, p); });
    }
    pMin = Math.min(pMin, ast.lastPrice);
    pMax = Math.max(pMax, ast.lastPrice);
    if (!isFinite(pMin) || pMin === pMax) {
      pMin = ast.lastPrice * 0.995;
      pMax = ast.lastPrice * 1.005;
    }
    const pad = (pMax - pMin) * 0.15 || ast.lastPrice * 0.005 || 1;
    pMin -= pad; pMax += pad;
    const range = pMax - pMin || 1;

    const startP = lineHist[0] || hist[0];
    const endP = ast.lastPrice;
    const up = endP >= startP;

    cctx.save();
    cctx.beginPath();
    cctx.rect(padL, padT, cw, ch);
    cctx.clip();

    if (chartLine) {
      const offset = -tickFrac * sliceW;
      cctx.beginPath();
      lineHist.forEach((p, i) => {
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW + offset;
        const y = padT + ch - (p - pMin) / range * ch;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      });
      cctx.strokeStyle = up ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.5)';
      cctx.lineWidth = 1.2;
      cctx.stroke();
      cctx.lineTo(padL + cw, padT + ch); cctx.lineTo(padL, padT + ch); cctx.closePath();
      const fg = cctx.createLinearGradient(0, padT, 0, padT + ch);
      if (up) { fg.addColorStop(0, 'rgba(34,197,94,.10)'); fg.addColorStop(1, 'rgba(34,197,94,0)'); }
      else { fg.addColorStop(0, 'rgba(239,68,68,.10)'); fg.addColorStop(1, 'rgba(239,68,68,0)'); }
      cctx.fillStyle = fg; cctx.fill();
    }

    if (chartCandles && visible.length) {
      const cbw = candleW * 0.7;
      const rightX = padL + cw - candleW * 0.5;
      const scroll = candleProgress * candleW;
      visible.forEach((c, i) => {
        const fromRight = (visible.length - 1 - i);
        const x = rightX - fromRight * candleW - scroll;
        const yO = padT + ch - (c.o - pMin) / range * ch;
        const yC = padT + ch - (c.c - pMin) / range * ch;
        const yH = padT + ch - (c.h - pMin) / range * ch;
        const yL = padT + ch - (c.l - pMin) / range * ch;
        const green = c.c >= c.o;
        cctx.strokeStyle = green ? '#22c55e' : '#ef4444';
        cctx.fillStyle = green ? 'rgba(34,197,94,.75)' : 'rgba(239,68,68,.75)';
        cctx.lineWidth = 1;
        cctx.shadowColor = green ? '#22c55e' : '#ef4444';
        cctx.shadowBlur = 3;
        cctx.beginPath(); cctx.moveTo(x, yH); cctx.lineTo(x, yL); cctx.stroke();
        cctx.shadowBlur = 0;
        const top = Math.min(yO, yC); const bot = Math.max(yO, yC);
        cctx.fillRect(x - cbw / 2, top, cbw, Math.max(1, bot - top));
        cctx.strokeRect(x - cbw / 2, top, cbw, Math.max(1, bot - top));
      });
    }

    cctx.restore();

    cctx.fillStyle = '#5a6a82'; cctx.font = '10px monospace'; cctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const v = pMin + range * (1 - i / 5);
      const y = padT + ch * i / 5;
      cctx.fillText(fmt(v, v < 10 ? 3 : 2), w - padR + 6, y + 4);
    }
    const yNow = padT + ch - (ast.lastPrice - pMin) / range * ch;
    cctx.strokeStyle = up ? '#22c55e' : '#ef4444';
    cctx.setLineDash([4, 4]); cctx.lineWidth = 1;
    cctx.beginPath(); cctx.moveTo(0, yNow); cctx.lineTo(w - padR, yNow); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = up ? '#22c55e' : '#ef4444';
    cctx.fillRect(w - padR + 2, yNow - 9, padR - 6, 18);
    cctx.fillStyle = '#000'; cctx.font = 'bold 11px monospace';
    cctx.fillText(fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2), w - padR + 6, yNow + 4);

    // SL/TP/Entry lines
    const playerHold = eng.player().holdings[a.id];
    if (playerHold && playerHold.shares !== 0) {
      const draw = (price: number, color: string, label: string) => {
        if (!(price > 0)) return;
        const y = padT + ch - (price - pMin) / range * ch;
        if (y < padT - 2 || y > padT + ch + 2) return;
        cctx.strokeStyle = color;
        cctx.setLineDash([5, 4]); cctx.lineWidth = 1;
        cctx.beginPath(); cctx.moveTo(padL, y); cctx.lineTo(w - padR - 2, y); cctx.stroke();
        cctx.setLineDash([]);
        const lw = 42;
        cctx.fillStyle = color; cctx.fillRect(padL, y - 7, lw, 13);
        cctx.fillStyle = '#000'; cctx.font = 'bold 9px monospace'; cctx.textAlign = 'center';
        cctx.fillText(label, padL + lw / 2, y + 3); cctx.textAlign = 'left';
      };
      draw(playerHold.avgCost, '#fbbf24', playerHold.shares > 0 ? 'LONG' : 'SHORT');
      draw(playerHold.sl || 0, '#ef4444', 'SL');
      draw(playerHold.tp || 0, '#22c55e', 'TP');
    }

    const bb = bestBid(ast.book), ba = bestAsk(ast.book);
    if (bb > 0 && bb >= pMin && bb <= pMax) {
      const yb = padT + ch - (bb - pMin) / range * ch;
      cctx.strokeStyle = 'rgba(34,197,94,.4)'; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(padL, yb); cctx.lineTo(w - padR, yb); cctx.stroke();
    }
    if (isFinite(ba) && ba >= pMin && ba <= pMax) {
      const ya = padT + ch - (ba - pMin) / range * ch;
      cctx.strokeStyle = 'rgba(239,68,68,.4)'; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(padL, ya); cctx.lineTo(w - padR, ya); cctx.stroke();
    }

    if (chartVol && volH > 2) {
      const vy0 = h - volH + 2;
      const vh = volH - 4;
      const vols = ast.volumeHist;
      const maxV = Math.max(1, ...vols.slice(-120));
      const showN = Math.min(120, vols.length);
      const bw = cw / showN;
      cctx.fillStyle = 'rgba(56,189,248,.4)';
      for (let i = 0; i < showN; i++) {
        const v = vols[vols.length - showN + i] || 0;
        const bh2 = (v / maxV) * vh;
        cctx.fillRect(padL + i * bw, vy0 + (vh - bh2), Math.max(1, bw - 1), bh2);
      }
      cctx.fillStyle = '#5a6a82'; cctx.font = '9px monospace';
      cctx.fillText('VOL', padL + 2, vy0 + 9);
    }
  });

  const chg = ast.lastPrice - ast.open;
  const chgP = chg / (ast.open || 1) * 100;

  return (
    <>
      <div className="chart-header">
        <svg className="chart-sym-icon"><use href={`#${a.icon}`}/></svg>
        <div className="chart-sym-info">
          <div className="sym">{a.id}</div>
          <div className="name">{a.name}</div>
        </div>
        <div className="chart-price-block">
          <div className={'price ' + (chg >= 0 ? 'up' : 'dn')}>{fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2)}</div>
          <div className={'chg ' + (chg >= 0 ? 'up' : 'dn')}>{(chg >= 0 ? '+' : '') + fmt(chg)} ({fmtPct(chgP)})</div>
        </div>
        <div className="chart-info">
          <span>Vol <b>{fmtNum(ast.volume)}</b></span>
          <span>Hi <b>{fmt(ast.hi, ast.hi < 10 ? 3 : 2)}</b></span>
          <span>Lo <b>{fmt(ast.lo, ast.lo < 10 ? 3 : 2)}</b></span>
          <span className="chart-toggles">
            <button className={chartLine ? 'on' : ''} onClick={() => { toggleChartLayer('chartLine'); Audio.click(); }}>LINE</button>
            <button className={chartCandles ? 'on' : ''} onClick={() => { toggleChartLayer('chartCandles'); Audio.click(); }}>CANDLES</button>
            <button className={chartVol ? 'on' : ''} onClick={() => { toggleChartLayer('chartVol'); Audio.click(); }}>VOL</button>
          </span>
        </div>
      </div>
      <div className="chart-box">
        <canvas id="chart" ref={canvasRef} />
      </div>
    </>
  );
}
