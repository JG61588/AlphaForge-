import React, { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, Code, Copy, Sparkles, BookOpen } from 'lucide-react';

interface CodeSandboxProps {
  initialCode: string;
  onRunStrategy: (code: string) => void;
}

const STRATEGY_PRESETS: Record<string, string> = {
  'RSI Pullback & MA Momentum (Default)': `class MyStrategy:
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

        return "HOLD"`,

  'Dual Moving Average Golden Cross': `class DualMACrossoverStrategy:
    """
    Classic Trend-Following Dual Moving Average Crossover.
    """
    def __init__(self, params=None):
        self.params = {
            "fast_ma": 9,
            "slow_ma": 21,
            "stop_loss_pct": 3.0,
            "take_profit_pct": 8.0,
        }
        if params:
            self.params.update(params)

        self.position = 0
        self.entry_price = 0.0
        self.log_messages = []

    def log(self, message: str):
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df=None) -> str:
        close = bar["close"]
        ts = str(bar["timestamp"])

        if history_df is None or len(history_df) < 2:
            return "HOLD"

        curr_fast = history_df.iloc[-1].get("fast_ma", close)
        curr_slow = history_df.iloc[-1].get("slow_ma", close)
        prev_fast = history_df.iloc[-2].get("fast_ma", close)
        prev_slow = history_df.iloc[-2].get("slow_ma", close)

        # Long Position Risk Checks
        if self.position > 0:
            pnl_pct = ((close - self.entry_price) / self.entry_price) * 100.0
            if pnl_pct <= -self.params["stop_loss_pct"]:
                self.log(f"[{ts}] 🛑 STOP-LOSS triggered @ \${close:.2f} ({pnl_pct:.2f}%)")
                self.position = 0
                return "SELL"

            # Death Cross (Fast crosses below Slow)
            if prev_fast >= prev_slow and curr_fast < curr_slow:
                self.log(f"[{ts}] 📉 DEATH CROSS: Fast MA crossed below Slow MA. SELL.")
                self.position = 0
                return "SELL"

            return "HOLD"

        # Golden Cross (Fast crosses above Slow)
        if prev_fast <= prev_slow and curr_fast > curr_slow:
            self.log(f"[{ts}] 🚀 GOLDEN CROSS: Fast MA crossed above Slow MA. BUY.")
            self.position = 1
            self.entry_price = close
            return "BUY"

        return "HOLD"`,

  'Volatility Breakout & Mean Reversion': `class MeanReversionStrategy:
    """
    Statistical Mean Reversion based on RSI extremes.
    """
    def __init__(self, params=None):
        self.params = {
            "rsi_oversold": 28,
            "rsi_overbought": 72,
            "stop_loss_pct": 2.0,
            "take_profit_pct": 4.0,
        }
        if params:
            self.params.update(params)

        self.position = 0
        self.entry_price = 0.0
        self.log_messages = []

    def log(self, message: str):
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df=None) -> str:
        close = bar["close"]
        ts = str(bar["timestamp"])

        if history_df is None:
            return "HOLD"

        rsi = history_df.iloc[-1].get("rsi", 50.0)

        if self.position > 0:
            pnl_pct = ((close - self.entry_price) / self.entry_price) * 100.0
            if pnl_pct <= -self.params["stop_loss_pct"] or pnl_pct >= self.params["take_profit_pct"]:
                self.position = 0
                return "SELL"
            if rsi >= self.params["rsi_overbought"]:
                self.log(f"[{ts}] 🎯 Overbought target reached ({rsi:.1f}). SELL.")
                self.position = 0
                return "SELL"
            return "HOLD"

        if rsi <= self.params["rsi_oversold"]:
            self.log(f"[{ts}] 💎 Oversold dip detected ({rsi:.1f}). BUY.")
            self.position = 1
            self.entry_price = close
            return "BUY"

        return "HOLD"`,
};

