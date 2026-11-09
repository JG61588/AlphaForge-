import React, { useState, useRef } from 'react';
import { CandleBar, TradeRecord } from '../data/marketData';
import { Maximize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface CandlestickChartProps {
  bars: CandleBar[];
  trades: TradeRecord[];
  symbol: string;
  showIndicators?: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  bars,
  trades,
  symbol,
  showIndicators = true,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!bars || bars.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
        No bar data available
      </div>
    );
  }

  // Handle zoom slicing
  const visibleCount = Math.max(25, Math.floor(bars.length / zoomLevel));
  const visibleBars = bars.slice(-visibleCount);
  const startIndex = bars.length - visibleCount;

  // Layout metrics
  const width = 1000;
  const height = 540;
  const priceHeight = 330;
  const volumeHeight = 70;
  const rsiHeight = 85;
  const gap = 15;

  const yPriceTop = 30;
  const yPriceBottom = yPriceTop + priceHeight;
  const yVolTop = yPriceBottom + gap;
  const yVolBottom = yVolTop + volumeHeight;
  const yRsiTop = yVolBottom + gap;
  const yRsiBottom = yRsiTop + rsiHeight;

  // Price bounds
  const prices = visibleBars.flatMap((b) => [b.high, b.low, b.fastMa ?? b.close, b.slowMa ?? b.close]);
  const minPrice = Math.min(...prices) * 0.996;
  const maxPrice = Math.max(...prices) * 1.004;
  const priceRange = maxPrice - minPrice || 1;

  // Volume bounds
  const maxVol = Math.max(...visibleBars.map((b) => b.volume), 1);

  // X coordinate calculation
  const paddingX = 45;
  const plotWidth = width - paddingX * 2;
  const barSpacing = plotWidth / visibleBars.length;
  const candleWidth = Math.max(3, barSpacing * 0.68);

  const getX = (index: number) => paddingX + index * barSpacing + barSpacing / 2;
  const getYPrice = (val: number) => yPriceBottom - ((val - minPrice) / priceRange) * priceHeight;
  const getYVol = (val: number) => yVolBottom - (val / maxVol) * volumeHeight;
  const getYRsi = (val: number) => yRsiBottom - (Math.min(100, Math.max(0, val)) / 100) * rsiHeight;

  // Active hover bar
  const activeBar = hoverIndex !== null && visibleBars[hoverIndex] ? visibleBars[hoverIndex] : visibleBars[visibleBars.length - 1];

  // Map trades that fall into visible window
  const visibleTrades = trades.filter((t) => {
    return visibleBars.some((b) => b.timestamp === t.entryTime || b.timestamp === t.exitTime);
  });

  return (
    <div className="relative bg-[#060913] rounded-xl border border-slate-800/80 p-3 shadow-2xl overflow-hidden select-none">
      {/* Top Header Bar & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-base tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {symbol}
          </span>
          <span className="text-slate-400 font-mono">
            O: <strong className="text-slate-200">${activeBar.open.toFixed(2)}</strong>
          </span>
          <span className="text-slate-400 font-mono">
            H: <strong className="text-emerald-400">${activeBar.high.toFixed(2)}</strong>
          </span>
          <span className="text-slate-400 font-mono">
            L: <strong className="text-rose-400">${activeBar.low.toFixed(2)}</strong>
          </span>
          <span className="text-slate-400 font-mono">
            C: <strong className={activeBar.close >= activeBar.open ? 'text-emerald-400' : 'text-rose-400'}>${activeBar.close.toFixed(2)}</strong>
          </span>
          <span className="text-slate-400 font-mono hidden sm:inline">
            Vol: <strong className="text-cyan-300">{(activeBar.volume / 1000).toFixed(0)}k</strong>
          </span>
          {activeBar.rsi !== undefined && (
            <span className="text-purple-300 font-mono hidden md:inline">
              RSI(14): <strong>{activeBar.rsi.toFixed(1)}</strong>
            </span>
          )}
        </div>

        {/* Chart View Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => setZoomLevel((z) => Math.min(z + 0.5, 3))}
            className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(z - 0.5, 1))}
            className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
            title="Reset Zoom"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive SVG Financial Plot */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto relative mt-2"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            const relX = mouseX - paddingX;
            if (relX >= 0 && relX <= plotWidth) {
              const idx = Math.floor(relX / barSpacing);
              if (idx >= 0 && idx < visibleBars.length) {
                setHoverIndex(idx);
              }
            }
          }}
        >
          <defs>
            <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e676" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00c853" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff1744" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d50000" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = yPriceTop + priceHeight * ratio;
            const priceVal = maxPrice - ratio * priceRange;
            return (
              <g key={`grid-p-${ratio}`}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#17223b" strokeDasharray="3 3" />
                <text x={width - paddingX + 5} y={y + 3} fill="#64748b" fontSize="9" fontFamily="monospace">
                  ${priceVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Subplot Separators */}
          <line x1={paddingX} y1={yVolTop - gap / 2} x2={width - paddingX} y2={yVolTop - gap / 2} stroke="#1e293b" />
          <text x={paddingX} y={yVolTop - 3} fill="#94a3b8" fontSize="10" fontWeight="600">
            VOLUME
          </text>

          <line x1={paddingX} y1={yRsiTop - gap / 2} x2={width - paddingX} y2={yRsiTop - gap / 2} stroke="#1e293b" />
          <text x={paddingX} y={yRsiTop - 3} fill="#c084fc" fontSize="10" fontWeight="600">
            RSI(14)
          </text>

          {/* RSI Guidance Lines (70 Overbought, 30 Oversold) */}
          <line
            x1={paddingX}
            y1={getYRsi(70)}
            x2={width - paddingX}
            y2={getYRsi(70)}
            stroke="#ef4444"
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <text x={width - paddingX + 4} y={getYRsi(70) + 3} fill="#ef4444" fontSize="9" fontFamily="monospace">
            70
          </text>
          <line
            x1={paddingX}
            y1={getYRsi(30)}
            x2={width - paddingX}
            y2={getYRsi(30)}
            stroke="#22c55e"
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <text x={width - paddingX + 4} y={getYRsi(30) + 3} fill="#22c55e" fontSize="9" fontFamily="monospace">
            30
          </text>

          {/* Volume Bars */}
          {visibleBars.map((bar, idx) => {
            const x = getX(idx);
            const isBull = bar.close >= bar.open;
            const barH = ((bar.volume / maxVol) * volumeHeight) || 2;
            const y = yVolBottom - barH;
            return (
              <rect
                key={`vol-${idx}`}
                x={x - candleWidth / 2}
                y={y}
                width={candleWidth}
                height={barH}
                fill={isBull ? '#00e676' : '#ff1744'}
                opacity={0.4}
              />
            );
          })}

          {/* Candlestick Bars */}
          {visibleBars.map((bar, idx) => {
            const x = getX(idx);
            const isBull = bar.close >= bar.open;
            const yHigh = getYPrice(bar.high);
            const yLow = getYPrice(bar.low);
            const yOpen = getYPrice(bar.open);
            const yClose = getYPrice(bar.close);

            const candleTop = Math.min(yOpen, yClose);
            const candleBodyHeight = Math.max(2, Math.abs(yClose - yOpen));
            const color = isBull ? '#00e676' : '#ff1744';

            return (
              <g key={`bar-${idx}`}>
                {/* Wick */}
                <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={1.2} />
                {/* Real Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={candleTop}
                  width={candleWidth}
                  height={candleBodyHeight}
                  fill={isBull ? 'url(#bullGrad)' : 'url(#bearGrad)'}
                  stroke={color}
                  strokeWidth={1}
                  rx={1}
                />
              </g>
            );
          })}

          {/* Moving Average Indicators */}
          {showIndicators && (
            <>
              {/* Fast MA Polyline */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.8}
                points={visibleBars
                  .map((b, idx) => (b.fastMa ? `${getX(idx)},${getYPrice(b.fastMa)}` : null))
                  .filter(Boolean)
                  .join(' ')}
              />
              {/* Slow MA Polyline */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2.0}
                points={visibleBars
                  .map((b, idx) => (b.slowMa ? `${getX(idx)},${getYPrice(b.slowMa)}` : null))
                  .filter(Boolean)
                  .join(' ')}
              />
            </>
          )}

          {/* RSI Line */}
          {showIndicators && (
            <polyline
              fill="none"
              stroke="#c084fc"
              strokeWidth={1.7}
              points={visibleBars
                .map((b, idx) => (b.rsi !== undefined ? `${getX(idx)},${getYRsi(b.rsi)}` : null))
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* Buy & Sell Strategy Signal Overlays */}
          {visibleTrades.map((t) => {
            const entryIdx = visibleBars.findIndex((b) => b.timestamp === t.entryTime);
            const exitIdx = visibleBars.findIndex((b) => b.timestamp === t.exitTime);

            return (
              <g key={`signals-${t.id}`}>
                {/* Green Up Arrow for BUY Entry */}
                {entryIdx >= 0 && (
                  <g transform={`translate(${getX(entryIdx)}, ${getYPrice(t.entryPrice) + 18})`}>
                    <polygon
                      points="0,-14 6,-2 -6,-2"
                      fill="#00ff88"
                      stroke="#052e16"
                      strokeWidth={1.5}
                      filter="drop-shadow(0px 0px 4px #00ff88)"
                    />
                    <rect x={-18} y={-1} width={36} height={13} rx={3} fill="#052e16" stroke="#00ff88" strokeWidth={0.8} />
                    <text x={0} y={9} fill="#00ff88" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      BUY
                    </text>
                  </g>
                )}

                {/* Red Down Arrow for SELL Exit */}
                {exitIdx >= 0 && (
                  <g transform={`translate(${getX(exitIdx)}, ${getYPrice(t.exitPrice) - 18})`}>
                    <polygon
                      points="0,14 6,2 -6,2"
                      fill="#ff3366"
                      stroke="#4c0519"
                      strokeWidth={1.5}
                      filter="drop-shadow(0px 0px 4px #ff3366)"
                    />
                    <rect
                      x={-24}
                      y={-14}
                      width={48}
                      height={13}
                      rx={3}
                      fill="#4c0519"
                      stroke="#ff3366"
                      strokeWidth={0.8}
                    />
                    <text x={0} y={-4} fill="#ff3366" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      {t.pnlPercent >= 0 ? `+${t.pnlPercent.toFixed(1)}%` : `${t.pnlPercent.toFixed(1)}%`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Interactive Crosshair & Tooltip Overlay */}
          {hoverIndex !== null && visibleBars[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={yPriceTop}
                x2={getX(hoverIndex)}
                y2={yRsiBottom}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={getYPrice(visibleBars[hoverIndex].close)}
                x2={width - paddingX}
                y2={getYPrice(visibleBars[hoverIndex].close)}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getYPrice(visibleBars[hoverIndex].close)}
                r={4}
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth={1.5}
              />
              {/* Timestamp label at bottom */}
              <rect
                x={getX(hoverIndex) - 35}
                y={yRsiBottom + 5}
                width={70}
                height={16}
                rx={3}
                fill="#0f172a"
                stroke="#334155"
              />
              <text
                x={getX(hoverIndex)}
                y={yRsiBottom + 17}
                fill="#cbd5e1"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {visibleBars[hoverIndex].timestamp}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 px-2 border-t border-slate-800/60 mt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#38bdf8]"></span>
            <span>Fast MA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#f59e0b]"></span>
            <span>Slow MA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#c084fc]"></span>
            <span>RSI(14)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#00ff88]"></span>
            <span>Buy Signal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#ff3366]"></span>
            <span>Sell Signal</span>
          </div>
        </div>
        <span className="text-slate-500 font-mono">Plotly Dark Engine Equivalent</span>
      </div>
    </div>
  );
};
