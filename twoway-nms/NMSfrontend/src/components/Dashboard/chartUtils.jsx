// Shared chart utilities for ChirpStack-style metrics charts.
// Used by DeviceLinkMetricsCharts and GatewayMetricsCharts.

// Range presets aligned to ChirpStack web UI metrics charts
export const RANGE_PRESETS = {
  '24h': { label: 'Last 24h', hours: 24,       aggregation: 'HOUR' },
  '7d':  { label: 'Last 7d',  hours: 24 * 7,   aggregation: 'DAY'  },
  '30d': { label: 'Last 30d', hours: 24 * 30,  aggregation: 'DAY'  },
};

// ISO8601 -> "YYYY-MM-DD HH:mm:ss" in browser local tz (matches C-2-a contract)
export const formatTooltipTs = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Short tick label depending on aggregation
export const formatTick = (iso, aggregation) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  if (aggregation === 'HOUR') {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Frequency Hz string -> "903.9 MHz"
export const humanizeFreq = (hzStr) => {
  const hz = Number(hzStr);
  if (!Number.isFinite(hz)) return String(hzStr);
  return `${(hz / 1e6).toFixed(1)} MHz`;
};

// DR int string -> "DR3"
export const humanizeDr = (drStr) => `DR${drStr}`;

// Identity for labels that need no transformation
// (e.g. ChirpStack tx_packets_per_status uses enum strings: "OK", etc.)
export const identityLabel = (s) => String(s);

export const isMetricEmpty = (metric) =>
  !metric ||
  !Array.isArray(metric.timestamps) || metric.timestamps.length === 0 ||
  !Array.isArray(metric.datasets)   || metric.datasets.length === 0;

// ---------- ECharts option builders ----------

export const buildSimpleBarOption = (metric, yLabel, aggregation) => {
  const xData = metric.timestamps.map(t => formatTick(t, aggregation));
  const ds = metric.datasets[0] || { label: '', data: [] };
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const idx = params[0]?.dataIndex ?? 0;
        return `${formatTooltipTs(metric.timestamps[idx])}<br/>${yLabel}: ${params[0].value ?? '-'}`;
      },
    },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: yLabel, nameTextStyle: { fontSize: 10 } },
    series: [{ type: 'bar', data: ds.data, itemStyle: { color: '#1976d2' } }],
  };
};

export const buildSimpleLineOption = (metric, yLabel, color, aggregation) => {
  const xData = metric.timestamps.map(t => formatTick(t, aggregation));
  const ds = metric.datasets[0] || { label: '', data: [] };
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const idx = params[0]?.dataIndex ?? 0;
        return `${formatTooltipTs(metric.timestamps[idx])}<br/>${yLabel}: ${params[0].value ?? '-'}`;
      },
    },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: yLabel, nameTextStyle: { fontSize: 10 } },
    series: [{
      type: 'line', smooth: true, data: ds.data,
      itemStyle: { color: color || '#1976d2' },
      areaStyle: { opacity: 0.15 },
    }],
  };
};

export const buildStackedBarOption = (metric, labelHumanizer, aggregation) => {
  const xData = metric.timestamps.map(t => formatTick(t, aggregation));
  const series = metric.datasets.map((ds) => ({
    type: 'bar',
    stack: 'total',
    name: labelHumanizer(ds.label),
    data: ds.data,
  }));
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 10 } },
    grid: { left: 50, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: 'Count', nameTextStyle: { fontSize: 10 } },
    series,
  };
};