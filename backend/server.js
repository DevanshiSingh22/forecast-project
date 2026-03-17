const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = 5000;


function normalizeTime(isoStr) {
  return new Date(isoStr).toISOString().slice(0, 16);
}


app.get("/api/actual", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });


    const resp = await axios.get(
      "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH",
      {
        params: {
          fuelType: "WIND",
          settlementDateFrom: from.slice(0, 10),
          settlementDateTo: to.slice(0, 10),
          format: "json",
        },
      }
    );

    const raw = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];

    const fromTs = new Date(from);
    const toTs = new Date(to);

    const data = raw
      .filter((item) => {
        const t = new Date(item.startTime);
        return (item.fuelType === "WIND" || !item.fuelType) && t >= fromTs && t <= toTs;
      })
      .map((item) => ({
        startTime: normalizeTime(item.startTime),
        generation: Number(item.generation),
      }))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    res.json(data);
  } catch (err) {
    console.error("actual error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/forecast", async (req, res) => {
  try {
    const { from, to } = req.query;
    const horizon = Number(req.query.horizon ?? 4);
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const publishFrom = new Date(
      new Date(from).getTime() - (horizon + 2) * 3600000
    ).toISOString();

    const resp = await axios.get(
      "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream",
      { params: { publishDateTimeFrom: publishFrom, publishDateTimeTo: to, format: "json" } }
    );

    const raw = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];

    const fromTs = new Date(from);
    const toTs = new Date(to);


    const filtered = raw.filter((item) => {
      const st = new Date(item.startTime);
      const h = (st - new Date(item.publishTime)) / 3600000;
      return st >= fromTs && st <= toTs && h >= 0 && h <= 48;
    });


    const byStartTime = {};
    filtered.forEach((f) => {
      const key = normalizeTime(f.startTime);
      if (!byStartTime[key]) byStartTime[key] = [];
      byStartTime[key].push(f);
    });

    const result = Object.keys(byStartTime)
      .map((startTime) => {
        const cutoff = new Date(new Date(startTime).getTime() - horizon * 3600000);
        const eligible = byStartTime[startTime].filter(
          (f) => new Date(f.publishTime) <= cutoff
        );
        if (!eligible.length) return null;

        const best = eligible.reduce((prev, curr) =>
          new Date(curr.publishTime) > new Date(prev.publishTime) ? curr : prev
        );

        return {
          startTime,
          generation: Number(best.generation),
          publishTime: best.publishTime,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    res.json(result);
  } catch (err) {
    console.error("forecast error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/debug
app.get("/api/debug", async (req, res) => {
  try {
    const { from = "2024-01-24T08:00", to = "2024-01-25T08:00", horizon = 4 } = req.query;

    const publishFrom = new Date(
      new Date(from).getTime() - (Number(horizon) + 2) * 3600000
    ).toISOString();

    const [actualRes, forecastRes] = await Promise.all([
      axios.get("https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH", {
        params: { fuelType: "WIND", settlementDateFrom: from.slice(0, 10), settlementDateTo: to.slice(0, 10), format: "json" },
      }),
      axios.get("https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream", {
        params: { publishDateTimeFrom: publishFrom, publishDateTimeTo: to, format: "json" },
      }),
    ]);

    const actRaw = Array.isArray(actualRes.data) ? actualRes.data : actualRes.data?.data ?? [];
    const forRaw = Array.isArray(forecastRes.data) ? forecastRes.data : forecastRes.data?.data ?? [];

    const fromTs = new Date(from);
    const toTs = new Date(to);

    const filteredFor = forRaw.filter((item) => {
      const st = new Date(item.startTime);
      const h = (st - new Date(item.publishTime)) / 3600000;
      return st >= fromTs && st <= toTs && h >= 0 && h <= 48;
    });

    res.json({
      actualCount: actRaw.length,
      forecastRawCount: forRaw.length,
      forecastFilteredCount: filteredFor.length,
      sampleActualStartTimes: actRaw.slice(0, 3).map((x) => ({ raw: x.startTime, normalized: normalizeTime(x.startTime) })),
      sampleForecastStartTimes: filteredFor.slice(0, 3).map((x) => ({ raw: x.startTime, normalized: normalizeTime(x.startTime) })),
      sampleForecastPublishTimes: filteredFor.slice(0, 3).map((x) => x.publishTime),
      eligibleSample: filteredFor.slice(0, 5).map((f) => ({
        startTime: normalizeTime(f.startTime),
        publishTime: f.publishTime,
        isEligible: new Date(f.publishTime) <= new Date(new Date(f.startTime).getTime() - horizon * 3600000),
        horizonHrs: (new Date(f.startTime) - new Date(f.publishTime)) / 3600000,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

setInterval(() => {
  axios.get("https://forecast-project.onrender.com/api/actual?from=2024-01-24T08:00&to=2024-01-24T09:00")
    .catch(() => { });
}, 14 * 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));