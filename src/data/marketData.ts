export interface CandleBar {
  timestamp: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fastMa?: number;
  slowMa?: number;
  rsi?: number;
}

export interface TradeRecord {
  id: string;
  entryTime: string;
  exitTime: string;
  type: 'LONG';
  entryPrice: number;
  exitPrice: number;
  shares: number;
  duration: string;
  pnlDollars: number;
  pnlPercent: number;
  isWin: boolean;
  exitReason: string;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  netPnlDollars: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPct: number;
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  tradeExpectancy: number;
  winningTrades: number;
  losingTrades: number;
  avgWinDollars: number;
  avgLossDollars: number;
}

export interface StrategyParams {
  fastMa: number;
  slowMa: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  stopLossPct: number;
  takeProfitPct: number;
  initialCapital: number;
}

// Generates realistic OHLCV price series for backtesting
export function generateMarketData(
  symbol: string,
  timeframe: string,
  count: number = 100
): CandleBar[] {
  const seedPrices: Record<string, { base: number; vol: number }> = {
    NVDA: { base: 135.0, vol: 0.022 },
    AAPL: { base: 228.0, vol: 0.014 },
    TSLA: { base: 260.0, vol: 0.035 },
    SPY: { base: 585.0, vol: 0.009 },
    MSFT: { base: 425.0, vol: 0.012 },
    'BTC-USD': { base: 88500.0, vol: 0.038 },
    AMD: { base: 148.0, vol: 0.028 },
    QQQ: { base: 495.0, vol: 0.013 },
  };

  const config = seedPrices[symbol] || { base: 150.0, vol: 0.02 };
  let currentPrice = config.base;
  const bars: CandleBar[] = [];

  const now = new Date();
  const stepMinutes = timeframe === '1Day' ? 1440 : timeframe === '1Hour' ? 60 : timeframe === '15Min' ? 15 : 5;

  for (let i = count; i >= 0; i--) {
    const timeMs = now.getTime() - i * stepMinutes * 60 * 1000;
    const dateObj = new Date(timeMs);
    const dateStr = timeframe === '1Day'
      ? dateObj.toISOString().split('T')[0]
      : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Geometric Brownian motion with drift & mean-reverting swings
    const shock = (Math.random() - 0.485) * config.vol * currentPrice;
    const open = currentPrice;
    const close = Math.max(open + shock, 1.0);
    const high = Math.max(open, close) + Math.random() * 0.4 * Math.abs(shock);
    const low = Math.min(open, close) - Math.random() * 0.4 * Math.abs(shock);
    const volume = Math.floor(Math.random() * 450000 + 150000);

    currentPrice = close;

    bars.push({
      timestamp: dateStr,
      time: timeMs,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });
  }

  return computeIndicators(bars, 9, 21, 14);
}

export function computeIndicators(
  bars: CandleBar[],
  fastPeriod: number,
  slowPeriod: number,
  rsiPeriod: number
): CandleBar[] {
  const result = [...bars];

  // Moving averages
  for (let i = 0; i < result.length; i++) {
    // Fast MA
    if (i >= fastPeriod - 1) {
      let sum = 0;
      for (let j = i - fastPeriod + 1; j <= i; j++) {
        sum += result[j].close;
      }
      result[i].fastMa = parseFloat((sum / fastPeriod).toFixed(2));
    }

    // Slow MA
    if (i >= slowPeriod - 1) {
      let sum = 0;
      for (let j = i - slowPeriod + 1; j <= i; j++) {
        sum += result[j].close;
      }
      result[i].slowMa = parseFloat((sum / slowPeriod).toFixed(2));
    }

    // RSI Wilder
    if (i >= rsiPeriod) {
      let gains = 0;
      let losses = 0;
      for (let j = i - rsiPeriod + 1; j <= i; j++) {
        const diff = result[j].close - result[j - 1].close;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / rsiPeriod;
      const avgLoss = losses / rsiPeriod;
      if (avgLoss === 0) {
        result[i].rsi = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[i].rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(1));
      }
    } else {
      result[i].rsi = 50.0;
    }
  }

  return result;
}