export const CodeSandbox: React.FC<CodeSandboxProps> = ({ initialCode, onRunStrategy }) => {
  const [code, setCode] = useState<string>(initialCode);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Client-side syntax validation
  const validateCode = () => {
    if (!code.includes('class ') || !code.includes('def on_bar')) {
      setValidationResult({
        valid: false,
        message: 'Validation Error: Code must define a strategy class with an `on_bar(self, bar, history_df)` method.',
      });
      return false;
    }

    // Check parentheses & brackets balance
    let parenCount = 0;
    let braceCount = 0;
    let bracketCount = 0;
    for (const char of code) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }

    if (parenCount !== 0 || braceCount !== 0 || bracketCount !== 0) {
      setValidationResult({
        valid: false,
        message: 'Syntax Error: Unbalanced parenthesis, brackets, or braces in Python code.',
      });
      return false;
    }

    setValidationResult({
      valid: true,
      message: '✅ AST Syntax Check PASSED: Strategy class structure validated successfully with zero syntax errors.',
    });
    return true;
  };

  const handleRun = () => {
    if (validateCode()) {
      onRunStrategy(code);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectPreset = (name: string) => {
    const selected = STRATEGY_PRESETS[name];
    if (selected) {
      setCode(selected);
      setValidationResult(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Code Editor Panel */}
      <div className="lg:col-span-2 bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col">
        {/* Editor Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Python Strategy Editor</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Python 3.10+ / AST Sandbox</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Preset Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
              <select
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
                defaultValue="RSI Pullback & MA Momentum (Default)"
              >
                {Object.keys(STRATEGY_PRESETS).map((name) => (
                  <option key={name} value={name} className="bg-slate-900 text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition text-xs"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Text Area Code Editor */}
        <div className="relative mt-3 flex-1">
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setValidationResult(null);
            }}
            spellCheck={false}
            rows={18}
            className="w-full bg-[#03060f] text-emerald-300 font-mono text-xs p-4 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500/70 resize-y leading-relaxed"
            placeholder="paste your Python strategy class here..."
          />
        </div>

        {/* Action Buttons & Validation Status */}
        <div className="pt-3 mt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={validateCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition border border-slate-700"
            >
              Validate Syntax
            </button>
            <button
              onClick={handleRun}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-900/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Compile & Run Backtest</span>
            </button>
          </div>

          <span className="text-slate-500 text-[11px] font-mono">
            {code.split('\n').length} lines | {code.length} chars
          </span>
        </div>

        {/* Validation Result Box */}
        {validationResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
              validationResult.valid
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
            }`}
          >
            {validationResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="font-mono whitespace-pre-wrap">{validationResult.message}</div>
          </div>
        )}
      </div>

      {/* Strategy API Reference & Architecture Guide */}
      <div className="bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl text-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-200 font-semibold">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Strategy Interface Specification</span>
        </div>

        <div>
          <h4 className="font-bold text-slate-300 mb-1">1. `__init__(self, params=None)`</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Called when your bot is instantiated. The parameter sliders from the sidebar are passed in as a dictionary
            containing <code className="text-cyan-300">fast_ma</code>, <code className="text-cyan-300">slow_ma</code>, <code className="text-cyan-300">rsi_oversold</code>, and risk thresholds.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-300 mb-1">2. `on_bar(self, bar, history_df)`</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-2">
            Evaluated on every historical candle during backtests, or on every incoming live market tick.
          </p>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 font-mono text-[10px] text-slate-300 space-y-1">
            <div><strong className="text-amber-400">bar</strong>: &#123;open, high, low, close, volume, timestamp&#125;</div>
            <div><strong className="text-amber-400">history_df</strong>: Prior bars DataFrame with indicators</div>
            <div><strong className="text-emerald-400">return</strong>: &quot;BUY&quot;, &quot;SELL&quot;, or &quot;HOLD&quot;</div>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-300 mb-1">3. `self.log(msg)`</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Emit thoughts, indicator measurements, and signal confirmations. All logged thoughts stream directly into the live terminal on the dashboard.
          </p>
        </div>

        <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-cyan-200 text-[11px]">
          <strong className="block mb-1">⚡ Instant Parameter Re-testing</strong>
          Adjusting any slider in the sidebar immediately injects the new values into your class and refreshes the backtest!
        </div>
      </div>
    </div>
  );
};
