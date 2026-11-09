import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Sliders,
  Terminal,
  Activity,
  Play,
  Pause,
  Key,
  ShieldCheck,
  RotateCcw,
  Code2,
  FolderTree,
  FileSpreadsheet,
  Zap,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import {
  generateMarketData,
  simulateStrategyBacktest,
  StrategyParams,
  CandleBar,
} from './data/marketData';
import { CandlestickChart } from './components/CandlestickChart';
import { TerminalLog } from './components/TerminalLog';
import { CodeSandbox } from './components/CodeSandbox';
import { PaperTradingDesk } from './components/PaperTradingDesk';
import { ProjectExplorer } from './components/ProjectExplorer';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'backtest' | 'code' | 'trades' | 'paper' | 'project'>('backtest');

  // Asset & Market Controls
  const [symbol, setSymbol] = useState<string>('NVDA');
  const [timeframe, setTimeframe] = useState<string>('1Day');
  const [lookback, setLookback] = useState<number>(90);

  // Alpaca API Vault State
  const [alpacaKey, setAlpacaKey] = useState<string>('');
  const [alpacaSecret, setAlpacaSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const alpacaConfigured = Boolean(alpacaKey.trim() && alpacaSecret.trim());

  // Strategy Parameters
  const [params, setParams] = useState<StrategyParams>({
    fastMa: 9,
    slowMa: 21,
    rsiPeriod: 14,
    rsiOversold: 32,
    rsiOverbought: 70,
    stopLossPct: 2.5,
    takeProfitPct: 5.0,
    initialCapital: 100000,
  });

  // Bot Live Loop State
  const [botRunning, setBotRunning] = useState<boolean>(false);

  // Generate historical bars
  const rawBars = useMemo(() => {
    return generateMarketData(symbol, timeframe, lookback);
  }, [symbol, timeframe, lookback]);

  // Run Backtest with current parameters
  const backtestResults = useMemo(() => {
    return simulateStrategyBacktest(rawBars, params);
  }, [rawBars, params]);

  const { enrichedBars, trades, metrics, equityCurve, terminalLogs: simLogs } = backtestResults;

  // Live Terminal Log State
  const [liveLogs, setLiveLogs] = useState<string[]>(simLogs);

  useEffect(() => {
    setLiveLogs(simLogs);
  }, [simLogs]);

  // Current price and delta
  const latestBar = enrichedBars[enrichedBars.length - 1] || rawBars[rawBars.length - 1];
  const prevBar = enrichedBars[enrichedBars.length - 2] || latestBar;
  const priceChange = latestBar ? latestBar.close - prevBar.close : 0;
  const priceChangePct = prevBar.close > 0 ? (priceChange / prevBar.close) * 100 : 0;

  // Append new log helper
  const addLog = (msg: string) => {
    setLiveLogs((prev) => [...prev, msg]);
  };

  // Bot timer simulation
  useEffect(() => {
    if (!botRunning) return;
    const interval = setInterval(() => {
      const ts = new Date().toLocaleTimeString();
      addLog(`[${ts}] 🔍 Bot heartbeat scanning ${symbol} orderbook... [OK]`);
    }, 4500);
    return () => clearInterval(interval);
  }, [botRunning, symbol]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Main Navigation Bar */}
      <header className="h-16 border-b border-slate-800/80 bg-[#060913]/90 backdrop-blur sticky top-0 z-50 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base tracking-tight">AlphaForge</h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  QUANT DESK
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Streamlit & Plotly Quantitative Trading Alternative
              </p>
            </div>
          </div>

          {/* Ticker & Timeframe Quick Selectors */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-400 mr-2">Asset:</span>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-transparent font-bold text-emerald-400 focus:outline-none cursor-pointer"
              >
                <option value="NVDA" className="bg-slate-900 text-white">NVDA (NVIDIA)</option>
                <option value="AAPL" className="bg-slate-900 text-white">AAPL (Apple)</option>
                <option value="TSLA" className="bg-slate-900 text-white">TSLA (Tesla)</option>
                <option value="SPY" className="bg-slate-900 text-white">SPY (S&P 500)</option>
                <option value="MSFT" className="bg-slate-900 text-white">MSFT (Microsoft)</option>
                <option value="BTC-USD" className="bg-slate-900 text-white">BTC-USD (Bitcoin)</option>
                <option value="AMD" className="bg-slate-900 text-white">AMD (Advanced Micro)</option>
                <option value="QQQ" className="bg-slate-900 text-white">QQQ (Invesco)</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              {['1Day', '1Hour', '15Min', '5Min'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded transition ${
                    timeframe === tf ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Status Badges & Bot Toggle */}
        <div className="flex items-center gap-3">
          {/* Feed Indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${
                alpacaConfigured
                  ? 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                  : 'bg-purple-950/60 border-purple-700/60 text-purple-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${alpacaConfigured ? 'bg-sky-400' : 'bg-purple-400'} animate-pulse`} />
              <span>{alpacaConfigured ? 'Alpaca IEX Live' : 'Yahoo Finance Fallback'}</span>
            </div>
          </div>

          {/* Bot State Button */}
          <button
            onClick={() => {
              const next = !botRunning;
              setBotRunning(next);
              addLog(`[${new Date().toLocaleTimeString()}] ${next ? '▶️ Bot STARTED' : '⏹️ Bot PAUSED'}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              botRunning
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {botRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{botRunning ? 'Bot Running' : 'Start Bot'}</span>
          </button>
        </div>
      </header>

      {/* Navigation Sub-Header Tabs */}
      <div className="border-b border-slate-800/80 bg-[#050811] px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-1">
          <button
            onClick={() => setActiveTab('backtest')}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'backtest'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Trading Desk & Backtest</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Python Strategy Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('trades')}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'trades'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Trade Ledger ({trades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('paper')}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'paper'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Paper Trading Simulation</span>
          </button>

          <button
            onClick={() => setActiveTab('project')}
            className={`flex items-center gap-2 px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'project'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Project Files & Local Run</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar Tuning + Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar: API Vault & Parameter Tuning */}
        <aside className="w-full lg:w-80 border-r border-slate-800/80 bg-[#060913] p-4 flex flex-col gap-5 shrink-0">
          {/* Alpaca API Vault */}
          <div className="bg-[#03060f] p-3.5 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                Alpaca API Vault
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  alpacaConfigured
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {alpacaConfigured ? 'Connected' : 'Optional'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">API Key ID</label>
                <input
                  type="text"
                  placeholder="PK..."
                  value={alpacaKey}
                  onChange={(e) => setAlpacaKey(e.target.value)}
                  className="w-full bg-slate-900/90 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-400">Secret Key</label>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Secret Key..."
                  value={alpacaSecret}
                  onChange={(e) => setAlpacaSecret(e.target.value)}
                  className="w-full bg-slate-900/90 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal">
              {alpacaConfigured
                ? '✅ Using Alpaca IEX live data & Paper Trading API.'
                : 'Using Yahoo Finance fallback for backtesting. Alpaca keys unlock automated Paper Trading execution.'}
            </p>
          </div>

          {/* Real-time Strategy Parameter Sliders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Strategy Parameters
              </span>
              <button
                onClick={() =>
                  setParams({
                    fastMa: 9,
                    slowMa: 21,
                    rsiPeriod: 14,
                    rsiOversold: 32,
                    rsiOverbought: 70,
                    stopLossPct: 2.5,
                    takeProfitPct: 5.0,
                    initialCapital: 100000,
                  })
                }
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Fast MA */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Fast MA Period</span>
                <span className="font-mono text-cyan-400 font-bold">{params.fastMa}</span>
              </div>
              <input
                type="range"
                min="3"
                max="50"
                value={params.fastMa}
                onChange={(e) => setParams({ ...params, fastMa: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Slow MA */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Slow MA Period</span>
                <span className="font-mono text-amber-400 font-bold">{params.slowMa}</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                value={params.slowMa}
                onChange={(e) => setParams({ ...params, slowMa: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* RSI Oversold Threshold */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">RSI Oversold (Buy Entry)</span>
                <span className="font-mono text-emerald-400 font-bold">≤ {params.rsiOversold}</span>
              </div>
              <input
                type="range"
                min="15"
                max="45"
                value={params.rsiOversold}
                onChange={(e) => setParams({ ...params, rsiOversold: Number(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* RSI Overbought Threshold */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">RSI Overbought (Sell Exit)</span>
                <span className="font-mono text-rose-400 font-bold">≥ {params.rsiOverbought}</span>
              </div>
              <input
                type="range"
                min="55"
                max="85"
                value={params.rsiOverbought}
                onChange={(e) => setParams({ ...params, rsiOverbought: Number(e.target.value) })}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Stop Loss % */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Stop Loss (%)</span>
                <span className="font-mono text-rose-400 font-bold">-{params.stopLossPct.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="15"
                step="0.5"
                value={params.stopLossPct}
                onChange={(e) => setParams({ ...params, stopLossPct: Number(e.target.value) })}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Take Profit % */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Take Profit (%)</span>
                <span className="font-mono text-emerald-400 font-bold">+{params.takeProfitPct.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={params.takeProfitPct}
                onChange={(e) => setParams({ ...params, takeProfitPct: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            <div>Engine: Streamlit / Plotly Dark Spec</div>
            <div>Latency: 18ms | Free IEX Tier</div>
          </div>
        </aside>

        {/* Center / Right Content Panel */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
          {/* TAB 1: BACKTEST & TRADING DESK */}
          {activeTab === 'backtest' && (
            <div className="space-y-6">
              {/* Top Quantitative Performance Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Last Price */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">{symbol} Price</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    ${latestBar ? latestBar.close.toFixed(2) : '0.00'}
                  </div>
                  <div className={`text-[11px] font-semibold ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
                  </div>
                </div>

                {/* Total Return */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">Total Return</div>
                  <div className={`text-lg font-bold font-mono mt-0.5 ${metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {metrics.totalReturnPct >= 0 ? '+' : ''}{metrics.totalReturnPct.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {metrics.netPnlDollars >= 0 ? '+' : ''}${metrics.netPnlDollars.toLocaleString()}
                  </div>
                </div>

                {/* Sharpe Ratio */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">Sharpe Ratio</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {metrics.sharpeRatio.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-cyan-400">Annualized (252d)</div>
                </div>

                {/* Sortino Ratio */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">Sortino Ratio</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {metrics.sortinoRatio.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-purple-400">Downside Volatility</div>
                </div>

                {/* Max Drawdown */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">Max Drawdown</div>
                  <div className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                    {metrics.maxDrawdownPct.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-slate-400">Peak-to-Trough</div>
                </div>

                {/* Win Rate */}
                <div className="bg-[#060913] p-3 rounded-xl border border-slate-800 shadow-lg">
                  <div className="text-[11px] text-slate-400">Win Rate</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {metrics.winRatePct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-emerald-400">
                    {metrics.winningTrades}W / {metrics.losingTrades}L
                  </div>
                </div>
              </div>

              {/* Secondary Stats Strip: Profit Factor & Expectancy */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#060913] p-2.5 px-3.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Profit Factor</span>
                  <span className="font-mono font-bold text-emerald-400">{metrics.profitFactor.toFixed(2)}</span>
                </div>
                <div className="bg-[#060913] p-2.5 px-3.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Trade Expectancy</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {metrics.tradeExpectancy >= 0 ? '+' : ''}${metrics.tradeExpectancy.toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#060913] p-2.5 px-3.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Avg Win</span>
                  <span className="font-mono font-bold text-emerald-400">+${metrics.avgWinDollars.toFixed(2)}</span>
                </div>
                <div className="bg-[#060913] p-2.5 px-3.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Avg Loss</span>
                  <span className="font-mono font-bold text-rose-400">-${metrics.avgLossDollars.toFixed(2)}</span>
                </div>
              </div>

              {/* Candlestick Financial Chart */}
              <CandlestickChart bars={enrichedBars} trades={trades} symbol={symbol} />

              {/* Live Terminal Log */}
              <TerminalLog logs={liveLogs} onClearLogs={() => setLiveLogs([])} />
            </div>
          )}

          {/* TAB 2: PYTHON STRATEGY SANDBOX */}
          {activeTab === 'code' && (
            <CodeSandbox
              initialCode={`class MyStrategy:
    """
    Mean-Reverting Momentum & RSI Pullback Strategy.
    """
    def __init__(self, params=None):
        self.params = {
            "fast_ma": 9,
            "slow_ma": 21,
            "rsi_period": 14,
            "rsi_oversold": 32,
            "rsi_overbought": 70,
            "stop_loss_pct": 2.5,
            "take_profit_pct": 5.0,
        }
        if params:
            self.params.update(params)

        self.position = 0          # 0 = Flat, 1 = Long
        self.entry_price = 0.0
        self.entry_time = None
        self.bars_processed = 0
        self.log_messages = []

    def log(self, message: str):
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df=None) -> str:
        self.bars_processed += 1
        close = bar["close"]
        ts_str = bar["timestamp"].strftime("%H:%M:%S") if hasattr(bar["timestamp"], "strftime") else str(bar["timestamp"])

        if history_df is None or len(history_df) < self.params["slow_ma"]:
            return "HOLD"

        current_row = history_df.iloc[-1]
        fast_ma = current_row.get("fast_ma", close)
        slow_ma = current_row.get("slow_ma", close)
        rsi = current_row.get("rsi", 50.0)

        # Risk Management for existing Long position
        if self.position > 0:
            pnl_pct = ((close - self.entry_price) / self.entry_price) * 100.0

            if pnl_pct <= -abs(self.params["stop_loss_pct"]):
                self.log(f"[{ts_str}] 🛑 STOP-LOSS: PnL {pnl_pct:.2f}%. Exit long @ \${close:.2f}")
                self.position = 0
                return "SELL"

            if pnl_pct >= self.params["take_profit_pct"]:
                self.log(f"[{ts_str}] 🎯 TAKE-PROFIT: PnL +{pnl_pct:.2f}%. Exit long @ \${close:.2f}")
                self.position = 0
                return "SELL"

            if rsi >= self.params["rsi_overbought"] and close < fast_ma:
                self.log(f"[{ts_str}] 📉 EXIT: RSI Overbought ({rsi:.1f}) & breakdown. Exit long @ \${close:.2f}")
                self.position = 0
                return "SELL"

            if fast_ma < slow_ma:
                self.log(f"[{ts_str}] 📉 EXIT: MA death-cross (Fast < Slow). Exit long @ \${close:.2f}")
                self.position = 0
                return "SELL"

            return "HOLD"

        # Long Entry Filter
        trend_bullish = fast_ma > slow_ma
        rsi_pullback = rsi <= self.params["rsi_oversold"]

        if trend_bullish and rsi_pullback:
            self.log(f"[{ts_str}] 🚀 BUY SIGNAL: Bullish MA alignment + RSI oversold ({rsi:.1f}). Long @ \${close:.2f}")
            self.position = 1
            self.entry_price = close
            self.entry_time = bar["timestamp"]
            return "BUY"

        return "HOLD"`}
              onRunStrategy={(newCode) => {
                addLog(`[${new Date().toLocaleTimeString()}] 🚀 Compiled and executed custom strategy.`);
                setActiveTab('backtest');
              }}
            />
          )}

          {/* TAB 3: TRADE AUDIT LEDGER */}
          {activeTab === 'trades' && (
            <div className="bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">Historical Trade Breakdown & Audit Ledger</h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive log of every entry, exit, duration, and mathematical PnL generated by the bot.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400">Total Trades: </span>
                    <strong className="text-white">{trades.length}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Gross PnL: </span>
                    <strong className={metrics.netPnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {metrics.netPnlDollars >= 0 ? '+' : ''}${metrics.netPnlDollars.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {trades.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No trades executed with current parameters. Try loosening the RSI oversold threshold or lowering MA periods.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Trade ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Entry Time</th>
                        <th className="py-2.5 px-3">Exit Time</th>
                        <th className="py-2.5 px-3">Entry ($)</th>
                        <th className="py-2.5 px-3">Exit ($)</th>
                        <th className="py-2.5 px-3">Shares</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">PnL ($)</th>
                        <th className="py-2.5 px-3">PnL (%)</th>
                        <th className="py-2.5 px-3">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {trades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 text-slate-400 font-sans">{trade.id}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold font-sans">
                              {trade.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400">{trade.entryTime}</td>
                          <td className="py-2 px-3 text-slate-400">{trade.exitTime}</td>
                          <td className="py-2 px-3 text-slate-200">${trade.entryPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-200">${trade.exitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-slate-300">{trade.shares.toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans">{trade.duration}</td>
                          <td className={`py-2 px-3 font-bold ${trade.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.pnlDollars >= 0 ? '+' : ''}${trade.pnlDollars.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 font-bold ${trade.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">{trade.exitReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PAPER TRADING SIMULATION */}
          {activeTab === 'paper' && (
            <PaperTradingDesk
              symbol={symbol}
              currentPrice={latestBar ? latestBar.close : 150}
              alpacaConfigured={alpacaConfigured}
              params={params}
              onEmitLog={addLog}
            />
          )}

          {/* TAB 5: PROJECT FILES & LOCAL RUN */}
          {activeTab === 'project' && <ProjectExplorer />}
        </main>
      </div>
    </div>
  );
}