export function simulateStrategyBacktest(
  bars: CandleBar[],
  params: StrategyParams
): {
  enrichedBars: CandleBar[];
  trades: TradeRecord[];
  metrics: BacktestMetrics;
  equityCurve: { timestamp: string; equity: number; cash: number; benchmark: number }[];
  terminalLogs: string[];
} {
  const enrichedBars = computeIndicators(bars, params.fastMa, params.slowMa, params.rsiPeriod);
  const trades: TradeRecord[] = [];
  const terminalLogs: string[] = [];
  const equityCurve: { timestamp: string; equity: number; cash: number; benchmark: number }[] = [];

  let cash = params.initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryTime = '';
  let entryIndex = 0;

  const benchmarkInitialShares = params.initialCapital / enrichedBars[0].close;

  terminalLogs.push(`[SYSTEM] Initialized Strategy Backtest with $${params.initialCapital.toLocaleString()}`);
  terminalLogs.push(`[CONFIG] Fast MA: ${params.fastMa} | Slow MA: ${params.slowMa} | RSI Oversold: ${params.rsiOversold} | RSI Overbought: ${params.rsiOverbought}`);

  for (let i = 0; i < enrichedBars.length; i++) {
    const bar = enrichedBars[i];
    const fast = bar.fastMa ?? bar.close;
    const slow = bar.slowMa ?? bar.close;
    const rsi = bar.rsi ?? 50.0;

    // Check risk management & exits for open long
    if (shares > 0) {
      const pnlPct = ((bar.close - entryPrice) / entryPrice) * 100;

      let exitReason = '';
      if (pnlPct <= -params.stopLossPct) {
        exitReason = `Stop-Loss Triggered (${pnlPct.toFixed(2)}% <= -${params.stopLossPct}%)`;
      } else if (pnlPct >= params.takeProfitPct) {
        exitReason = `Take-Profit Hit (+${pnlPct.toFixed(2)}% >= +${params.takeProfitPct}%)`;
      } else if (rsi >= params.rsiOverbought && bar.close < fast) {
        exitReason = `RSI Overbought (${rsi.toFixed(1)}) & MA Breakdown`;
      } else if (fast < slow && i - entryIndex > 2) {
        exitReason = `Trend Reversal (Fast MA < Slow MA)`;
      }

      if (exitReason) {
        const proceeds = shares * bar.close;
        const fee = proceeds * 0.0005;
        const netProceeds = proceeds - fee;
        cash += netProceeds;
        const pnlDollars = (bar.close - entryPrice) * shares - fee;

        trades.push({
          id: `TRD-${trades.length + 1}`,
          entryTime,
          exitTime: bar.timestamp,
          type: 'LONG',
          entryPrice,
          exitPrice: bar.close,
          shares,
          duration: `${i - entryIndex} bars`,
          pnlDollars: parseFloat(pnlDollars.toFixed(2)),
          pnlPercent: parseFloat(pnlPct.toFixed(2)),
          isWin: pnlDollars > 0,
          exitReason,
        });

        terminalLogs.push(
          `[${bar.timestamp}] 📉 EXIT LONG: Sold ${shares} shares @ $${bar.close.toFixed(2)} | PnL: ${pnlDollars >= 0 ? '+' : ''}$${pnlDollars.toFixed(2)} (${pnlPct.toFixed(2)}%) | ${exitReason}`
        );

        shares = 0;
        entryPrice = 0;
      } else if (i % 8 === 0) {
        terminalLogs.push(
          `[${bar.timestamp}] ⏳ Holding Long | Cost: $${entryPrice.toFixed(2)} | Current: $${bar.close.toFixed(2)} | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`
        );
      }
    } else {
      // Entry Conditions: Fast MA > Slow MA AND RSI <= Oversold
      const isUptrend = fast > slow;
      const isOversold = rsi <= params.rsiOversold;

      if (isUptrend && isOversold && i >= params.slowMa) {
        const allocate = cash * 0.95;
        const buyShares = Math.floor(allocate / bar.close);
        if (buyShares > 0) {
          const cost = buyShares * bar.close;
          const fee = cost * 0.0005;
          if (cost + fee <= cash) {
            cash -= (cost + fee);
            shares = buyShares;
            entryPrice = bar.close;
            entryTime = bar.timestamp;
            entryIndex = i;

            terminalLogs.push(
              `[${bar.timestamp}] 🚀 BUY SIGNAL: Bullish MA alignment (Fast > Slow) + RSI (${rsi.toFixed(1)} <= ${params.rsiOversold}). Bought ${shares} shares @ $${bar.close.toFixed(2)}`
            );
          }
        }
      } else if (i % 12 === 0) {
        terminalLogs.push(
          `[${bar.timestamp}] 🔍 Scan bar #${i}: Close=$${bar.close.toFixed(2)} | RSI=${rsi.toFixed(1)} | MA(${params.fastMa}/${params.slowMa})=${fast.toFixed(1)}/${slow.toFixed(1)} [SCANNING]`
        );
      }
    }

    const currentPortfolioVal = cash + (shares * bar.close);
    const benchmarkVal = benchmarkInitialShares * bar.close;
    equityCurve.push({
      timestamp: bar.timestamp,
      equity: parseFloat(currentPortfolioVal.toFixed(2)),
      cash: parseFloat(cash.toFixed(2)),
      benchmark: parseFloat(benchmarkVal.toFixed(2)),
    });
  }

  // Calculate Quantitative Performance Metrics
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? params.initialCapital;
  const netPnlDollars = finalEquity - params.initialCapital;
  const totalReturnPct = (netPnlDollars / params.initialCapital) * 100;

  // Drawdown
  let peak = params.initialCapital;
  let maxDd = 0;
  const returns: number[] = [];

  for (let i = 0; i < equityCurve.length; i++) {
    const val = equityCurve[i].equity;
    if (val > peak) peak = val;
    const dd = (val - peak) / peak;
    if (dd < maxDd) maxDd = dd;

    if (i > 0) {
      const prevVal = equityCurve[i - 1].equity;
      returns.push((val - prevVal) / prevVal);
    }
  }

  // Sharpe & Sortino
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);

  const downsideReturns = returns.filter((r) => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length
    : 0;
  const downsideStd = Math.sqrt(downsideVariance);

  const annualFactor = Math.sqrt(252);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * annualFactor : 0.0;
  const sortinoRatio = downsideStd > 0 ? (meanReturn / downsideStd) * annualFactor : 0.0;

  // Trade stats
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.isWin).length;
  const losingTrades = totalTrades - winningTrades;
  const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const grossProfit = trades.filter((t) => t.isWin).reduce((sum, t) => sum + t.pnlDollars, 0);
  const grossLoss = Math.abs(trades.filter((t) => !t.isWin).reduce((sum, t) => sum + t.pnlDollars, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0.0;

  const avgWinDollars = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLossDollars = losingTrades > 0 ? grossLoss / losingTrades : 0;

  const winProb = winRatePct / 100;
  const lossProb = 1 - winProb;
  const tradeExpectancy = (winProb * avgWinDollars) - (lossProb * avgLossDollars);

  return {
    enrichedBars,
    trades,
    equityCurve,
    terminalLogs,
    metrics: {
      initialCapital: params.initialCapital,
      finalEquity: parseFloat(finalEquity.toFixed(2)),
      totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
      netPnlDollars: parseFloat(netPnlDollars.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      maxDrawdownPct: parseFloat((maxDd * 100).toFixed(2)),
      totalTrades,
      winRatePct: parseFloat(winRatePct.toFixed(1)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      tradeExpectancy: parseFloat(tradeExpectancy.toFixed(2)),
      winningTrades,
      losingTrades,
      avgWinDollars: parseFloat(avgWinDollars.toFixed(2)),
      avgLossDollars: parseFloat(avgLossDollars.toFixed(2)),
    },
  };
}
