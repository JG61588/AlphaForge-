"""
Quantitative Trading Strategy Template
Compatible with AlphaForge Streamlit Trading Engine.

Define your trading bot class with `__init__` and `on_bar(self, bar)`.
You can return "BUY", "SELL", or "HOLD", or emit signals via self.log().
"""

import numpy as np
import pandas as pd


class MyStrategy:
    """
    Mean-Reverting Momentum & RSI Pullback Strategy.
    
    Logic:
    - Calculates Fast MA, Slow MA, and RSI(14).
    - Trend Filter: Bullish when Fast MA > Slow MA.
    - Buy Signal: In an uptrend, wait for an RSI pullback into oversold territory (e.g. RSI < 35).
    - Sell Signal: Fast MA crosses below Slow MA, or RSI enters overbought (> 70),
      or trailing stop-loss / take-profit threshold is hit.
    """

    def __init__(self, params=None):
        # Default parameter dictionary configurable from UI sliders
        self.params = {
            "fast_ma": 9,
            "slow_ma": 21,
            "rsi_period": 14,
            "rsi_oversold": 32,
            "rsi_overbought": 72,
            "stop_loss_pct": 2.5,
            "take_profit_pct": 5.0,
        }
        if params:
            self.params.update(params)

        self.position = 0          # 0: flat, 1: long
        self.entry_price = 0.0
        self.entry_time = None
        self.bars_processed = 0
        self.log_messages = []     # Live terminal thoughts

    def log(self, message: str):
        """Append a thought to the terminal log."""
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df: pd.DataFrame = None) -> str:
        """
        Called on every candle / market bar.
        
        :param bar: dict containing 'timestamp', 'open', 'high', 'low', 'close', 'volume'
        :param history_df: DataFrame of historical bars up to the current bar with calculated indicators
        :return: "BUY", "SELL", or "HOLD"
        """
        self.bars_processed += 1
        close = bar["close"]
        ts_str = bar["timestamp"].strftime("%H:%M:%S") if hasattr(bar["timestamp"], "strftime") else str(bar["timestamp"])

        # If history dataframe is provided with precomputed indicators, use them
        if history_df is not None and len(history_df) >= self.params["slow_ma"]:
            current_row = history_df.iloc[-1]
            fast_ma = current_row.get("fast_ma", close)
            slow_ma = current_row.get("slow_ma", close)
            rsi = current_row.get("rsi", 50.0)
        else:
            # Fallback or initialization
            return "HOLD"

        # Check existing open position for Risk Management
        if self.position > 0:
            pnl_pct = ((close - self.entry_price) / self.entry_price) * 100.0

            # Stop Loss Check
            if pnl_pct <= -abs(self.params["stop_loss_pct"]):
                self.log(f"[{ts_str}] 🛑 STOP-LOSS TRIGGERED: PnL {pnl_pct:.2f}% <= -{self.params['stop_loss_pct']}%. SELL.")
                self.position = 0
                return "SELL"

            # Take Profit Check
            if pnl_pct >= self.params["take_profit_pct"]:
                self.log(f"[{ts_str}] 🎯 TAKE-PROFIT HIT: PnL +{pnl_pct:.2f}% >= +{self.params['take_profit_pct']}%. SELL.")
                self.position = 0
                return "SELL"

            # Technical Exit Check: Overbought RSI or Trend breakdown
            if rsi >= self.params["rsi_overbought"] and close < fast_ma:
                self.log(f"[{ts_str}] 📉 EXIT SIGNAL: RSI={rsi:.1f} >= {self.params['rsi_overbought']} & Close < Fast MA. SELL.")
                self.position = 0
                return "SELL"

            if fast_ma < slow_ma:
                self.log(f"[{ts_str}] 📉 EXIT SIGNAL: Trend reversed (Fast MA {fast_ma:.2f} < Slow MA {slow_ma:.2f}). SELL.")
                self.position = 0
                return "SELL"

            # Hold position
            if self.bars_processed % 10 == 0:
                self.log(f"[{ts_str}] ⏳ Holding Long @ ${self.entry_price:.2f} | Current: ${close:.2f} | Unr. PnL: {pnl_pct:+.2f}%")
            return "HOLD"

        # Check for Entry (Long Signal)
        trend_bullish = fast_ma > slow_ma
        rsi_oversold = rsi <= self.params["rsi_oversold"]

        if trend_bullish and rsi_oversold:
            self.log(f"[{ts_str}] 🚀 BUY SIGNAL: Bullish Trend (Fast MA > Slow MA) + Oversold RSI={rsi:.1f} <= {self.params['rsi_oversold']}. BUY @ ${close:.2f}")
            self.position = 1
            self.entry_price = close
            self.entry_time = bar["timestamp"]
            return "BUY"

        # Periodic telemetry heartbeat
        if self.bars_processed % 15 == 0:
            self.log(f"[{ts_str}] 🔍 Scanning bar #{self.bars_processed}: Close=${close:.2f} | RSI={rsi:.1f} | Fast/Slow={fast_ma:.1f}/{slow_ma:.1f} [WAITING]")

        return "HOLD"
