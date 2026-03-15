import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import "./App.css";

const API = "http://localhost:5000";
const DEFAULT_FROM = "2024-01-24T08:00";
const DEFAULT_TO   = "2024-01-25T08:00";

function fmtLabel(isoStr) {
  const [datePart, timePart] = isoStr.split("T");
  const [, month, day] = datePart.split("-");
  return `${day}/${month} ${timePart}`;
}

function getWindLevel(avgMW) {
  if (!avgMW || avgMW < 3000)  return "calm";
  if (avgMW < 8000)            return "breeze";
  if (avgMW < 15000)           return "windy";
  return "storm";
}

const WIND_LABELS = {
  calm:   "🌤 Calm winds",
  breeze: "🌬 Light breeze",
  windy:  "💨 Windy",
  storm:  "⛈ Strong winds",
};


const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  top:   `${8 + (i * 37) % 80}%`,
  left:  `${(i * 19) % 85}%`,
  width: `${22 + (i * 13) % 55}px`,
  delay: `${(i * 0.37) % 4}s`,
}));

function WeatherScene({ level }) {
  const particleCount = { calm: 3, breeze: 7, windy: 14, storm: 22 }[level];

  return (
    <div className={`scene`}>
      <div className="sun" />

      <div className="cloud-1" />
      <div className="cloud-2" />
      <div className="cloud-3" />

      {/* Wind particles */}
      {PARTICLES.slice(0, particleCount).map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{ top: p.top, left: p.left, width: p.width, animationDelay: p.delay }}
        />
      ))}

      {/* Left trees */}
      <div className="tree-group left">
        <Tree w1={12} w2={16} w3={20} trunkW={5} trunkH={15} />
        <Tree w1={16} w2={20} w3={25} trunkW={6} trunkH={18} />
        <Tree w1={10} w2={14} w3={17} trunkW={4} trunkH={13} />
      </div>

      {/* Turbine */}
      <div className="scene-turbine">
        <div style={{ position: "relative", height: 44, width: 60, marginBottom: 0 }}>
          <div className="turbine-rotor" style={{ top: 0, left: "50%" }}>
            <div className="t-blade" style={{ height: 36, transform: "rotate(0deg)",   bottom: 0 }} />
            <div className="t-blade" style={{ height: 36, transform: "rotate(120deg)", bottom: 0 }} />
            <div className="t-blade" style={{ height: 36, transform: "rotate(240deg)", bottom: 0 }} />
          </div>
          <div className="turbine-hub" />
        </div>
        <div className="turbine-pole" />
      </div>

      {/* Right trees */}
      <div className="tree-group right">
        <Tree w1={14} w2={18} w3={22} trunkW={5} trunkH={16} />
        <Tree w1={10} w2={13} w3={16} trunkW={4} trunkH={12} />
        <Tree w1={15} w2={19} w3={23} trunkW={6} trunkH={17} />
      </div>

      <div className="ground" />
      <div className="wind-badge">{WIND_LABELS[level]}</div>
    </div>
  );
}

function Tree({ w1, w2, w3, trunkW, trunkH }) {
  return (
    <div className="tree">
      <div className="tree-top-a" style={{ borderLeftWidth: w1, borderRightWidth: w1, borderBottomWidth: w1 * 1.6 }} />
      <div className="tree-top-b" style={{ borderLeftWidth: w2, borderRightWidth: w2, borderBottomWidth: w2 * 1.5 }} />
      <div className="tree-top-c" style={{ borderLeftWidth: w3, borderRightWidth: w3, borderBottomWidth: w3 * 1.4 }} />
      <div className="tree-trunk" style={{ width: trunkW, height: trunkH }} />
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <p className="tooltip-label">{payload[0]?.payload?.label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value != null ? `${Number(p.value).toLocaleString()} MW` : "—"}</strong>
        </p>
      ))}
    </div>
  );
}

