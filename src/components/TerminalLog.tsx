import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Filter, Download } from 'lucide-react';

interface TerminalLogProps {
  logs: string[];
  onClearLogs?: () => void;
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'SIGNALS') return log.includes('BUY') || log.includes('SELL') || log.includes('EXIT');
    if (filter === 'RISK') return log.includes('STOP-LOSS') || log.includes('TAKE-PROFIT');
    if (filter === 'TELEMETRY') return log.includes('Scan') || log.includes('Holding');
    return true;
  });

  const getLogClass = (line: string) => {
    if (line.includes('BUY')) return 'text-emerald-400 font-bold bg-emerald-950/20 px-1 rounded';
    if (line.includes('SELL') || line.includes('STOP-LOSS')) return 'text-rose-400 font-bold bg-rose-950/20 px-1 rounded';
    if (line.includes('TAKE-PROFIT')) return 'text-amber-300 font-bold bg-amber-950/20 px-1 rounded';
    if (line.includes('Holding')) return 'text-sky-300';
    if (line.includes('Scan')) return 'text-slate-400';
    if (line.includes('SYSTEM') || line.includes('CONFIG')) return 'text-cyan-400 font-semibold';
    return 'text-slate-300';
  };

  const handleExport = () => {
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alphaforge_bot_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#050812] rounded-xl border border-slate-800 flex flex-col h-72 shadow-xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 font-sans text-xs font-semibold">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Live Strategy Telemetry & Thought Log</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 rounded px-1.5 py-0.5 border border-slate-800 text-[10px]">
            <Filter className="w-3 h-3 text-slate-400 mr-1" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Events</option>
              <option value="SIGNALS">Signals (Buy/Sell)</option>
              <option value="RISK">Risk Exits</option>
              <option value="TELEMETRY">Telemetry Heartbeat</option>
            </select>
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 text-[10px] rounded border transition ${
              autoScroll
                ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoScroll ? 'Auto-Scroll ON' : 'Paused'}
          </button>

          <button
            onClick={handleExport}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            title="Export Logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition"
              title="Clear Terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">No terminal logs recorded.</div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="leading-relaxed break-all font-mono">
              <span className={getLogClass(log)}>{log}</span>
            </div>
          ))
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-3 py-1 bg-slate-950 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-500 font-sans">
        <span>Logged Events: {logs.length}</span>
        <span>STDOUT / Stderr Simulator Active</span>
      </div>
    </div>
  );
};
