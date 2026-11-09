import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, Terminal, ExternalLink, ShieldCheck } from 'lucide-react';

interface FileItem {
  name: string;
  desc: string;
  language: string;
  content: string;
}

const PROJECT_FILES: FileItem[] = [
  {
    name: 'app.py',
    desc: 'The main Streamlit quant trading dashboard with Plotly charts, Alpaca/Yahoo feeds, and live bot tracker',
    language: 'python',
    content: `"""
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
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

# (See full codebase in repository root: /app.py)
`,
  },
  {
    name: 'strategy_template.py',
    desc: 'Working example strategy class implementing on_bar(self, bar, history_df)',
    language: 'python',
    content: `"""
Quantitative Trading Strategy Template
Compatible with AlphaForge Streamlit Trading Engine.

Define your trading bot class with __init__ and on_bar(self, bar).
You can return "BUY", "SELL", or "HOLD", or emit signals via self.log().
"""

import numpy as np
import pandas as pd


class MyStrategy:
    def __init__(self, params=None):
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

        self.position = 0
        self.entry_price = 0.0
        self.entry_time = None
        self.bars_processed = 0
        self.log_messages = []

    def log(self, message: str):
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df: pd.DataFrame = None) -> str:
        self.bars_processed += 1
        close = bar["close"]
        ts_str = bar["timestamp"].strftime("%H:%M:%S") if hasattr(bar["timestamp"], "strftime") else str(bar["timestamp"])

        if history_df is not None and len(history_df) >= self.params["slow_ma"]:
            current_row = history_df.iloc[-1]
            fast_ma = current_row.get("fast_ma", close)
            slow_ma = current_row.get("slow_ma", close)
            rsi = current_row.get("rsi", 50.0)
        else:
            return "HOLD"

        if self.position > 0:
            pnl_pct = ((close - self.entry_price) / self.entry_price) * 100.0
            if pnl_pct <= -abs(self.params["stop_loss_pct"]):
                self.log(f"[{ts_str}] 🛑 STOP-LOSS TRIGGERED: PnL {pnl_pct:.2f}%. SELL.")
                self.position = 0
                return "SELL"
            if pnl_pct >= self.params["take_profit_pct"]:
                self.log(f"[{ts_str}] 🎯 TAKE-PROFIT HIT: PnL +{pnl_pct:.2f}%. SELL.")
                self.position = 0
                return "SELL"
            if rsi >= self.params["rsi_overbought"] and close < fast_ma:
                self.log(f"[{ts_str}] 📉 EXIT: RSI={rsi:.1f} Overbought & breakdown. SELL.")
                self.position = 0
                return "SELL"
            return "HOLD"

        trend_bullish = fast_ma > slow_ma
        rsi_oversold = rsi <= self.params["rsi_oversold"]
        if trend_bullish and rsi_oversold:
            self.log(f"[{ts_str}] 🚀 BUY SIGNAL: Bullish MA + Oversold RSI={rsi:.1f}. BUY @ \${close:.2f}")
            self.position = 1
            self.entry_price = close
            self.entry_time = bar["timestamp"]
            return "BUY"

        return "HOLD"
`,
  },
  {
    name: 'requirements.txt',
    desc: 'Python package dependencies required for local execution',
    language: 'text',
    content: `streamlit>=1.35.0
plotly>=5.22.0
alpaca-py>=0.20.0
yfinance>=0.2.40
pandas>=2.2.0
numpy>=1.26.0
python-dotenv>=1.0.0
requests>=2.31.0
`,
  },
  {
    name: 'README.md',
    desc: 'Step-by-step instructions for installation and local execution',
    language: 'markdown',
    content: `# AlphaForge: Quantitative Trading Research & Paper Trading Terminal

AlphaForge is a Python-powered alternative to TradingView built with **Streamlit** and **Plotly**.

## 📦 Quickstart Setup & Run

\`\`\`bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Launch the Streamlit dashboard
streamlit run app.py
\`\`\`

The app will open automatically at \`http://localhost:8501\`.

## 🔐 Alpaca API Keys (Optional)
Provide keys in the sidebar password inputs or via environment variables:
\`\`\`bash
export ALPACA_API_KEY="your_key"
export ALPACA_SECRET_KEY="your_secret"
streamlit run app.py
\`\`\`
`,
  },
];

export const ProjectExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileItem>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Quick Setup Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 rounded-xl border border-emerald-900/40 p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs border border-emerald-500/30">
                Ready for Local Execution
              </span>
              <span className="text-slate-400 text-xs">Complete 4-File Project Generated</span>
            </div>
            <h3 className="text-lg font-bold text-white">Run AlphaForge Locally on Your Machine</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">
              All 4 required files (<code className="text-emerald-300 font-mono">app.py</code>, <code className="text-emerald-300 font-mono">requirements.txt</code>, <code className="text-emerald-300 font-mono">strategy_template.py</code>, and <code className="text-emerald-300 font-mono">README.md</code>) are fully generated and saved in the project root.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 flex flex-col gap-1.5">
            <div className="text-[10px] text-slate-500 uppercase font-sans font-bold">Terminal Commands:</div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>pip install -r requirements.txt</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>streamlit run app.py</span>
            </div>
          </div>
        </div>
      </div>

      {/* File Viewer Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* File List */}
        <div className="md:col-span-1 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Project Files
          </div>
          {PROJECT_FILES.map((file) => {
            const isSelected = selectedFile.name === file.name;
            return (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/50 text-white shadow-lg'
                    : 'bg-[#060913] border-slate-800/80 text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold">
                    <FileCode className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{file.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-sans text-slate-500">{file.language}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">{file.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Code Content Viewer */}
        <div className="md:col-span-3 bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
            <div>
              <span className="font-mono font-bold text-slate-200 text-sm">{selectedFile.name}</span>
              <p className="text-slate-400 text-[11px] mt-0.5">{selectedFile.desc}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 transition text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Content'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-950"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {selectedFile.name}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex-1">
            <pre className="bg-[#03060f] p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-text">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