export default function App() {
  const [from, setFrom]           = useState(DEFAULT_FROM);
  const [to, setTo]               = useState(DEFAULT_TO);
  const [horizon, setHorizon]     = useState(4);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [actualRes, forecastRes] = await Promise.all([
        axios.get(`${API}/api/actual`,   { params: { from, to } }),
        axios.get(`${API}/api/forecast`, { params: { from, to, horizon } }),
      ]);
      const actuals   = actualRes.data;
      const forecasts = forecastRes.data;
      const forecastMap = {};
      forecasts.forEach((f) => { forecastMap[f.startTime] = f.generation; });
      const merged = actuals.map((a) => ({
        key:      a.startTime,
        label:    fmtLabel(a.startTime),
        actual:   a.generation,
        forecast: forecastMap[a.startTime] ?? null,
      }));
      const firstIdx = merged.findIndex(d => d.forecast !== null);
      setChartData(firstIdx >= 0 ? merged.slice(firstIdx) : merged);
    } catch (e) {
      console.error(e);
      setError("Failed to load data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [from, to, horizon]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgActual = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + (d.actual ?? 0), 0) / chartData.length)
    : 0;
  const windLevel = getWindLevel(avgActual);
  const paired = chartData.filter(d => d.actual != null && d.forecast != null);
  const mae = paired.length
    ? Math.round(paired.reduce((s, d) => s + Math.abs(d.actual - d.forecast), 0) / paired.length)
    : null;
  const maxActual = chartData.length
    ? Math.round(Math.max(...chartData.map(d => d.actual ?? 0)))
    : null;

  return (
    <div className={`app-shell ${windLevel}`}>
      <WeatherScene level={windLevel} />

      <div className="container">
        <div className="header">
          <h1>Wind Power Forecast Monitor</h1>
          <p className="header-sub">UK National Grid · Elexon BMRS · January 2024 · UTC</p>
        </div>

        <div className="panel">
          <div className="controls">
            <div className="control-group">
              <div className="label-text">Start Time</div>
              <input type="datetime-local" value={from}
                min="2024-01-01T00:00" max="2024-01-31T23:30"
                onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="control-group">
              <div className="label-text">End Time</div>
              <input type="datetime-local" value={to}
                min="2024-01-01T00:30" max="2024-02-01T00:00"
                onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="control-group slider-group">
              <div className="label-text">Forecast Horizon</div>
              <div className="slider-readout">{horizon}<small>h</small></div>
              <input type="range" min={0} max={48} step={1} value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))} />
              <div className="slider-ticks">
                <span>0h</span><span>12h</span><span>24h</span><span>36h</span><span>48h</span>
              </div>
            </div>
          </div>

          <div className="chart-title">Generation · MW · 30-min intervals</div>
          <div className="chart-wrapper">
            {loading && <div className="overlay"><div className="loading-spinner" /><span>Fetching wind data…</span></div>}
            {error   && <div className="overlay error">⚠ {error}</div>}
            {!loading && !error && chartData.length === 0 && <div className="overlay">No data for this range</div>}

            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 50 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="rgba(0,0,0,0.07)" vertical={false} />
                <XAxis dataKey="label"
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                  tick={{ fontSize: 11, fill: "rgba(0,0,0,0.4)", fontFamily: "JetBrains Mono" }}
                  angle={-35} textAnchor="end" height={65}
                  axisLine={{ stroke: "rgba(0,0,0,0.1)" }} tickLine={false}
                  label={{ value: "Target Time (UTC)", position: "insideBottom", offset: -10, style: { fill: "rgba(0,0,0,0.35)", fontSize: 11, fontFamily: "JetBrains Mono" } }}
                />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "rgba(0,0,0,0.4)", fontFamily: "JetBrains Mono" }}
                  axisLine={false} tickLine={false}
                  label={{ value: "Power (MW)", angle: -90, position: "insideLeft", offset: 15, style: { fill: "rgba(0,0,0,0.35)", fontSize: 11, fontFamily: "JetBrains Mono" } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36}
                  formatter={(v) => <span style={{ fontFamily: "JetBrains Mono", fontSize: "0.72rem" }}>{v}</span>} />
                <Line type="monotone" dataKey="actual"   name="Actual Generation"   stroke="#1a6ea8" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="forecast" name="Forecast Generation" stroke="#1a8a4a" strokeWidth={2.5} strokeDasharray="6 3" dot={false} activeDot={{ r: 5 }} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="stats">
            {[
              { label: "Avg Generation", value: avgActual ? avgActual.toLocaleString() : "—", unit: "MW actual mean",    green: false },
              { label: "Peak Generation",value: maxActual ? maxActual.toLocaleString() : "—", unit: "MW maximum",        green: true  },
              { label: "Mean Abs Error", value: mae != null ? mae.toLocaleString() : "—",    unit: "MW forecast error",  green: true  },
              { label: "Horizon",        value: horizon,                                       unit: "hour lead time",     green: false },
              { label: "Intervals",      value: chartData.length,                              unit: "30-min periods",     green: false },
              { label: "Matched Pairs",  value: paired.length,                                 unit: "actual + forecast",  green: false },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value${s.green ? " green" : ""}`}>{s.value}</div>
                <div className="stat-unit">{s.unit}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
