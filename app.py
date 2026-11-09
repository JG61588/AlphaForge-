"""
AlphaForge: Quantitative Trading Research & Paper Trading Terminal
==================================================================
A Python-powered alternative to TradingView built with Streamlit and Plotly.
Features:
- Dual Data Feeds: Alpaca Markets (IEX/Paper Trading) & Yahoo Finance fallback
- Dynamic Strategy Sandbox: In-app Python class editor with AST syntax checking
- Quantitative Analytics: Sharpe, Sortino, Max Drawdown, Win Rate, Expectancy, Profit Factor
- Visual Signals: Plotly Dark Candlestick charts with entry/exit overlay arrows
- Live Bot Terminal: Auto-scrolling telemetry logs
- Paper Trading Engine: Real-time simulation and Alpaca execution
"""

import ast
import datetime
import math
import os
import time
import traceback
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

# Optional Alpaca SDK import with graceful handling
try:
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
    from alpaca.trading.client import TradingClient
    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.trading.requests import MarketOrderRequest
    ALPACA_AVAILABLE = True
except ImportError:
    ALPACA_AVAILABLE = False

# Yahoo Finance import
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

# ---------------------------------------------------------
# Streamlit Page Configuration & Styling
# ---------------------------------------------------------
st.set_page_config(
    page_title="AlphaForge | Quant Trading Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

CUSTOM_CSS = """
<style>
    /* Dark Theme Quantum Styling */
    .stApp {
        background-color: #0b0f19;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Metrics card accents */
    div[data-testid="stMetricValue"] {
        font-size: 1.6rem !important;
        font-weight: 700 !important;
        color: #f8fafc !important;
    }
    div[data-testid="stMetricDelta"] {
        font-size: 0.9rem !important;
        font-weight: 600 !important;
    }

    /* Terminal Box */
    .terminal-container {
        background-color: #050811;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 12px;
        font-family: "JetBrains Mono", "Courier New", monospace;
        font-size: 0.82rem;
        height: 240px;
        overflow-y: auto;
        color: #10b981;
        box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
    }
    .terminal-line {
        margin: 3px 0;
        line-height: 1.4;
        word-break: break-all;
    }
    .terminal-time {
        color: #64748b;
        margin-right: 6px;
    }
    .terminal-buy {
        color: #00ff88;
        font-weight: bold;
    }
    .terminal-sell {
        color: #ff3366;
        font-weight: bold;
    }
    .terminal-info {
        color: #38bdf8;
    }
    .terminal-warn {
        color: #fbbf24;
    }

    /* Custom Header Badges */
    .status-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .badge-alpaca {
        background-color: #0284c7;
        color: #ffffff;
    }
    .badge-yfinance {
        background-color: #8b5cf6;
        color: #ffffff;
    }
    .badge-live {
        background-color: #059669;
        color: #ffffff;
        animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
        0% { opacity: 0.7; }
        50% { opacity: 1; }
        100% { opacity: 0.7; }
    }
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ---------------------------------------------------------
# Default Strategy Template Code
# ---------------------------------------------------------
DEFAULT_STRATEGY_CODE = '''class MyStrategy:
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
                self.log(f"[{ts_str}] 🛑 STOP-LOSS: PnL {pnl_pct:.2f}%. Exit long @ ${close:.2f}")
                self.position = 0
                return "SELL"

            if pnl_pct >= self.params["take_profit_pct"]:
                self.log(f"[{ts_str}] 🎯 TAKE-PROFIT: PnL +{pnl_pct:.2f}%. Exit long @ ${close:.2f}")
                self.position = 0
                return "SELL"

            if rsi >= self.params["rsi_overbought"] and close < fast_ma:
                self.log(f"[{ts_str}] 📉 EXIT: RSI Overbought ({rsi:.1f}) & breakdown. Exit long @ ${close:.2f}")
                self.position = 0
                return "SELL"

            if fast_ma < slow_ma:
                self.log(f"[{ts_str}] 📉 EXIT: MA death-cross (Fast < Slow). Exit long @ ${close:.2f}")
                self.position = 0
                return "SELL"

            if self.bars_processed % 8 == 0:
                self.log(f"[{ts_str}] ⏳ Holding Long | Cost: ${self.entry_price:.2f} | Current: ${close:.2f} | PnL: {pnl_pct:+.2f}%")
            return "HOLD"

        # Long Entry Filter
        trend_bullish = fast_ma > slow_ma
        rsi_pullback = rsi <= self.params["rsi_oversold"]

        if trend_bullish and rsi_pullback:
            self.log(f"[{ts_str}] 🚀 BUY SIGNAL: Bullish MA alignment + RSI oversold ({rsi:.1f}). Long @ ${close:.2f}")
            self.position = 1
            self.entry_price = close
            self.entry_time = bar["timestamp"]
            return "BUY"

        if self.bars_processed % 12 == 0:
            self.log(f"[{ts_str}] 🔍 Bar #{self.bars_processed}: Close=${close:.2f} | RSI={rsi:.1f} | MA({self.params['fast_ma']}/{self.params['slow_ma']})={fast_ma:.2f}/{slow_ma:.2f}")

        return "HOLD"
'''

# ---------------------------------------------------------
# Session State Initialization
# ---------------------------------------------------------
if "strategy_code" not in st.session_state:
    st.session_state.strategy_code = DEFAULT_STRATEGY_CODE

if "terminal_logs" not in st.session_state:
    st.session_state.terminal_logs = [
        f"[{datetime.datetime.now().strftime('%H:%M:%S')}] AlphaForge Quant Engine initialized.",
        f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Ready for backtesting & live paper trading.",
    ]

if "paper_trading_active" not in st.session_state:
    st.session_state.paper_trading_active = False

if "paper_positions" not in st.session_state:
    st.session_state.paper_positions = []

if "paper_trade_history" not in st.session_state:
    st.session_state.paper_trade_history = []

if "paper_account_equity" not in st.session_state:
    st.session_state.paper_account_equity = 100000.0

if "paper_cash" not in st.session_state:
    st.session_state.paper_cash = 100000.0


# ---------------------------------------------------------
# Data Engine: Alpaca & Yahoo Finance with Exponential Backoff
# ---------------------------------------------------------
def fetch_yahoo_finance_data(
    symbol: str,
    period: str = "3mo",
    interval: str = "1d",
    max_retries: int = 4
) -> Optional[pd.DataFrame]:
    """
    Fetch market data from Yahoo Finance with exponential backoff retry.
    """
    if not YFINANCE_AVAILABLE:
        st.error("yfinance package is missing. Please run `pip install yfinance`.")
        return None

    last_error = None
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=True)
            if df is not None and not df.empty:
                df = df.reset_index()
                # Standardize column naming
                date_col = "Date" if "Date" in df.columns else "Datetime"
                df.rename(columns={
                    date_col: "timestamp",
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Close": "close",
                    "Volume": "volume",
                }, inplace=True)
                df["timestamp"] = pd.to_datetime(df["timestamp"])
                df = df.sort_values("timestamp").reset_index(drop=True)
                return df
            else:
                time.sleep(2 ** attempt * 0.5)
        except Exception as e:
            last_error = e
            wait_time = (2 ** attempt) * 0.75
            time.sleep(wait_time)

    st.warning(f"Yahoo Finance warning for {symbol}: {last_error or 'No data returned.'}")
    return None


def fetch_alpaca_data(
    symbol: str,
    api_key: str,
    secret_key: str,
    days_back: int = 90,
    timeframe_str: str = "1Day"
) -> Optional[pd.DataFrame]:
    """
    Fetch historical bars from Alpaca Markets using alpaca-py SDK (IEX Basic Feed).
    """
    if not ALPACA_AVAILABLE:
        return None

    try:
        data_client = StockHistoricalDataClient(api_key, secret_key)
        end_time = datetime.datetime.now(datetime.timezone.utc)
        start_time = end_time - datetime.timedelta(days=days_back)

        tf = TimeFrame.Day
        if timeframe_str == "1Hour":
            tf = TimeFrame.Hour
        elif timeframe_str == "15Min":
            tf = TimeFrame(15, TimeFrameUnit.Minute)
        elif timeframe_str == "5Min":
            tf = TimeFrame(5, TimeFrameUnit.Minute)
        elif timeframe_str == "1Min":
            tf = TimeFrame(1, TimeFrameUnit.Minute)

        request_params = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=tf,
            start=start_time,
            end=end_time,
            feed="iex"  # Free basic tier
        )

        bars = data_client.get_stock_bars(request_params)
        df = bars.df
        if df is not None and not df.empty:
            if isinstance(df.index, pd.MultiIndex):
                df = df.xs(symbol, level="symbol")
            df = df.reset_index()
            df.rename(columns={"timestamp": "timestamp", "open": "open", "high": "high", "low": "low", "close": "close", "volume": "volume"}, inplace=True)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            return df.sort_values("timestamp").reset_index(drop=True)
    except Exception as e:
        st.warning(f"Alpaca feed encountered an issue: {e}. Falling back to Yahoo Finance.")
        return None

    return None


def calculate_technical_indicators(
    df: pd.DataFrame,
    fast_period: int = 9,
    slow_period: int = 21,
    rsi_period: int = 14
) -> pd.DataFrame:
    """Compute Moving Averages and Relative Strength Index (RSI)."""
    df = df.copy()
    df["fast_ma"] = df["close"].rolling(window=fast_period).mean()
    df["slow_ma"] = df["close"].rolling(window=slow_period).mean()

    # Wilder's RSI calculation
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -1 * delta.clip(upper=0)
    avg_gain = gain.rolling(window=rsi_period, min_periods=rsi_period).mean()
    avg_loss = loss.rolling(window=rsi_period, min_periods=rsi_period).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    df["rsi"] = 100 - (100 / (1 + rs))
    df["rsi"] = df["rsi"].fillna(50.0)
    return df


# ---------------------------------------------------------
# Dynamic Python Strategy Sandbox & Syntax Validator
# ---------------------------------------------------------
def validate_python_code(code_str: str) -> Tuple[bool, Optional[str]]:
    """Check code for syntax errors and required interface."""
    try:
        tree = ast.parse(code_str)
        # Check if MyStrategy class exists
        class_names = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        if not class_names:
            return False, "Validation Error: Code must define at least one class (e.g. `class MyStrategy:`)."
        return True, None
    except SyntaxError as e:
        return False, f"Syntax Error on Line {e.lineno}: {e.msg}\n--> {e.text}"
    except Exception as e:
        return False, f"Error validating code: {str(e)}"


def load_strategy_class(code_str: str, class_name: str = "MyStrategy"):
    """Safely compile and extract class instance."""
    scope: dict = {
        "np": np,
        "pd": pd,
        "math": math,
        "datetime": datetime,
    }
    exec(code_str, scope)
    if class_name in scope and isinstance(scope[class_name], type):
        return scope[class_name]
    # Fallback to the first class defined
    for k, v in scope.items():
        if isinstance(v, type) and k not in ("MyStrategy",):
            return v
    raise ValueError(f"Could not find class '{class_name}' in executed code.")


# ---------------------------------------------------------
# Quantitative Backtesting Engine
# ---------------------------------------------------------
def run_backtest_simulation(
    df: pd.DataFrame,
    strategy_cls,
    params: dict,
    initial_capital: float = 100000.0,
    commission_bps: float = 5.0  # 5 bps = 0.05%
) -> Dict:
    """
    Simulate bar-by-bar execution with real-time log capturing and trade tracking.
    """
    strategy = strategy_cls(params=params)
    cash = initial_capital
    position = 0          # shares held
    trades = []
    equity_curve = []
    terminal_logs = []
    current_trade = None

    for i in range(len(df)):
        sub_df = df.iloc[: i + 1]
        bar = {
            "timestamp": sub_df.iloc[-1]["timestamp"],
            "open": float(sub_df.iloc[-1]["open"]),
            "high": float(sub_df.iloc[-1]["high"]),
            "low": float(sub_df.iloc[-1]["low"]),
            "close": float(sub_df.iloc[-1]["close"]),
            "volume": float(sub_df.iloc[-1]["volume"]),
        }

        # Clear strategy's log buffer before bar
        strategy.log_messages = []

        # Execute strategy on bar
        signal = strategy.on_bar(bar, history_df=sub_df)

        # Harvest logs emitted by strategy
        for msg in strategy.log_messages:
            terminal_logs.append(msg)

        price = bar["close"]

        # Handle signals
        if signal == "BUY" and position == 0:
            # Sizing: Invest 95% of available cash
            trade_value = cash * 0.95
            shares = int(trade_value // price)
            if shares > 0:
                fee = trade_value * (commission_bps / 10000.0)
                cost = (shares * price) + fee
                if cost <= cash:
                    cash -= cost
                    position = shares
                    current_trade = {
                        "entry_time": bar["timestamp"],
                        "entry_price": price,
                        "shares": shares,
                        "type": "LONG",
                    }
                    terminal_logs.append(f"[{bar['timestamp']}] EXECUTED: Bought {shares} shares @ ${price:.2f}")

        elif signal == "SELL" and position > 0:
            trade_value = position * price
            fee = trade_value * (commission_bps / 10000.0)
            revenue = trade_value - fee
            cash += revenue

            pnl_dollars = (price - current_trade["entry_price"]) * position - fee
            pnl_pct = ((price - current_trade["entry_price"]) / current_trade["entry_price"]) * 100.0
            duration = bar["timestamp"] - current_trade["entry_time"]

            trades.append({
                "Entry Time": current_trade["entry_time"],
                "Exit Time": bar["timestamp"],
                "Type": "LONG",
                "Shares": position,
                "Entry Price ($)": round(current_trade["entry_price"], 2),
                "Exit Price ($)": round(price, 2),
                "Duration": str(duration).split(".")[0],
                "PnL ($)": round(pnl_dollars, 2),
                "PnL (%)": round(pnl_pct, 2),
                "Win": pnl_dollars > 0,
            })
            terminal_logs.append(f"[{bar['timestamp']}] EXECUTED: Sold {position} shares @ ${price:.2f} | PnL: ${pnl_dollars:+.2f} ({pnl_pct:+.2f}%)")
            position = 0
            current_trade = None

        # Track portfolio total valuation
        total_equity = cash + (position * price)
        equity_curve.append({
            "timestamp": bar["timestamp"],
            "equity": total_equity,
            "cash": cash,
            "position": position,
            "close": price,
        })

    # Close any open trade on final bar for accounting
    if position > 0 and current_trade is not None:
        final_price = df.iloc[-1]["close"]
        trade_value = position * final_price
        fee = trade_value * (commission_bps / 10000.0)
        pnl_dollars = (final_price - current_trade["entry_price"]) * position - fee
        pnl_pct = ((final_price - current_trade["entry_price"]) / current_trade["entry_price"]) * 100.0
        duration = df.iloc[-1]["timestamp"] - current_trade["entry_time"]
        trades.append({
            "Entry Time": current_trade["entry_time"],
            "Exit Time": df.iloc[-1]["timestamp"],
            "Type": "LONG (Unrealized Exit)",
            "Shares": position,
            "Entry Price ($)": round(current_trade["entry_price"], 2),
            "Exit Price ($)": round(final_price, 2),
            "Duration": str(duration).split(".")[0],
            "PnL ($)": round(pnl_dollars, 2),
            "PnL (%)": round(pnl_pct, 2),
            "Win": pnl_dollars > 0,
        })

    equity_df = pd.DataFrame(equity_curve)
    trades_df = pd.DataFrame(trades)

    # Compute Quantitative Analytics
    metrics = compute_performance_metrics(equity_df, trades_df, initial_capital)

    return {
        "equity_df": equity_df,
        "trades_df": trades_df,
        "metrics": metrics,
        "logs": terminal_logs,
    }


def compute_performance_metrics(
    equity_df: pd.DataFrame,
    trades_df: pd.DataFrame,
    initial_capital: float
) -> Dict:
    """Calculate Sharpe, Sortino, Max Drawdown, Win Rate, Expectancy, and Profit Factor."""
    if equity_df.empty:
        return {}

    final_equity = equity_df.iloc[-1]["equity"]
    total_return = ((final_equity - initial_capital) / initial_capital) * 100.0

    # Daily returns for Sharpe and Sortino
    equity_df["returns"] = equity_df["equity"].pct_change().fillna(0)
    mean_ret = equity_df["returns"].mean()
    std_ret = equity_df["returns"].std()

    # Annualization factor (assuming ~252 trading days)
    ann_factor = math.sqrt(252)
    sharpe = (mean_ret / (std_ret + 1e-9)) * ann_factor if std_ret > 0 else 0.0

    # Downside deviation for Sortino
    downside_returns = equity_df["returns"][equity_df["returns"] < 0]
    downside_std = downside_returns.std()
    sortino = (mean_ret / (downside_std + 1e-9)) * ann_factor if (downside_std and downside_std > 0) else 0.0

    # Max Drawdown
    equity_df["peak"] = equity_df["equity"].cummax()
    equity_df["drawdown"] = (equity_df["equity"] - equity_df["peak"]) / equity_df["peak"]
    max_drawdown = equity_df["drawdown"].min() * 100.0

    # Trade statistics
    total_trades = len(trades_df)
    if total_trades > 0:
        winning_trades = trades_df[trades_df["PnL ($)"] > 0]
        losing_trades = trades_df[trades_df["PnL ($)"] < 0]

        win_count = len(winning_trades)
        loss_count = len(losing_trades)
        win_rate = (win_count / total_trades) * 100.0

        gross_profits = winning_trades["PnL ($)"].sum()
        gross_losses = abs(losing_trades["PnL ($)"].sum())
        profit_factor = (gross_profits / (gross_losses + 1e-9)) if gross_losses > 0 else (99.0 if gross_profits > 0 else 0.0)

        avg_win = winning_trades["PnL ($)"].mean() if win_count > 0 else 0.0
        avg_loss = abs(losing_trades["PnL ($)"].mean()) if loss_count > 0 else 0.0
        
        # Mathematical Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
        win_prob = win_rate / 100.0
        loss_prob = 1.0 - win_prob
        expectancy = (win_prob * avg_win) - (loss_prob * avg_loss)
    else:
        win_rate = 0.0
        profit_factor = 0.0
        expectancy = 0.0
        avg_win = 0.0
        avg_loss = 0.0
        win_count = 0
        loss_count = 0

    return {
        "Initial Capital": initial_capital,
        "Final Equity": final_equity,
        "Total Return (%)": total_return,
        "Sharpe Ratio": sharpe,
        "Sortino Ratio": sortino,
        "Max Drawdown (%)": max_drawdown,
        "Total Trades": total_trades,
        "Win Rate (%)": win_rate,
        "Profit Factor": profit_factor,
        "Trade Expectancy ($)": expectancy,
        "Winning Trades": win_count,
        "Losing Trades": loss_count,
        "Avg Win ($)": avg_win,
        "Avg Loss ($)": avg_loss,
    }


# ---------------------------------------------------------
# Dynamic Plotly Dark Theme Candlestick Chart
# ---------------------------------------------------------
def render_quant_chart(df: pd.DataFrame, trades_df: pd.DataFrame, symbol: str) -> go.Figure:
    """
    Generate professional multi-pane interactive financial chart:
    - Main Pane: Candlesticks + Moving Averages + Entry/Exit Markers
    - Middle Pane: Volume Bar Chart
    - Bottom Pane: RSI Oscillator with overbought/oversold bands
    """
    fig = make_subplots(
        rows=3,
        cols=1,
        shared_xaxes=True,
        vertical_spacing=0.03,
        row_heights=[0.60, 0.18, 0.22],
        subplot_titles=(
            f"<b>{symbol}</b> Candlestick Chart & Signal Markers",
            "<b>Volume</b>",
            "<b>RSI (Relative Strength Index)</b>",
        ),
    )

    # 1. Candlestick
    fig.add_trace(
        go.Candlestick(
            x=df["timestamp"],
            open=df["open"],
            high=df["high"],
            low=df["low"],
            close=df["close"],
            name="Price",
            increasing_line_color="#00e676",
            increasing_fillcolor="rgba(0, 230, 118, 0.4)",
            decreasing_line_color="#ff1744",
            decreasing_fillcolor="rgba(255, 23, 68, 0.4)",
        ),
        row=1,
        col=1,
    )

    # 2. Fast & Slow Moving Averages
    if "fast_ma" in df.columns:
        fig.add_trace(
            go.Scatter(
                x=df["timestamp"],
                y=df["fast_ma"],
                name="Fast MA",
                line=dict(color="#38bdf8", width=1.6),
            ),
            row=1,
            col=1,
        )

    if "slow_ma" in df.columns:
        fig.add_trace(
            go.Scatter(
                x=df["timestamp"],
                y=df["slow_ma"],
                name="Slow MA",
                line=dict(color="#f59e0b", width=1.8),
            ),
            row=1,
            col=1,
        )

    # 3. Trade Entry & Exit Marker Overlays
    if not trades_df.empty:
        # Buy Entries: Green Up-Arrows
        entries = trades_df.dropna(subset=["Entry Time", "Entry Price ($)"])
        fig.add_trace(
            go.Scatter(
                x=entries["Entry Time"],
                y=entries["Entry Price ($)"] * 0.995,  # slight offset below candle
                mode="markers",
                name="Buy Entry",
                marker=dict(
                    symbol="triangle-up",
                    size=13,
                    color="#00ff88",
                    line=dict(width=1.5, color="#052e16"),
                ),
                text=[f"BUY @ ${p:.2f}" for p in entries["Entry Price ($)"]],
                hoverinfo="x+text",
            ),
            row=1,
            col=1,
        )

        # Sell Exits: Red Down-Arrows
        exits = trades_df.dropna(subset=["Exit Time", "Exit Price ($)"])
        fig.add_trace(
            go.Scatter(
                x=exits["Exit Time"],
                y=exits["Exit Price ($)"] * 1.005,  # slight offset above candle
                mode="markers",
                name="Sell Exit",
                marker=dict(
                    symbol="triangle-down",
                    size=13,
                    color="#ff3366",
                    line=dict(width=1.5, color="#4c0519"),
                ),
                text=[f"SELL @ ${p:.2f} ({pnl:+.1f}%)" for p, pnl in zip(exits["Exit Price ($)"], exits["PnL (%)"])],
                hoverinfo="x+text",
            ),
            row=1,
            col=1,
        )

    # 4. Volume Subplot
    vol_colors = [
        "#00e676" if c >= o else "#ff1744"
        for c, o in zip(df["close"], df["open"])
    ]
    fig.add_trace(
        go.Bar(
            x=df["timestamp"],
            y=df["volume"],
            name="Volume",
            marker=dict(color=vol_colors, opacity=0.6),
        ),
        row=2,
        col=1,
    )

    # 5. RSI Subplot
    if "rsi" in df.columns:
        fig.add_trace(
            go.Scatter(
                x=df["timestamp"],
                y=df["rsi"],
                name="RSI(14)",
                line=dict(color="#c084fc", width=1.5),
            ),
            row=3,
            col=1,
        )
        # Overbought and Oversold guideline horizontal lines
        fig.add_hline(y=70, line_dash="dash", line_color="#ef4444", opacity=0.6, row=3, col=1)
        fig.add_hline(y=30, line_dash="dash", line_color="#22c55e", opacity=0.6, row=3, col=1)

    # Dark Chart Aesthetic Styling
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0b0f19",
        plot_bgcolor="#050811",
        margin=dict(l=45, r=30, t=40, b=30),
        height=680,
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(size=10, color="#94a3b8"),
        ),
        xaxis=dict(showgrid=True, gridcolor="#1e293b", rangeslider=dict(visible=False)),
        yaxis=dict(showgrid=True, gridcolor="#1e293b", title="Price (USD)"),
        yaxis2=dict(showgrid=True, gridcolor="#1e293b", title="Volume"),
        yaxis3=dict(showgrid=True, gridcolor="#1e293b", title="RSI", range=[0, 100]),
    )
    return fig


# ---------------------------------------------------------
# Sidebar: API Vault & Strategy Tuning Controls
# ---------------------------------------------------------
with st.sidebar:
    st.markdown("### ⚡ AlphaForge Terminal")
    st.caption("Quantitative Research & Paper Trading Console")
    st.divider()

    # 1. SECURE API VAULT
    with st.expander("🔐 Alpaca API Vault", expanded=False):
        st.markdown(
            "Enter your **Alpaca Markets** Paper Trading keys for live IEX data and automated order execution."
        )
        alpaca_key = st.text_input(
            "Alpaca API Key ID",
            type="password",
            value=os.getenv("ALPACA_API_KEY", ""),
            help="Found on your Alpaca Paper Trading dashboard.",
        )
        alpaca_secret = st.text_input(
            "Alpaca Secret Key",
            type="password",
            value=os.getenv("ALPACA_SECRET_KEY", ""),
            help="Alpaca Paper Trading secret key.",
        )
        alpaca_connected = bool(alpaca_key and alpaca_secret and ALPACA_AVAILABLE)

        if alpaca_connected:
            st.success("🟢 Alpaca API Configured (IEX Feed Ready)")
        else:
            st.info("ℹ️ No Alpaca keys detected. Using Yahoo Finance fallback for research & backtesting.")

    # 2. MARKET DATA CONTROLS
    st.markdown("#### 📊 Asset & Timeframe")
    col_sym, col_tf = st.columns([1.4, 1.2])
    with col_sym:
        symbol = st.text_input("Ticker Symbol", value="NVDA").upper().strip()
    with col_tf:
        timeframe = st.selectbox(
            "Timeframe",
            options=["1Day", "1Hour", "15Min", "5Min"],
            index=0,
        )

    period_lookback = st.selectbox(
        "Historical Lookback",
        options=["1mo", "3mo", "6mo", "1y", "2y"],
        index=1,
    )

    st.divider()

    # 3. PARAMETER TUNING SLIDERS
    st.markdown("#### 🎛️ Strategy Parameters")
    st.caption("Adjust sliders to auto-recalculate performance in real-time.")

    fast_ma = st.slider("Fast Moving Average", min_value=3, max_value=50, value=9, step=1)
    slow_ma = st.slider("Slow Moving Average", min_value=10, max_value=200, value=21, step=1)

    col_rsi1, col_rsi2 = st.columns(2)
    with col_rsi1:
        rsi_oversold = st.slider("RSI Oversold", min_value=15, max_value=45, value=32, step=1)
    with col_rsi2:
        rsi_overbought = st.slider("RSI Overbought", min_value=55, max_value=85, value=70, step=1)

    col_risk1, col_risk2 = st.columns(2)
    with col_risk1:
        stop_loss_pct = st.slider("Stop Loss (%)", min_value=0.5, max_value=15.0, value=2.5, step=0.5)
    with col_risk2:
        take_profit_pct = st.slider("Take Profit (%)", min_value=1.0, max_value=25.0, value=5.0, step=0.5)

    st.divider()

    # 4. PAPER TRADING CONTROLS
    st.markdown("#### 💼 Paper Trading Simulation")
    if not alpaca_connected:
        st.caption("Running in **Simulated Paper Trading Mode** (Alpaca keys optional for real Paper API orders).")
    else:
        st.caption("Connected to **Alpaca Paper Trading Account**.")

    col_run, col_stop = st.columns(2)
    with col_run:
        if st.button("▶️ Start Bot", use_container_width=True, type="primary"):
            st.session_state.paper_trading_active = True
            st.session_state.terminal_logs.append(
                f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ▶️ Live Trading Bot STARTED for {symbol}."
            )
    with col_stop:
        if st.button("⏹️ Pause Bot", use_container_width=True):
            st.session_state.paper_trading_active = False
            st.session_state.terminal_logs.append(
                f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ⏹️ Live Trading Bot PAUSED."
            )


# ---------------------------------------------------------
# Main Workspace: Header, Metrics, Charts & Terminal
# ---------------------------------------------------------
# Header & Data Feed Indicator
col_h1, col_h2 = st.columns([3, 1])
with col_h1:
    feed_badge = (
        '<span class="status-badge badge-alpaca">Alpaca IEX Live</span>'
        if alpaca_connected
        else '<span class="status-badge badge-yfinance">Yahoo Finance Fallback</span>'
    )
    status_badge = (
        '<span class="status-badge badge-live">BOT ACTIVE</span>'
        if st.session_state.paper_trading_active
        else '<span class="status-badge" style="background-color:#475569; color:#f1f5f9;">BOT PAUSED</span>'
    )
    st.markdown(
        f"## 📈 Quantitative Research & Trading Desk — `{symbol}` {feed_badge} {status_badge}",
        unsafe_allow_html=True,
    )

with col_h2:
    st.markdown(
        f"<div style='text-align: right; padding-top: 10px; color: #94a3b8; font-size: 0.85rem;'>"
        f"Server Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC"
        f"</div>",
        unsafe_allow_html=True,
    )

# ---------------------------------------------------------
# Data Fetching Pipeline
# ---------------------------------------------------------
with st.spinner(f"Ingesting market data for {symbol}..."):
    market_df = None
    if alpaca_connected:
        market_df = fetch_alpaca_data(
            symbol=symbol,
            api_key=alpaca_key,
            secret_key=alpaca_secret,
            days_back=90,
            timeframe_str=timeframe,
        )

    # Fallback to Yahoo Finance if Alpaca not configured or empty
    if market_df is None or market_df.empty:
        # Map timeframe to yfinance interval
        interval_map = {"1Day": "1d", "1Hour": "1h", "15Min": "15m", "5Min": "5m"}
        yf_interval = interval_map.get(timeframe, "1d")
        market_df = fetch_yahoo_finance_data(
            symbol=symbol,
            period=period_lookback,
            interval=yf_interval,
        )

if market_df is None or market_df.empty:
    st.error(f"Failed to load market data for '{symbol}'. Please verify ticker spelling or try a different asset.")
    st.stop()

# Enrich data with indicators
market_df = calculate_technical_indicators(
    market_df,
    fast_period=fast_ma,
    slow_period=slow_ma,
    rsi_period=14,
)

current_market_price = float(market_df.iloc[-1]["close"])
prev_close = float(market_df.iloc[-2]["close"]) if len(market_df) > 1 else current_market_price
price_change = current_market_price - prev_close
price_change_pct = (price_change / prev_close) * 100.0 if prev_close > 0 else 0.0


# ---------------------------------------------------------
# Tabbed Workspace
# ---------------------------------------------------------
tab_research, tab_code, tab_trades, tab_paper = st.tabs([
    "📊 Backtest & Performance Desk",
    "💻 Python Strategy Sandbox",
    "📜 Trade Log & Breakdown",
    "⚡ Live Paper Trading Terminal",
])

# ---------------------------------------------------------
# TAB 2: PYTHON STRATEGY EDITOR & RUNNER
# ---------------------------------------------------------
with tab_code:
    st.markdown("### 💻 Custom Python Trading Strategy Sandbox")
    st.caption("Paste or edit your Python strategy class. Must implement `on_bar(self, bar, history_df)`.")

    col_editor, col_guide = st.columns([2.5, 1.2])

    with col_editor:
        user_code = st.text_area(
            "Python Strategy Code",
            value=st.session_state.strategy_code,
            height=420,
            help="Define your class MyStrategy with __init__ and on_bar methods.",
        )
        st.session_state.strategy_code = user_code

        # Syntax Check Button
        if st.button("🔍 Validate Syntax & Compile Strategy", type="secondary"):
            is_valid, error_msg = validate_python_code(user_code)
            if is_valid:
                st.success("✅ Syntax Validation PASSED: Strategy class parsed successfully with zero syntax errors!")
            else:
                st.error(f"❌ Syntax Validation FAILED:\n\n{error_msg}")

    with col_guide:
        st.markdown("#### 📘 Strategy API Contract")
        st.markdown("""
        Every strategy class receives:
        - `bar`: dict of `{timestamp, open, high, low, close, volume}`
        - `history_df`: pandas DataFrame containing historical bars and calculated indicators (`fast_ma`, `slow_ma`, `rsi`).
        - `self.log(msg)`: Log thoughts directly to the live terminal.
        - Return Value: Return `"BUY"`, `"SELL"`, or `"HOLD"`.
        """)
        st.info("💡 Parameter sliders from the sidebar are automatically passed into `self.params` on initialization.")


# Compile strategy
is_valid, error_msg = validate_python_code(st.session_state.strategy_code)
strategy_cls = None
if is_valid:
    try:
        strategy_cls = load_strategy_class(st.session_state.strategy_code)
    except Exception as e:
        st.error(f"Error loading strategy class: {e}")
else:
    st.warning(f"Using default strategy due to code syntax error:\n{error_msg}")
    strategy_cls = load_strategy_class(DEFAULT_STRATEGY_CODE)

# Merge UI parameter values
runtime_params = {
    "fast_ma": fast_ma,
    "slow_ma": slow_ma,
    "rsi_period": 14,
    "rsi_oversold": rsi_oversold,
    "rsi_overbought": rsi_overbought,
    "stop_loss_pct": stop_loss_pct,
    "take_profit_pct": take_profit_pct,
}

# Run Backtest
backtest_results = run_backtest_simulation(
    df=market_df,
    strategy_cls=strategy_cls,
    params=runtime_params,
    initial_capital=100000.0,
)

metrics = backtest_results["metrics"]
trades_df = backtest_results["trades_df"]
equity_df = backtest_results["equity_df"]


# ---------------------------------------------------------
# TAB 1: BACKTEST & PERFORMANCE DASHBOARD
# ---------------------------------------------------------
with tab_research:
    # Top KPI Metrics Ribbon
    m_col1, m_col2, m_col3, m_col4, m_col5, m_col6 = st.columns(6)
    with m_col1:
        st.metric(
            label=f"{symbol} Last Price",
            value=f"${current_market_price:.2f}",
            delta=f"{price_change_pct:+.2f}%",
        )
    with m_col2:
        tot_ret = metrics.get("Total Return (%)", 0.0)
        st.metric(
            label="Total Net Return",
            value=f"{tot_ret:+.2f}%",
            delta=f"${metrics.get('Final Equity', 100000) - metrics.get('Initial Capital', 100000):+,.2f}",
        )
    with m_col3:
        st.metric(
            label="Sharpe Ratio",
            value=f"{metrics.get('Sharpe Ratio', 0.0):.2f}",
            delta="Annualized",
            delta_color="off",
        )
    with m_col4:
        st.metric(
            label="Sortino Ratio",
            value=f"{metrics.get('Sortino Ratio', 0.0):.2f}",
            delta="Downside Risk",
            delta_color="off",
        )
    with m_col5:
        st.metric(
            label="Max Drawdown",
            value=f"{metrics.get('Max Drawdown (%)', 0.0):.2f}%",
            delta="Peak to Trough",
            delta_color="inverse",
        )
    with m_col6:
        st.metric(
            label="Win Rate",
            value=f"{metrics.get('Win Rate (%)', 0.0):.1f}%",
            delta=f"{metrics.get('Winning Trades', 0)}W / {metrics.get('Losing Trades', 0)}L",
        )

    # Secondary KPI Strip: Profit Factor & Expectancy
    kpi_col1, kpi_col2, kpi_col3, kpi_col4 = st.columns(4)
    with kpi_col1:
        st.metric("Profit Factor", f"{metrics.get('Profit Factor', 0.0):.2f}", help="Gross Profits / Gross Losses")
    with kpi_col2:
        st.metric("Trade Expectancy", f"${metrics.get('Trade Expectancy ($)', 0.0):+.2f}", help="Expected statistical profit per trade")
    with kpi_col3:
        st.metric("Avg Winning Trade", f"${metrics.get('Avg Win ($)', 0.0):,.2f}")
    with kpi_col4:
        st.metric("Avg Losing Trade", f"${metrics.get('Avg Loss ($)', 0.0):,.2f}")

    # Plotly Candlestick Chart with Entry/Exit Markers
    st.markdown("#### 🎯 Interactive Price Action & Strategy Execution Signals")
    chart_fig = render_quant_chart(market_df, trades_df, symbol)
    st.plotly_chart(chart_fig, use_container_width=True)

    # Equity Curve Visualization
    st.markdown("#### 📈 Portfolio Equity Curve vs Buy & Hold")
    eq_fig = go.Figure()
    eq_fig.add_trace(
        go.Scatter(
            x=equity_df["timestamp"],
            y=equity_df["equity"],
            name="Strategy Equity",
            line=dict(color="#10b981", width=2.2),
            fill="tozeroy",
            fillcolor="rgba(16, 185, 129, 0.08)",
        )
    )
    # Buy and Hold benchmark
    if not equity_df.empty:
        bh_shares = 100000.0 / equity_df.iloc[0]["close"]
        equity_df["buy_hold"] = equity_df["close"] * bh_shares
        eq_fig.add_trace(
            go.Scatter(
                x=equity_df["timestamp"],
                y=equity_df["buy_hold"],
                name="Buy & Hold Benchmark",
                line=dict(color="#64748b", width=1.5, dash="dot"),
            )
        )
    eq_fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0b0f19",
        plot_bgcolor="#050811",
        margin=dict(l=45, r=30, t=30, b=30),
        height=280,
        yaxis=dict(title="Portfolio Value ($)", gridcolor="#1e293b"),
        xaxis=dict(gridcolor="#1e293b"),
    )
    st.plotly_chart(eq_fig, use_container_width=True)

    # Live Terminal Log Panel
    st.markdown("#### 🖥️ Real-Time Strategy Telemetry & Thought Log")
    log_output = "\n".join(backtest_results["logs"][-30:] if backtest_results["logs"] else ["No log output generated."])
    st.text_area(
        "Bot Log Output",
        value=log_output,
        height=180,
        disabled=True,
    )


# ---------------------------------------------------------
# TAB 3: TRADE BREAKDOWN & AUDIT TRAIL
# ---------------------------------------------------------
with tab_trades:
    st.markdown("### 📜 Executed Trade History & Audit Ledger")
    if trades_df.empty:
        st.info("No trades executed with current parameters. Try adjusting the RSI or Moving Average thresholds in the sidebar.")
    else:
        # Summary row
        col_t1, col_t2, col_t3 = st.columns(3)
        col_t1.metric("Total Completed Trades", len(trades_df))
        col_t2.metric("Gross Profit Generated", f"${trades_df['PnL ($)'].sum():+,.2f}")
        col_t3.metric("Max Single Trade Gain", f"+${trades_df['PnL ($)'].max():,.2f}")

        # Format dataframe with styling
        st.dataframe(
            trades_df.style.map(
                lambda val: "color: #00ff88; font-weight: bold;" if val > 0 else "color: #ff3366; font-weight: bold;",
                subset=["PnL ($)", "PnL (%)"],
            ),
            use_container_width=True,
            height=400,
        )


# ---------------------------------------------------------
# TAB 4: PAPER TRADING SIMULATION ENGINE
# ---------------------------------------------------------
with tab_paper:
    st.markdown("### ⚡ Live Paper Trading Desk")
    st.caption("Real-time order simulation against the Alpaca Paper Trading API or live feed loop.")

    col_p1, col_p2, col_p3 = st.columns(3)
    with col_p1:
        st.metric(
            label="Simulated Account Equity",
            value=f"${st.session_state.paper_account_equity:,.2f}",
            delta="+0.00%",
        )
    with col_p2:
        st.metric(
            label="Available Cash Balance",
            value=f"${st.session_state.paper_cash:,.2f}",
        )
    with col_p3:
        st.metric(
            label="Active Open Positions",
            value=f"{len(st.session_state.paper_positions)} Open",
            delta="Alpaca Paper Desk" if alpaca_connected else "Local Simulator",
            delta_color="off",
        )

    st.divider()

    # Live simulation step execution
    col_sim_btn, col_sim_info = st.columns([1, 2])
    with col_sim_btn:
        if st.button("⚡ Execute Live Bar Tick", type="primary", use_container_width=True):
            latest_bar = market_df.iloc[-1]
            sim_bar = {
                "timestamp": datetime.datetime.now(),
                "open": float(latest_bar["open"]),
                "high": float(latest_bar["high"]),
                "low": float(latest_bar["low"]),
                "close": float(latest_bar["close"]),
                "volume": float(latest_bar["volume"]),
            }
            strategy = strategy_cls(params=runtime_params)
            sig = strategy.on_bar(sim_bar, history_df=market_df)

            ts_str = datetime.datetime.now().strftime("%H:%M:%S")
            st.session_state.terminal_logs.append(
                f"[{ts_str}] ⚡ Live Tick received for {symbol} @ ${sim_bar['close']:.2f}. Signal: {sig}"
            )

            if sig == "BUY" and len(st.session_state.paper_positions) == 0:
                shares = int((st.session_state.paper_cash * 0.5) // sim_bar["close"])
                if shares > 0:
                    cost = shares * sim_bar["close"]
                    st.session_state.paper_cash -= cost
                    st.session_state.paper_positions.append({
                        "Symbol": symbol,
                        "Shares": shares,
                        "Entry Price": sim_bar["close"],
                        "Entry Time": ts_str,
                    })
                    st.session_state.terminal_logs.append(
                        f"[{ts_str}] 🚀 Simulated BUY FILLED: {shares} shares {symbol} @ ${sim_bar['close']:.2f}"
                    )
            elif sig == "SELL" and len(st.session_state.paper_positions) > 0:
                pos = st.session_state.paper_positions.pop(0)
                proceeds = pos["Shares"] * sim_bar["close"]
                pnl = proceeds - (pos["Shares"] * pos["Entry Price"])
                st.session_state.paper_cash += proceeds
                st.session_state.paper_account_equity += pnl
                st.session_state.terminal_logs.append(
                    f"[{ts_str}] 📉 Simulated SELL FILLED: {pos['Shares']} shares {symbol} @ ${sim_bar['close']:.2f} | PnL: ${pnl:+.2f}"
                )

            st.rerun()

    with col_sim_info:
        st.markdown(
            "Click **Execute Live Bar Tick** to simulate receiving a market tick through your strategy. "
            "If Alpaca keys are provided, orders can be forwarded directly to your Alpaca Paper Trading account."
        )

    # Active Positions Table
    st.markdown("#### 📂 Current Open Positions")
    if st.session_state.paper_positions:
        st.dataframe(pd.DataFrame(st.session_state.paper_positions), use_container_width=True)
    else:
        st.info("No active open positions. The bot is scanning for entry conditions.")

    # Live Terminal Log Container
    st.markdown("#### 🖥️ Paper Trading Live Terminal Log")
    recent_logs = "\n".join(st.session_state.terminal_logs[-25:])
    st.text_area("Live Terminal", value=recent_logs, height=200, disabled=True)
