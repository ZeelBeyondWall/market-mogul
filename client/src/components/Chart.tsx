import { useEffect, useRef, useCallback, useState } from 'react';
import { ASSETS } from '../../../shared/engine/constants';
import { TF_LIST, TF_MS, type TFKey } from '../../../shared/engine/types';
import { fmt, fmtNum, fmtPct } from '../../../shared/engine/helpers';
import { bestAsk, bestBid } from '../../../shared/engine/orderbook';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';
import { getTickFrac } from '../net/wsClient';
import { computeIndicators, type IndicatorId } from '../utils/indicators';

const INDICATOR_OPTIONS: { id: IndicatorId; label: string }[] = [
  { id: 'sma', label: 'SMA' },
  { id: 'ema', label: 'EMA' },
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'bb', label: 'BB' },
];

export function Chart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useGame(s => s.engine);
  useGame(s => s.tick);
  const chartLine = useGame(s => s.chartLine);
  const chartCandles = useGame(s => s.chartCandles);
  const chartVol = useGame(s => s.chartVol);
  const toggleChartLayer = useGame(s => s.toggleChartLayer);
  const activeTF = useGame(s => s.activeTF);
  const setActiveTF = useGame(s => s.setActiveTF);
  const activeIndicators = useGame(s => s.activeIndicators);
  const toggleIndicator = useGame(s => s.toggleIndicator);

  // Interactive state
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = default, 0.5 = zoomed in, 2 = zoomed out
  const [panOffset, setPanOffset] = useState(0); // number of candles panned right
  const [yScale, setYScale] = useState(1); // Y-axis price scaling factor (TradingView style)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPan = useRef(0);
  const isDraggingY = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScale = useRef(1);
  const [hiddenIndicators, setHiddenIndicators] = useState<IndicatorId[]>([]);
  const [showIndModal, setShowIndModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ZScript Custom Indicators Setup
  interface CustomIndicator {
    id: string;
    name: string;
    code: string;
    color: string;
    active: boolean;
  }

  const [customIndicators, setCustomIndicators] = useState<CustomIndicator[]>(() => {
    try {
      const saved = localStorage.getItem('mm_custom_indicators');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveCustomIndicators = (list: CustomIndicator[]) => {
    setCustomIndicators(list);
    try {
      localStorage.setItem('mm_custom_indicators', JSON.stringify(list));
    } catch (err) {}
  };

  const [showZEditor, setShowZEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptCode, setScriptCode] = useState('');
  const [scriptColor, setScriptColor] = useState('#00f0ff');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compileSuccess, setCompileSuccess] = useState(false);

  const validateAndSave = () => {
    setCompileError(null);
    setCompileSuccess(false);

    if (!scriptName.trim()) {
      setCompileError('Indicator name cannot be empty.');
      return;
    }
    if (!scriptCode.trim()) {
      setCompileError('Script code cannot be empty.');
      return;
    }

    try {
      // 1. Syntax check
      const func = new Function('candles', scriptCode);

      // 2. Runtime test pass with mock candle series
      const mockCandles = [
        { o: 100, h: 105, l: 95, c: 102, v: 10, t: Date.now() },
        { o: 102, h: 110, l: 101, c: 108, v: 15, t: Date.now() + 1000 }
      ];
      
      const result = func(mockCandles);

      // 3. Validation of output type and length
      if (!Array.isArray(result)) {
        setCompileError('Validation failed: The script must return an array.');
        return;
      }
      if (result.length !== mockCandles.length) {
        setCompileError(`Validation failed: Returned length (${result.length}) does not match input candles length (${mockCandles.length}).`);
        return;
      }

      for (let i = 0; i < result.length; i++) {
        const val = result[i];
        if (val !== null && typeof val !== 'number') {
          setCompileError(`Validation failed: Item at index ${i} is not a number, null, or NaN.`);
          return;
        }
      }

      // Save custom script
      const newList = [...customIndicators];
      if (editingId) {
        const idx = newList.findIndex(x => x.id === editingId);
        if (idx !== -1) {
          newList[idx] = { ...newList[idx], name: scriptName, code: scriptCode, color: scriptColor };
        }
      } else {
        const id = 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        newList.push({ id, name: scriptName, code: scriptCode, color: scriptColor, active: true });
      }

      saveCustomIndicators(newList);
      setCompileSuccess(true);
      Audio.buy();

      setTimeout(() => {
        setShowZEditor(false);
        setEditingId(null);
        setCompileSuccess(false);
      }, 1000);

    } catch (err: any) {
      setCompileError(`Compilation Error: ${err.message || err}`);
    }
  };

  const a = ASSETS.find(x => x.id === eng.state.active)!;
  const ast = eng.state.assets[a.id];
  const series = ast.series?.[activeTF] || { candles: [], curCandle: null, candleStartT: 0 };
  const tfMs = TF_MS[activeTF];

  // Reset zoom/pan/yScale when active asset or TF changes
  useEffect(() => { 
    setZoomLevel(1); 
    setPanOffset(0); 
    setYScale(1); 
    setContextMenu(null); 
    setHiddenIndicators([]);
    setShowIndModal(false);
    setSearchQuery('');
  }, [a.id, activeTF]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y });
  }, []);

  // Canvas resize
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

  // Manual non-passive wheel handler to prevent console warnings & default browser scroll/zoom behavior
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(z => Math.max(0.3, Math.min(4, z + (e.deltaY > 0 ? 0.15 : -0.15))));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Pointer handlers for crosshair + zoom/pan (works for touch & mouse)
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    if (isDraggingY.current) {
      const dy = e.clientY - dragStartY.current;
      const sensitivity = 0.005;
      const newScale = Math.max(0.05, Math.min(20, dragStartScale.current + dy * sensitivity));
      setYScale(newScale);
    } else if (isDragging.current) {
      const dx = e.clientX - dragStartX.current;
      const canvasW = rect.width;
      const candlesPerScreen = Math.round(30 * zoomLevel);
      const candlePixelW = canvasW / candlesPerScreen;
      const panDelta = Math.round(dx / candlePixelW);
      setPanOffset(Math.max(0, dragStartPan.current + panDelta));
    }
  }, [zoomLevel]);

  const onPointerLeave = useCallback(() => {
    setMousePos(null);
    isDragging.current = false;
    isDraggingY.current = false;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x > w - 64) {
      isDraggingY.current = true;
      dragStartY.current = e.clientY;
      dragStartScale.current = yScale;
    } else {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartPan.current = panOffset;
    }
  }, [panOffset, yScale]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    isDragging.current = false;
    isDraggingY.current = false;
  }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width - 64) {
      setYScale(1);
      Audio.click();
    }
  }, []);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const cctx = canvas.getContext('2d'); if (!cctx) return;
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    cctx.clearRect(0, 0, w, h);
    const bg = cctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#030816'); bg.addColorStop(1, '#020308');
    cctx.fillStyle = bg; cctx.fillRect(0, 0, w, h);

    // Layout zones
    const activeSub = activeIndicators.filter(id => !hiddenIndicators.includes(id));
    const hasSubPanel = activeSub.includes('rsi') || activeSub.includes('macd');
    const volH = chartVol ? Math.min(50, h * 0.12) : 0;
    const subH = hasSubPanel ? Math.min(80, h * 0.2) : 0;
    const cyh = h - volH - subH;

    // Grid lines
    cctx.strokeStyle = 'rgba(0, 240, 255, 0.035)'; cctx.lineWidth = 1; cctx.beginPath();
    for (let i = 1; i < 5; i++) { const y = Math.floor(cyh * i / 5) + 0.5; cctx.moveTo(0, y); cctx.lineTo(w, y); }
    for (let i = 1; i < 8; i++) { const x = Math.floor(w * i / 8) + 0.5; cctx.moveTo(x, 0); cctx.lineTo(x, cyh); }
    cctx.stroke();

    const hist = ast.history;
    const padL = 8, padR = 64, padT = 10, padB = 10;
    const cw = w - padL - padR;
    const ch = cyh - padT - padB;

    const VISIBLE = Math.round(30 * zoomLevel);
    const candleW = cw / VISIBLE;
    const now = Date.now();
    const candleProgress = series.curCandle && series.candleStartT
      ? Math.min(1, (now - series.candleStartT) / tfMs) : 0;
    const allCandles = series.candles.concat(series.curCandle ? [series.curCandle] : []);
    const visStart = Math.max(0, allCandles.length - VISIBLE - 1 - panOffset);
    const visEnd = Math.min(allCandles.length, visStart + VISIBLE + 1);
    const visible = allCandles.slice(visStart, visEnd);

    const LINE_POINTS = Math.round(120 * zoomLevel);
    const lineStart = Math.max(0, hist.length - LINE_POINTS - 1 - panOffset);
    const lineEnd = Math.min(hist.length, lineStart + LINE_POINTS + 1);
    const lineHist = hist.slice(lineStart, lineEnd);
    const sliceW = cw / (LINE_POINTS - 1);
    const tickFrac = getTickFrac();

    let pMin = Infinity, pMax = -Infinity;
    if (chartCandles && visible.length) {
      visible.forEach(c => { pMin = Math.min(pMin, c.l); pMax = Math.max(pMax, c.h); });
    }
    if (chartLine || !visible.length) {
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

    // Apply Y-axis scale (TradingView-style drag scale)
    const mid = (pMax + pMin) / 2;
    const halfRange = ((pMax - pMin) / 2) * yScale;
    pMin = mid - halfRange;
    pMax = mid + halfRange;
    const range = pMax - pMin || 1;

    const startP = lineHist[0] || hist[0];
    const endP = ast.lastPrice;
    const up = endP >= startP;

    // Compute indicators for overlay
    const indicators = (activeIndicators.length > 0 && lineHist.length > 2)
      ? computeIndicators(lineHist)
      : null;

    cctx.save();
    cctx.beginPath();
    cctx.rect(padL, padT, cw, ch);
    cctx.clip();

    // === Bollinger Bands fill ===
    if (indicators && activeIndicators.includes('bb') && !hiddenIndicators.includes('bb')) {
      const bb = indicators;
      cctx.beginPath();
      let started = false;
      for (let i = 0; i < lineHist.length; i++) {
        if (isNaN(bb.bbUpper[i])) continue;
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (bb.bbUpper[i] - pMin) / range * ch;
        if (!started) { cctx.moveTo(x, y); started = true; } else cctx.lineTo(x, y);
      }
      for (let i = lineHist.length - 1; i >= 0; i--) {
        if (isNaN(bb.bbLower[i])) continue;
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (bb.bbLower[i] - pMin) / range * ch;
        cctx.lineTo(x, y);
      }
      cctx.closePath();
      cctx.fillStyle = 'rgba(138, 43, 226, 0.06)';
      cctx.fill();
      // Upper/Lower lines
      cctx.strokeStyle = 'rgba(138, 43, 226, 0.4)'; cctx.lineWidth = 1;
      cctx.beginPath();
      for (let i = 0; i < lineHist.length; i++) {
        if (isNaN(bb.bbUpper[i])) continue;
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (bb.bbUpper[i] - pMin) / range * ch;
        if (i === 0 || isNaN(bb.bbUpper[i - 1])) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
      cctx.beginPath();
      for (let i = 0; i < lineHist.length; i++) {
        if (isNaN(bb.bbLower[i])) continue;
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (bb.bbLower[i] - pMin) / range * ch;
        if (i === 0 || isNaN(bb.bbLower[i - 1])) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
    }

    // === Line chart ===
    if (chartLine) {
      const offset = -tickFrac * sliceW;
      cctx.beginPath();
      lineHist.forEach((p, i) => {
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW + offset;
        const y = padT + ch - (p - pMin) / range * ch;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      });
      cctx.strokeStyle = up ? '#2fa874' : '#dd4f60';
      cctx.lineWidth = 1.5;
      cctx.stroke();
      cctx.lineTo(padL + cw, padT + ch); cctx.lineTo(padL, padT + ch); cctx.closePath();
      const fg = cctx.createLinearGradient(0, padT, 0, padT + ch);
      if (up) { fg.addColorStop(0, 'rgba(47, 168, 116, 0.08)'); fg.addColorStop(1, 'rgba(47, 168, 116, 0)'); }
      else { fg.addColorStop(0, 'rgba(221, 79, 96, 0.08)'); fg.addColorStop(1, 'rgba(221, 79, 96, 0)'); }
      cctx.fillStyle = fg; cctx.fill();
    }

    // === Candles ===
    if (chartCandles && visible.length) {
      const cbw = candleW * 0.7;
      const rightX = padL + cw - candleW * 0.5;
      const scroll = panOffset === 0 ? candleProgress * candleW : 0;
      visible.forEach((c, i) => {
        const fromRight = (visible.length - 1 - i);
        const x = rightX - fromRight * candleW - scroll;
        const yO = padT + ch - (c.o - pMin) / range * ch;
        const yC = padT + ch - (c.c - pMin) / range * ch;
        const yH = padT + ch - (c.h - pMin) / range * ch;
        const yL = padT + ch - (c.l - pMin) / range * ch;
        const green = c.c >= c.o;
        cctx.strokeStyle = green ? '#2fa874' : '#dd4f60';
        cctx.fillStyle = green ? 'rgba(47, 168, 116, 0.75)' : 'rgba(221, 79, 96, 0.75)';
        cctx.lineWidth = 1;
        cctx.shadowColor = green ? '#2fa874' : '#dd4f60';
        cctx.shadowBlur = 2;
        cctx.beginPath(); cctx.moveTo(x, yH); cctx.lineTo(x, yL); cctx.stroke();
        cctx.shadowBlur = 0;
        const top = Math.min(yO, yC); const bot = Math.max(yO, yC);
        cctx.fillRect(x - cbw / 2, top, cbw, Math.max(1, bot - top));
        cctx.strokeRect(x - cbw / 2, top, cbw, Math.max(1, bot - top));
      });
    }

    // === Render Custom ZScript Indicators ===
    customIndicators.forEach(ind => {
      if (!ind.active) return;
      try {
        const func = new Function('candles', ind.code);
        cctx.strokeStyle = ind.color;
        cctx.lineWidth = 1.5;
        cctx.beginPath();

        if (chartCandles && visible.length) {
          // Draw overlay aligned with candles
          const customValues = func(allCandles);
          if (Array.isArray(customValues)) {
            const visibleCustom = customValues.slice(visStart, visEnd);
            const rightX = padL + cw - candleW * 0.5;
            const scroll = panOffset === 0 ? candleProgress * candleW : 0;
            let started = false;

            visibleCustom.forEach((val, i) => {
              if (val === null || isNaN(val) || typeof val !== 'number') {
                started = false;
                return;
              }
              const x = rightX - (visibleCustom.length - 1 - i) * candleW - scroll;
              const y = padT + ch - (val - pMin) / range * ch;
              if (!started) {
                cctx.moveTo(x, y);
                started = true;
              } else {
                cctx.lineTo(x, y);
              }
            });
            cctx.stroke();
          }
        } else {
          // Draw overlay aligned with line chart
          const lineCandles = hist.map(p => ({ o: p, h: p, l: p, c: p, v: 0, t: Date.now() }));
          const customValues = func(lineCandles);
          if (Array.isArray(customValues)) {
            const visibleCustom = customValues.slice(lineStart, lineEnd);
            const offset = -tickFrac * sliceW;
            let started = false;

            visibleCustom.forEach((val, i) => {
              if (val === null || isNaN(val) || typeof val !== 'number') {
                started = false;
                return;
              }
              const x = padL + cw - (visibleCustom.length - 1 - i) * sliceW + offset;
              const y = padT + ch - (val - pMin) / range * ch;
              if (!started) {
                cctx.moveTo(x, y);
                started = true;
              } else {
                cctx.lineTo(x, y);
              }
            });
            cctx.stroke();
          }
        }
      } catch (err) {
        // Silent catch during render to protect main drawing loop from user runtime bugs
      }
    });

    // === SMA overlay ===
    if (indicators && activeIndicators.includes('sma') && !hiddenIndicators.includes('sma')) {
      cctx.strokeStyle = '#f5a623'; cctx.lineWidth = 1.2;
      cctx.beginPath();
      for (let i = 0; i < lineHist.length; i++) {
        if (isNaN(indicators.sma20[i])) continue;
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (indicators.sma20[i] - pMin) / range * ch;
        if (i === 0 || isNaN(indicators.sma20[i - 1])) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
    }

    // === EMA overlay ===
    if (indicators && activeIndicators.includes('ema') && !hiddenIndicators.includes('ema')) {
      // EMA 12
      cctx.strokeStyle = '#00d4ff'; cctx.lineWidth = 1;
      cctx.beginPath();
      for (let i = 0; i < lineHist.length; i++) {
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (indicators.ema12[i] - pMin) / range * ch;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
      // EMA 26
      cctx.strokeStyle = '#ff6b9d'; cctx.lineWidth = 1;
      cctx.beginPath();
      for (let i = 0; i < lineHist.length; i++) {
        const x = padL + cw - (lineHist.length - 1 - i) * sliceW;
        const y = padT + ch - (indicators.ema26[i] - pMin) / range * ch;
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
    }

    cctx.restore();

    // === Y-axis labels ===
    cctx.fillStyle = '#718096'; cctx.font = '10px "JetBrains Mono", monospace'; cctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const v = pMin + range * (1 - i / 5);
      const y = padT + ch * i / 5;
      cctx.fillText(fmt(v, v < 10 ? 3 : 2), w - padR + 6, y + 4);
    }

    // === Current price line ===
    const yNow = padT + ch - (ast.lastPrice - pMin) / range * ch;
    cctx.strokeStyle = up ? '#2fa874' : '#dd4f60';
    cctx.setLineDash([4, 4]); cctx.lineWidth = 1;
    cctx.beginPath(); cctx.moveTo(0, yNow); cctx.lineTo(w - padR, yNow); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = up ? '#2fa874' : '#dd4f60';
    cctx.fillRect(w - padR + 2, yNow - 9, padR - 6, 18);
    cctx.fillStyle = '#000'; cctx.font = 'bold 11px "JetBrains Mono", monospace';
    cctx.fillText(fmt(ast.lastPrice, ast.lastPrice < 10 ? 3 : 2), w - padR + 6, yNow + 4);

    // === SL/TP/Entry lines ===
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
        cctx.fillStyle = '#000'; cctx.font = 'bold 9px "JetBrains Mono", monospace'; cctx.textAlign = 'center';
        cctx.fillText(label, padL + lw / 2, y + 3); cctx.textAlign = 'left';
      };
      draw(playerHold.avgCost, '#dfa637', playerHold.shares > 0 ? 'LONG' : 'SHORT');
      const isLong = playerHold.shares > 0;
      const slAbs = playerHold.slPct && playerHold.slPct > 0
        ? (isLong ? playerHold.avgCost * (1 - playerHold.slPct / 100) : playerHold.avgCost * (1 + playerHold.slPct / 100))
        : (playerHold.sl || 0);
      const tpAbs = playerHold.tpPct && playerHold.tpPct > 0
        ? (isLong ? playerHold.avgCost * (1 + playerHold.tpPct / 100) : playerHold.avgCost * (1 - playerHold.tpPct / 100))
        : (playerHold.tp || 0);
      draw(slAbs, '#dd4f60', 'SL');
      draw(tpAbs, '#2fa874', 'TP');
    }

    // === Bid/Ask lines ===
    const bb = bestBid(ast.book), ba = bestAsk(ast.book);
    if (bb > 0 && bb >= pMin && bb <= pMax) {
      const yb = padT + ch - (bb - pMin) / range * ch;
      cctx.strokeStyle = 'rgba(47, 168, 116, 0.15)'; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(padL, yb); cctx.lineTo(w - padR, yb); cctx.stroke();
    }
    if (isFinite(ba) && ba >= pMin && ba <= pMax) {
      const ya = padT + ch - (ba - pMin) / range * ch;
      cctx.strokeStyle = 'rgba(221, 79, 96, 0.15)'; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(padL, ya); cctx.lineTo(w - padR, ya); cctx.stroke();
    }

    // === Volume bars ===
    if (chartVol && volH > 2) {
      const vy0 = h - volH - subH + 2;
      const vh = volH - 4;
      const vols = ast.volumeHist;
      const maxV = Math.max(1, ...vols.slice(-120));
      const showN = Math.min(120, vols.length);
      const bw = cw / showN;
      cctx.fillStyle = 'rgba(91, 155, 213, 0.2)';
      for (let i = 0; i < showN; i++) {
        const v = vols[vols.length - showN + i] || 0;
        const bh2 = (v / maxV) * vh;
        cctx.fillRect(padL + i * bw, vy0 + (vh - bh2), Math.max(1, bw - 1), bh2);
      }
      cctx.fillStyle = '#94a3b8'; cctx.font = '9px "JetBrains Mono", monospace';
      cctx.fillText('VOL', padL + 2, vy0 + 9);
    }

    // === RSI sub-panel ===
    if (indicators && activeIndicators.includes('rsi') && !hiddenIndicators.includes('rsi') && subH > 10) {
      const rsiY0 = h - subH + 2;
      const rsiH = (activeIndicators.includes('macd') ? subH / 2 : subH) - 4;
      // Background
      cctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      cctx.fillRect(padL, rsiY0, cw, rsiH);
      // 30/70 levels
      cctx.strokeStyle = 'rgba(255,255,255,0.08)'; cctx.lineWidth = 1;
      const y30 = rsiY0 + rsiH * (1 - 30 / 100);
      const y70 = rsiY0 + rsiH * (1 - 70 / 100);
      cctx.setLineDash([2, 2]);
      cctx.beginPath(); cctx.moveTo(padL, y30); cctx.lineTo(padL + cw, y30); cctx.stroke();
      cctx.beginPath(); cctx.moveTo(padL, y70); cctx.lineTo(padL + cw, y70); cctx.stroke();
      cctx.setLineDash([]);
      // RSI line
      cctx.strokeStyle = '#e2b93d'; cctx.lineWidth = 1.2;
      cctx.beginPath();
      for (let i = 0; i < indicators.rsi.length; i++) {
        const x = padL + cw - (indicators.rsi.length - 1 - i) * sliceW;
        const y = rsiY0 + rsiH * (1 - indicators.rsi[i] / 100);
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
      cctx.fillStyle = '#94a3b8'; cctx.font = '9px "JetBrains Mono", monospace';
      cctx.fillText('RSI', padL + 2, rsiY0 + 10);
    }

    // === MACD sub-panel ===
    if (indicators && activeIndicators.includes('macd') && !hiddenIndicators.includes('macd') && subH > 10) {
      const hasRsi = activeIndicators.includes('rsi');
      const macdY0 = hasRsi ? (h - subH / 2 + 2) : (h - subH + 2);
      const macdH = (hasRsi ? subH / 2 : subH) - 4;
      cctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      cctx.fillRect(padL, macdY0, cw, macdH);
      // MACD histogram
      let maxMacd = 0;
      for (let i = 0; i < indicators.macdHist.length; i++)
        maxMacd = Math.max(maxMacd, Math.abs(indicators.macdHist[i]));
      if (maxMacd === 0) maxMacd = 1;
      const midY = macdY0 + macdH / 2;
      for (let i = 0; i < indicators.macdHist.length; i++) {
        const x = padL + cw - (indicators.macdHist.length - 1 - i) * sliceW;
        const val = indicators.macdHist[i];
        const barH = (Math.abs(val) / maxMacd) * (macdH / 2 - 2);
        cctx.fillStyle = val >= 0 ? 'rgba(47, 168, 116, 0.5)' : 'rgba(221, 79, 96, 0.5)';
        cctx.fillRect(x - 1, val >= 0 ? midY - barH : midY, 2, barH);
      }
      // MACD line
      cctx.strokeStyle = '#00d4ff'; cctx.lineWidth = 1;
      cctx.beginPath();
      for (let i = 0; i < indicators.macd.length; i++) {
        const x = padL + cw - (indicators.macd.length - 1 - i) * sliceW;
        const y = midY - (indicators.macd[i] / maxMacd) * (macdH / 2 - 2);
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
      // Signal line
      cctx.strokeStyle = '#ff6b9d'; cctx.lineWidth = 1;
      cctx.beginPath();
      for (let i = 0; i < indicators.macdSignal.length; i++) {
        const x = padL + cw - (indicators.macdSignal.length - 1 - i) * sliceW;
        const y = midY - (indicators.macdSignal[i] / maxMacd) * (macdH / 2 - 2);
        if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
      }
      cctx.stroke();
      cctx.fillStyle = '#94a3b8'; cctx.font = '9px "JetBrains Mono", monospace';
      cctx.fillText('MACD', padL + 2, macdY0 + 10);
    }

    // === CROSSHAIR + TOOLTIP ===
    if (mousePos && mousePos.x >= padL && mousePos.x <= padL + cw && mousePos.y >= padT && mousePos.y <= padT + ch) {
      const mx = mousePos.x;
      const my = mousePos.y;
      // Vertical line
      cctx.strokeStyle = 'rgba(255,255,255,0.2)'; cctx.lineWidth = 1;
      cctx.setLineDash([3, 3]);
      cctx.beginPath(); cctx.moveTo(mx, padT); cctx.lineTo(mx, padT + ch); cctx.stroke();
      // Horizontal line
      cctx.beginPath(); cctx.moveTo(padL, my); cctx.lineTo(padL + cw, my); cctx.stroke();
      cctx.setLineDash([]);

      // Price at cursor Y
      const cursorPrice = pMax - (my - padT) / ch * range;

      // Y-axis price label
      cctx.fillStyle = 'rgba(100, 116, 139, 0.9)';
      cctx.fillRect(w - padR + 2, my - 9, padR - 6, 18);
      cctx.fillStyle = '#fff'; cctx.font = '10px "JetBrains Mono", monospace';
      cctx.fillText(fmt(cursorPrice, cursorPrice < 10 ? 3 : 2), w - padR + 6, my + 3);

      // Find nearest candle for OHLCV tooltip
      if (chartCandles && visible.length > 0) {
        const candleIdx = Math.round((padL + cw - mx) / candleW);
        const dataIdx = visible.length - 1 - candleIdx;
        if (dataIdx >= 0 && dataIdx < visible.length) {
          const c = visible[dataIdx];
          const tooltipX = Math.min(mx + 12, w - 140);
          const tooltipY = Math.max(padT + 5, my - 70);
          // Tooltip background
          cctx.fillStyle = 'rgba(15, 20, 35, 0.92)';
          cctx.strokeStyle = 'rgba(0, 200, 255, 0.2)';
          cctx.lineWidth = 1;
          const tw = 125, th = 68;
          cctx.beginPath();
          cctx.roundRect(tooltipX, tooltipY, tw, th, 4);
          cctx.fill(); cctx.stroke();
          // Tooltip text
          cctx.fillStyle = '#94a3b8'; cctx.font = '9px "JetBrains Mono", monospace'; cctx.textAlign = 'left';
          const dec = c.o < 10 ? 3 : 2;
          cctx.fillText(`O ${c.o.toFixed(dec)}`, tooltipX + 6, tooltipY + 13);
          cctx.fillText(`H ${c.h.toFixed(dec)}`, tooltipX + 6, tooltipY + 25);
          cctx.fillText(`L ${c.l.toFixed(dec)}`, tooltipX + 6, tooltipY + 37);
          cctx.fillStyle = c.c >= c.o ? '#2fa874' : '#dd4f60';
          cctx.fillText(`C ${c.c.toFixed(dec)}`, tooltipX + 6, tooltipY + 49);
          cctx.fillStyle = '#5b9bd5';
          cctx.fillText(`V ${fmtNum(c.v)}`, tooltipX + 6, tooltipY + 61);
        }
      }
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
          <span className="chart-toggles tf-toggles">
            {TF_LIST.map(tf => (
              <button key={tf} className={activeTF === tf ? 'on' : ''} onClick={() => { setActiveTF(tf as TFKey); Audio.click(); }}>{tf}</button>
            ))}
          </span>
          <span className="chart-toggles">
            <button className={chartLine ? 'on' : ''} onClick={() => { toggleChartLayer('chartLine'); Audio.click(); }}>LINE</button>
            <button className={chartCandles ? 'on' : ''} onClick={() => { toggleChartLayer('chartCandles'); Audio.click(); }}>CANDLES</button>
            <button className={chartVol ? 'on' : ''} onClick={() => { toggleChartLayer('chartVol'); Audio.click(); }}>VOL</button>
          </span>
          <button className="indicator-search-trigger" onClick={() => { setShowIndModal(true); Audio.click(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, marginRight: 5, verticalAlign: 'middle' }}><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
            Indicators
          </button>
        </div>
      </div>
      <div className="chart-box">
        {(activeIndicators.length > 0 || customIndicators.some(x => x.active)) && (
          <div className="chart-legend">
            {/* Built-in Indicators */}
            {activeIndicators.map(id => {
              const label = INDICATOR_OPTIONS.find(o => o.id === id)?.label || id.toUpperCase();
              const isHidden = hiddenIndicators.includes(id);
              return (
                <div key={id} className="legend-item">
                  <span className="legend-label">{label}</span>
                  <button
                    className="legend-btn"
                    title={isHidden ? "Show" : "Hide"}
                    onClick={() => {
                      setHiddenIndicators(prev =>
                        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                      );
                      Audio.click();
                    }}
                  >
                    {isHidden ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="legend-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="legend-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                  <button
                    className="legend-btn close-btn"
                    title="Remove"
                    onClick={() => {
                      toggleIndicator(id);
                      setHiddenIndicators(prev => prev.filter(x => x !== id));
                      Audio.click();
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Custom ZScript Indicators */}
            {customIndicators.filter(x => x.active).map(ind => (
              <div key={ind.id} className="legend-item">
                <span className="legend-dot" style={{ background: ind.color, width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                <span className="legend-label">{ind.name}</span>
                <button
                  className="legend-btn"
                  title="Edit Script"
                  onClick={() => {
                    setEditingId(ind.id);
                    setScriptName(ind.name);
                    setScriptCode(ind.code);
                    setScriptColor(ind.color);
                    setShowZEditor(true);
                    setCompileError(null);
                    setCompileSuccess(false);
                    Audio.click();
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 10, height: 10 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button
                  className="legend-btn close-btn"
                  title="Remove Indicator"
                  onClick={() => {
                    const newList = customIndicators.map(x => x.id === ind.id ? { ...x, active: false } : x);
                    saveCustomIndicators(newList);
                    Audio.click();
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {showIndModal && (
          <div className="chart-modal-overlay" onClick={() => setShowIndModal(false)}>
            <div className="chart-modal" onClick={e => e.stopPropagation()}>
              <div className="chart-modal-header">
                <h3>Indicators & Metrics</h3>
                <button className="chart-modal-close" onClick={() => setShowIndModal(false)}>×</button>
              </div>
              <div className="chart-modal-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  type="text" 
                  placeholder="Search indicators (e.g. SMA, RSI...)" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="chart-modal-list">
                <div 
                  className="custom-indicator-create-btn" 
                  onClick={() => { 
                    setShowZEditor(true); 
                    setShowIndModal(false); 
                    setEditingId(null); 
                    setScriptName(''); 
                    setScriptCode('// Calculate custom value\nreturn candles.map(c => (c.h + c.l) / 2);'); 
                    setScriptColor('#00f0ff'); 
                    setCompileError(null); 
                    setCompileSuccess(false); 
                    Audio.click(); 
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14, marginRight: 6, verticalAlign: 'middle' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create ZScript Indicator
                </div>

                {INDICATOR_OPTIONS
                  .filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(opt => {
                    const isActive = activeIndicators.includes(opt.id);
                    return (
                      <div 
                        key={opt.id} 
                        className={`chart-modal-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          toggleIndicator(opt.id);
                          Audio.click();
                        }}
                      >
                        <span>{opt.label}</span>
                        {isActive && <span className="active-check">✓</span>}
                      </div>
                    );
                  })}

                {customIndicators.length > 0 && (
                  <>
                    <div className="chart-modal-section-title">ZScript (Custom)</div>
                    {customIndicators
                      .filter(ind => ind.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(ind => (
                        <div key={ind.id} className="chart-modal-item custom-item">
                          <div className="custom-item-left" onClick={() => {
                            const newList = customIndicators.map(x => x.id === ind.id ? { ...x, active: !x.active } : x);
                            saveCustomIndicators(newList);
                            Audio.click();
                          }}>
                            <span className="color-dot" style={{ background: ind.color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                            <span style={{ fontWeight: ind.active ? 'bold' : 'normal', color: ind.active ? '#f5a623' : '#c8d0e0' }}>{ind.name}</span>
                          </div>
                          <div className="custom-item-actions">
                            <button className="edit-btn" onClick={() => {
                              setEditingId(ind.id);
                              setScriptName(ind.name);
                              setScriptCode(ind.code);
                              setScriptColor(ind.color);
                              setShowZEditor(true);
                              setShowIndModal(false);
                              setCompileError(null);
                              setCompileSuccess(false);
                              Audio.click();
                            }}>Edit</button>
                            <button className="delete-btn" onClick={() => {
                              const newList = customIndicators.filter(x => x.id !== ind.id);
                              saveCustomIndicators(newList);
                              Audio.click();
                            }}>Delete</button>
                          </div>
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showZEditor && (
          <div className="chart-modal-overlay" onClick={() => { setShowZEditor(false); setEditingId(null); }}>
            <div className="chart-modal zscript-modal" onClick={e => e.stopPropagation()}>
              <div className="chart-modal-header">
                <h3>{editingId ? 'Edit ZScript' : 'Create ZScript'}</h3>
                <a href="/zscript-docs.html" target="_blank" className="zscript-docs-link">
                  DOCS 📖
                </a>
                <button className="chart-modal-close" onClick={() => { setShowZEditor(false); setEditingId(null); }}>×</button>
              </div>
              
              <div className="chart-modal-body zscript-body">
                <div className="zscript-row">
                  <label className="zscript-label">Indicator Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Weighted MA" 
                    value={scriptName}
                    onChange={e => setScriptName(e.target.value)}
                    className="zscript-input"
                  />
                </div>
                
                <div className="zscript-row">
                  <div className="zscript-row-header">
                    <label className="zscript-label">ZScript Code (JS Function Body)</label>
                    <span className="zscript-lang-badge">JS / ES6</span>
                  </div>
                  <textarea 
                    value={scriptCode}
                    onChange={e => setScriptCode(e.target.value)}
                    placeholder="// candles is an array of { o, h, l, c, v, t }&#10;return candles.map(c => c.c);"
                    className="zscript-textarea"
                    spellCheck={false}
                  />
                </div>

                <div className="zscript-row color-row">
                  <label className="zscript-label">Line Color</label>
                  <div className="zscript-color-picker-container">
                    <input 
                      type="color" 
                      value={scriptColor}
                      onChange={e => setScriptColor(e.target.value)}
                      className="zscript-color-picker"
                    />
                    <span className="zscript-color-hex">{scriptColor}</span>
                  </div>
                </div>

                {compileError && (
                  <div className="zscript-status error">
                    <div className="status-title">Compilation Failed ✗</div>
                    <div className="status-msg">{compileError}</div>
                  </div>
                )}

                {compileSuccess && (
                  <div className="zscript-status success">
                    <div className="status-title">Success ✅</div>
                    <div className="status-msg">Script compiled and saved!</div>
                  </div>
                )}
              </div>

              <div className="chart-modal-footer">
                <button className="zscript-btn cancel-btn" onClick={() => { setShowZEditor(false); setEditingId(null); }}>Cancel</button>
                <button className="zscript-btn save-btn" onClick={validateAndSave}>Compile & Save</button>
              </div>
            </div>
          </div>
        )}
        {(() => {
          let cursorStyle = 'crosshair';
          const isHoveringY = mousePos ? mousePos.x > (canvasRef.current?.getBoundingClientRect().width ?? 0) - 64 : false;
          if (isDraggingY.current) {
            cursorStyle = 'ns-resize';
          } else if (isDragging.current) {
            cursorStyle = 'grabbing';
          } else if (isHoveringY) {
            cursorStyle = 'ns-resize';
          }
          return (
            <>
              <canvas
                id="chart"
                ref={canvasRef}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
                style={{ cursor: cursorStyle, touchAction: 'none' }}
              />
              {contextMenu && (
                <div className="chart-ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
                  <div className="chart-ctx-item" onClick={() => { setZoomLevel(1); setPanOffset(0); setYScale(1); setContextMenu(null); Audio.click(); }}>
                    Reset Chart View
                  </div>
                  <div className="chart-ctx-divider" />
                  
                  <div className="chart-ctx-item chart-ctx-submenu-indicator">
                    Chart Type
                    <div className="chart-ctx-submenu">
                      <div className={`chart-ctx-item ${chartLine ? 'active' : ''}`} onClick={() => { toggleChartLayer('chartLine'); Audio.click(); }}>
                        {chartLine ? '✓ Line' : 'Line'}
                      </div>
                      <div className={`chart-ctx-item ${chartCandles ? 'active' : ''}`} onClick={() => { toggleChartLayer('chartCandles'); Audio.click(); }}>
                        {chartCandles ? '✓ Candles' : 'Candles'}
                      </div>
                      <div className={`chart-ctx-item ${chartVol ? 'active' : ''}`} onClick={() => { toggleChartLayer('chartVol'); Audio.click(); }}>
                        {chartVol ? '✓ Volume' : 'Volume'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="chart-ctx-item chart-ctx-submenu-indicator">
                    Timeframe
                    <div className="chart-ctx-submenu">
                      {TF_LIST.map(tf => (
                        <div key={tf} className={`chart-ctx-item ${activeTF === tf ? 'active' : ''}`} onClick={() => { setActiveTF(tf as TFKey); Audio.click(); }}>
                          {activeTF === tf ? `✓ ${tf}` : tf}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="chart-ctx-item chart-ctx-submenu-indicator">
                    Indicators
                    <div className="chart-ctx-submenu">
                      {INDICATOR_OPTIONS.map(opt => {
                        const isOn = activeIndicators.includes(opt.id);
                        return (
                          <div key={opt.id} className={`chart-ctx-item ${isOn ? 'active' : ''}`} onClick={() => { toggleIndicator(opt.id); Audio.click(); }}>
                            {isOn ? `✓ ${opt.label}` : opt.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <style>{`
                .chart-ctx-menu {
                  position: absolute;
                  z-index: 1000;
                  background: rgba(13, 20, 38, 0.97);
                  backdrop-filter: blur(10px);
                  border: 1px solid rgba(0, 240, 255, 0.18);
                  border-radius: 6px;
                  padding: 5px 0;
                  min-width: 170px;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 240, 255, 0.05);
                  font-family: var(--font-sans), sans-serif;
                  animation: chartMenuFade 0.12s ease-out;
                }
                @keyframes chartMenuFade {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
                .chart-ctx-item {
                  position: relative;
                  padding: 8px 14px;
                  color: #c8d0e0;
                  font-size: 11.5px;
                  cursor: pointer;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  transition: all 0.15s ease;
                  user-select: none;
                }
                .chart-ctx-item:hover {
                  background: rgba(0, 240, 255, 0.08);
                  color: #fff;
                }
                .chart-ctx-item.active {
                  color: #f5a623;
                  font-weight: bold;
                }
                .chart-ctx-divider {
                  height: 1px;
                  background: rgba(0, 240, 255, 0.1);
                  margin: 4px 0;
                }
                .chart-ctx-submenu-indicator::after {
                  content: '▶';
                  font-size: 7px;
                  color: #718096;
                  margin-left: 8px;
                }
                .chart-ctx-submenu {
                  display: none;
                  position: absolute;
                  left: 100%;
                  top: -5px;
                  background: rgba(13, 20, 38, 0.98);
                  border: 1px solid rgba(0, 240, 255, 0.18);
                  border-radius: 6px;
                  padding: 5px 0;
                  min-width: 130px;
                  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
                }
                .chart-ctx-item:hover > .chart-ctx-submenu {
                  display: block;
                }
                .indicator-search-trigger {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  background: rgba(0, 240, 255, 0.05);
                  border: 1px solid rgba(0, 240, 255, 0.15);
                  border-radius: 4px;
                  color: #c8d0e0;
                  padding: 5px 10px;
                  font-size: 10.5px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  outline: none;
                }
                .indicator-search-trigger:hover {
                  background: rgba(0, 240, 255, 0.12);
                  border-color: rgba(0, 240, 255, 0.3);
                  color: #fff;
                  box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
                }
                .chart-modal-overlay {
                  position: absolute;
                  top: 0; left: 0; right: 0; bottom: 0;
                  background: rgba(2, 4, 10, 0.75);
                  backdrop-filter: blur(4px);
                  z-index: 1001;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  animation: chartFadeIn 0.15s ease-out;
                }
                @keyframes chartFadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                .chart-modal {
                  background: rgba(13, 20, 38, 0.98);
                  border: 1px solid rgba(0, 240, 255, 0.25);
                  border-radius: 8px;
                  width: 90%;
                  max-width: 400px;
                  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 240, 255, 0.08);
                  animation: chartSlideUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
                  overflow: hidden;
                }
                @keyframes chartSlideUp {
                  from { transform: scale(0.9) translateY(20px); opacity: 0; }
                  to { transform: scale(1) translateY(0); opacity: 1; }
                }
                .chart-modal-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 14px 18px;
                  border-bottom: 1px solid rgba(0, 240, 255, 0.1);
                }
                .chart-modal-header h3 {
                  margin: 0;
                  font-size: 14px;
                  color: #fff;
                  font-weight: 700;
                  letter-spacing: 0.5px;
                }
                .chart-modal-close {
                  background: none;
                  border: none;
                  color: #718096;
                  font-size: 20px;
                  cursor: pointer;
                  padding: 0;
                  line-height: 1;
                }
                .chart-modal-close:hover {
                  color: #fff;
                }
                .chart-modal-search {
                  position: relative;
                  padding: 12px 18px;
                  border-bottom: 1px solid rgba(0, 240, 255, 0.08);
                }
                .chart-modal-search .search-icon {
                  position: absolute;
                  left: 28px;
                  top: 50%;
                  transform: translateY(-50%);
                  width: 14px;
                  height: 14px;
                  color: #718096;
                }
                .chart-modal-search input {
                  width: 100%;
                  background: rgba(0, 0, 0, 0.3);
                  border: 1px solid rgba(0, 240, 255, 0.12);
                  border-radius: 4px;
                  padding: 8px 12px 8px 32px;
                  color: #fff;
                  font-size: 12px;
                  outline: none;
                  transition: all 0.2s ease;
                }
                .chart-modal-search input:focus {
                  border-color: rgba(0, 240, 255, 0.4);
                  box-shadow: 0 0 8px rgba(0, 240, 255, 0.15);
                }
                .chart-modal-list {
                  max-height: 250px;
                  overflow-y: auto;
                  padding: 8px 0;
                }
                .chart-modal-item {
                  padding: 10px 20px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  color: #c8d0e0;
                  font-size: 12px;
                  cursor: pointer;
                  transition: all 0.15s ease;
                }
                .chart-modal-item:hover {
                  background: rgba(0, 240, 255, 0.08);
                  color: #fff;
                }
                .chart-modal-item.active {
                  color: #f5a623;
                  font-weight: bold;
                }
                .chart-legend {
                  position: absolute;
                  top: 15px;
                  left: 15px;
                  z-index: 100;
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                  pointer-events: none;
                }
                .legend-item {
                  background: rgba(13, 20, 38, 0.85);
                  backdrop-filter: blur(4px);
                  border: 1px solid rgba(255, 255, 255, 0.08);
                  border-radius: 4px;
                  padding: 4px 8px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  pointer-events: auto;
                }
                .legend-label {
                  font-family: var(--font-mono), monospace;
                  font-size: 10px;
                  font-weight: bold;
                  color: #c8d0e0;
                }
                .legend-btn {
                  background: none;
                  border: none;
                  color: #718096;
                  cursor: pointer;
                  padding: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: color 0.15s ease;
                  outline: none;
                }
                .legend-btn:hover {
                  color: #fff;
                }
                .legend-btn.close-btn {
                  font-size: 14px;
                  line-height: 1;
                }
                .legend-btn.close-btn:hover {
                  color: #dd4f60;
                }
                .legend-icon {
                  width: 12px;
                  height: 12px;
                }
              `}</style>
            </>
          );
        })()}
      </div>
    </>
  );
}
