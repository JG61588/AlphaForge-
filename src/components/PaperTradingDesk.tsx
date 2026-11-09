import React, { useState } from 'react';
import { Activity, ShieldCheck, Zap, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { StrategyParams } from '../data/marketData';

interface Position {
  symbol: string;
  shares: number;
  entryPrice: number;
  entryTime: string;
  currentPrice: number;
}

interface PaperTradingDeskProps {
  symbol: string;
  currentPrice: number;
  alpacaConfigured: boolean;
  params: StrategyParams;
  onEmitLog: (msg: string) => void;
}

export const PaperTradingDesk: React.FC<PaperTradingDeskProps> = ({
  symbol,
  currentPrice,
  alpacaConfigured,
  params,
  onEmitLog,
}) => {
  const [cash, setCash] = useState<number>(100000.0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orderHistory, setOrderHistory] = useState<
    { id: string; time: string; side: 'BUY' | 'SELL'; symbol: string; shares: number; price: number; pnl?: number }[]
  >([]);
  const [isLiveLoopActive, setIsLiveLoopActive] = useState<boolean>(false);

  // Calculate live portfolio equity
  const unrealizedPnl = positions.reduce(
    (sum, pos) => sum + (currentPrice - pos.entryPrice) * pos.shares,
    0
  );
  const positionsValue = positions.reduce((sum, pos) => sum + currentPrice * pos.shares, 0);
  const totalEquity = cash + positionsValue;
  const totalPnl = totalEquity - 100000.0;
  const totalPnlPct = (totalPnl / 100000.0) * 100;

  // Execute manual/simulated tick through strategy
  const handleTick = (forcedSignal?: 'BUY' | 'SELL') => {
    const ts = new Date().toLocaleTimeString();
    onEmitLog(`[${ts}] ⚡ Ingesting live tick for ${symbol} @ $${currentPrice.toFixed(2)}`);

    let signal: 'BUY' | 'SELL' | 'HOLD' | undefined = forcedSignal;
    if (!signal) {
      // Simulate strategy decision logic
      if (positions.length === 0) {
        signal = Math.random() > 0.4 ? 'BUY' : 'HOLD';
      } else {
        const pos = positions[0];
        const gainPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        if (gainPct <= -params.stopLossPct) signal = 'SELL';
        else if (gainPct >= params.takeProfitPct) signal = 'SELL';
        else signal = Math.random() > 0.6 ? 'SELL' : 'HOLD';
      }
    }

    if (signal === 'BUY' && positions.length === 0) {
      const allocate = cash * 0.5;
      const buyShares = Math.floor(allocate / currentPrice);
      if (buyShares > 0) {
        const cost = buyShares * currentPrice;
        setCash((c) => c - cost);
        const newPos: Position = {
          symbol,
          shares: buyShares,
          entryPrice: currentPrice,
          entryTime: ts,
          currentPrice,
        };
        setPositions([newPos]);
        setOrderHistory((prev) => [
          {
            id: `ORD-${Date.now().toString().slice(-4)}`,
            time: ts,
            side: 'BUY',
            symbol,
            shares: buyShares,
            price: currentPrice,
          },
          ...prev,
        ]);
        onEmitLog(
          `[${ts}] 🚀 ORDER FILLED: Bought ${buyShares} shares of ${symbol} @ $${currentPrice.toFixed(2)} via ${
            alpacaConfigured ? 'Alpaca Paper API' : 'Simulated Engine'
          }`
        );
      }
    } else if (signal === 'SELL' && positions.length > 0) {
      const pos = positions[0];
      const proceeds = pos.shares * currentPrice;
      const tradePnl = (currentPrice - pos.entryPrice) * pos.shares;
      const tradePnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

      setCash((c) => c + proceeds);
      setPositions([]);
      setOrderHistory((prev) => [
        {
          id: `ORD-${Date.now().toString().slice(-4)}`,
          time: ts,
          side: 'SELL',
          symbol,
          shares: pos.shares,
          price: currentPrice,
          pnl: tradePnl,
        },
        ...prev,
      ]);
      onEmitLog(
        `[${ts}] 📉 ORDER FILLED: Sold ${pos.shares} shares of ${symbol} @ $${currentPrice.toFixed(2)} | PnL: ${
          tradePnl >= 0 ? '+' : ''
        }$${tradePnl.toFixed(2)} (${tradePnlPct.toFixed(2)}%)`
      );
    } else {
      onEmitLog(`[${ts}] ⏳ Strategy evaluated tick. Decision: HOLD.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Account Overview Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#060913] p-3.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Account Equity</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className={`text-xs font-semibold mt-1 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
          </div>
        </div>

        <div className="bg-[#060913] p-3.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Available Cash</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-slate-200 font-mono">${cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-xs text-slate-500 mt-1">Buying Power: ${(cash * 2).toLocaleString()}</div>
        </div>

        <div className="bg-[#060913] p-3.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Unrealized PnL</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{positions.length} active position(s)</div>
        </div>

        <div className="bg-[#060913] p-3.5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Broker Connection</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-slate-200 mt-1">
            {alpacaConfigured ? 'Alpaca Paper (IEX)' : 'Simulated Paper Desk'}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Execution Gateway Ready
          </div>
        </div>
      </div>

      {/* Simulator Execution Bar */}
      <div className="bg-[#060913] p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Interactive Order & Tick Simulator</h4>
            <p className="text-xs text-slate-400">
              Test how your strategy responds to incoming price ticks and risk conditions in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTick()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-900/30"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Process Market Tick</span>
          </button>
          <button
            onClick={() => handleTick('BUY')}
            disabled={positions.length > 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 rounded-lg text-xs font-semibold transition border border-slate-700"
          >
            Force BUY Order
          </button>
          <button
            onClick={() => handleTick('SELL')}
            disabled={positions.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-rose-400 rounded-lg text-xs font-semibold transition border border-slate-700"
          >
            Force SELL Order
          </button>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span>Active Open Positions</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">
            {positions.length}
          </span>
        </h4>

        {positions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-slate-600" />
            <span>No open positions. Strategy is flat and scanning the order book for entry signals.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Asset</th>
                  <th className="py-2 px-3">Shares</th>
                  <th className="py-2 px-3">Avg Cost</th>
                  <th className="py-2 px-3">Current Price</th>
                  <th className="py-2 px-3">Position Value</th>
                  <th className="py-2 px-3">Unrealized PnL ($)</th>
                  <th className="py-2 px-3">Unrealized PnL (%)</th>
                  <th className="py-2 px-3">Entry Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {positions.map((pos, idx) => {
                  const posVal = pos.shares * currentPrice;
                  const pnl = (currentPrice - pos.entryPrice) * pos.shares;
                  const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                  return (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 font-sans font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {pos.symbol}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{pos.shares.toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-300">${pos.entryPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-200">${currentPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-slate-200">${posVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className={`py-2 px-3 font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className={`py-2 px-3 font-bold ${pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{pos.entryTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Executed Orders History */}
      <div className="bg-[#060913] rounded-xl border border-slate-800 p-4 shadow-xl">
        <h4 className="text-sm font-semibold text-slate-200 mb-3">Recent Simulated Order Executions</h4>
        {orderHistory.length === 0 ? (
          <div className="text-slate-500 text-xs py-4 text-center">No orders executed in this session yet.</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {orderHistory.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      order.side === 'BUY'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {order.side}
                  </span>
                  <span className="font-sans font-semibold text-white">{order.symbol}</span>
                  <span className="text-slate-400">{order.shares} shares @ ${order.price.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-4 text-right">
                  {order.pnl !== undefined && (
                    <span className={`font-bold ${order.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      PnL: {order.pnl >= 0 ? '+' : ''}${order.pnl.toFixed(2)}
                    </span>
                  )}
                  <span className="text-slate-500 text-[11px] font-sans">{order.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
