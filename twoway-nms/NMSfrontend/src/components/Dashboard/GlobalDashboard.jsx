import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, CircularProgress,
} from '@mui/material';
import RouterIcon from '@mui/icons-material/Router';
import AppsIcon from '@mui/icons-material/Apps';
import SensorsIcon from '@mui/icons-material/Sensors';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReactECharts from 'echarts-for-react';

import { DeviceApi } from '../../api/deviceApi';
import PageHeader from '../Layout/PageHeader';
import { PAGE_BG_SX, SECTION_CARD_SX } from '../../constants/cardStyles';
import { toLocalIso } from '../../utils/dateUtils';

const CATEGORY_ORDER = ['UNIT_STATUS', 'TEMPERATURE', 'VOLTAGE', 'RIPPLE', 'TCP'];

const CATEGORY_LABELS = {
  UNIT_STATUS: 'Unit Status',
  TEMPERATURE: 'Temperature',
  VOLTAGE: 'Voltage',
  RIPPLE: 'Ripple',
  TCP: 'TCP',
};

const COLOR_ONLINE = '#10B981';
const COLOR_OFFLINE = '#94A3B8';
const COLOR_ALARM = '#EF4444';
const COLOR_ALARM_DARK = '#B91C1C';
const COLOR_APP = '#2563EB';

const PAGE_SIZE = 500;
const TREND_MAX_PAGES = 5;

export default function GlobalDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    gateways: { total: 0, online: 0, offline: 0 },
    applications: { total: 0 },
    devices: { total: 0, online: 0, offline: 0, alarm: 0 },
    activeAlarms: { total: 0, byCategory: {} },
    trend24h: { hours: [], counts: [], rangeStart: null, rangeEnd: null },
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const trendStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const trendEnd = new Date();

      const [mapData, apps, activeRes, trendEvents] = await Promise.all([
        DeviceApi.getGlobalMapData(),
        DeviceApi.getApplications(),
        DeviceApi.getAlarmEvents({
          status: ['ACTIVE'],
          pageSize: PAGE_SIZE,
          sortBy: 'startTime',
          sortDir: 'desc',
        }),
        fetchAlarmsInRange(toLocalIso(trendStart), toLocalIso(trendEnd)),
      ]);

      const gws = mapData?.gateways || [];
      const gwOnline = gws.filter(g => g.healthStatus === 'online').length;
      const gwOffline = gws.length - gwOnline;

      const devs = mapData?.devices || [];
      const devOnline = devs.filter(
        d => d.healthStatus === 'online' || d.healthStatus === 'stale'
      ).length;
      const devAlarm = devs.filter(d => d.healthStatus === 'alarm').length;
      const devOffline = devs.length - devOnline - devAlarm;

      const activeEvents = activeRes?.events || [];
      const byCategory = {};
      CATEGORY_ORDER.forEach(c => { byCategory[c] = 0; });
      activeEvents.forEach(e => {
        if (byCategory[e.category] !== undefined) byCategory[e.category]++;
      });

      setData({
        gateways: { total: gws.length, online: gwOnline, offline: gwOffline },
        applications: { total: (apps || []).length },
        devices: {
          total: devs.length,
          online: devOnline,
          offline: devOffline,
          alarm: devAlarm,
        },
        activeAlarms: {
          total: activeEvents.length,
          byCategory,
        },
        trend24h: bucketByHour(trendEvents, trendEnd),
      });
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const trendHasData = data.trend24h.counts.some(c => c > 0);
  const systemHealth =
    data.activeAlarms.total >= 5
      ? 'Critical'
      : data.activeAlarms.total > 0
        ? 'Warning'
        : 'Normal';

  const systemColor =
    data.activeAlarms.total >= 5
      ? COLOR_ALARM_DARK
      : data.activeAlarms.total > 0
        ? '#F59E0B'
        : COLOR_ONLINE;

  return (
    <Box sx={PAGE_BG_SX}>
      <PageHeader title="NEXUS Overview" onRefresh={fetchAll} />

      <Card
        variant="outlined"
        sx={{
          ...SECTION_CARD_SX,
          height: 120,
          mb: 3,
          borderLeft: `5px solid ${systemColor}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                SYSTEM HEALTH
              </Typography>

              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700 }}>
                {systemHealth}
              </Typography>

              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {data.gateways.online} Gateway Online • {data.devices.total} Devices •{' '}
                {data.activeAlarms.total} Active Alarm
              </Typography>
            </Box>

            <Box
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: 999,
                bgcolor: data.activeAlarms.total > 0 ? '#FEF3C7' : '#ECFDF5',
                color: data.activeAlarms.total > 0 ? '#B45309' : COLOR_ONLINE,
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              NETWORK MONITORING ACTIVE
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {loading && data.gateways.total === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2.5,
              mb: 3,
            }}
          >
            <KpiCard
              label="Gateway Health"
              icon={<RouterIcon fontSize="small" />}
              segmentedDonut={{
                total: data.gateways.total,
                centerLabel: 'Gateway',
                segments: [
                  { value: data.gateways.online, name: 'Online', color: COLOR_ONLINE },
                  { value: data.gateways.offline, name: 'Offline', color: COLOR_OFFLINE },
                ],
              }}
              centerText={`${
                data.gateways.total > 0
                  ? Math.round((data.gateways.online / data.gateways.total) * 100)
                  : 0
              }%`}
              footer={
                <>
                  <Dot color={COLOR_ONLINE} />{data.gateways.online} online
                  <Box component="span" sx={{ ml: 1.5 }}>
                    <Dot color={COLOR_OFFLINE} />{data.gateways.offline} offline
                  </Box>
                </>
              }
            />

            <KpiCard
              label="Device Health"
              icon={<SensorsIcon fontSize="small" />}
              segmentedDonut={{
                total: data.devices.total,
                centerLabel: 'Devices',
                segments: [
                  { value: data.devices.online, name: 'Online', color: COLOR_ONLINE },
                  { value: data.devices.alarm, name: 'Alarm', color: COLOR_ALARM },
                  { value: data.devices.offline, name: 'Offline', color: COLOR_OFFLINE },
                ],
              }}
              centerText={`${data.devices.total}\nDevices`}
              footer={
                <>
                  <Dot color={COLOR_ONLINE} />{data.devices.online} online
                  <Box component="span" sx={{ ml: 1.5 }}>
                    <Dot color={COLOR_ALARM} />{data.devices.alarm} alarm
                  </Box>
                  <Box component="span" sx={{ ml: 1.5 }}>
                    <Dot color={COLOR_OFFLINE} />{data.devices.offline} offline
                  </Box>
                </>
              }
            />

            <KpiCard
              label="Alarm Health"
              icon={<NotificationsActiveIcon fontSize="small" />}
              segmentedDonut={{
                total: data.activeAlarms.total,
                centerLabel: 'Alarms',
                segments: [
                  {
                    value: data.activeAlarms.total || 1,
                    name: data.activeAlarms.total > 0 ? 'Active' : 'All Clear',
                    color: data.activeAlarms.total > 0 ? COLOR_ALARM : COLOR_ONLINE,
                  },
                ],
              }}
              centerText={`${data.activeAlarms.total}\nActive`}
              footer={
                <>
                  <Dot color={data.activeAlarms.total > 0 ? COLOR_ALARM : COLOR_ONLINE} />
                  {data.activeAlarms.total > 0
                    ? `${data.activeAlarms.total} active`
                    : 'All clear'}
                </>
              }
            />

            <KpiCard
              label="Applications"
              icon={<AppsIcon fontSize="small" />}
              segmentedDonut={{
                total: data.applications.total,
                centerLabel: data.applications.total === 1 ? 'Group' : 'Groups',
                segments: [
                  {
                    value: data.applications.total || 1,
                    name: 'Applications',
                    color: COLOR_APP,
                  },
                ],
              }}
              centerText={`${data.applications.total}\n${
                data.applications.total === 1 ? 'Group' : 'Groups'
              }`}
              footer={
                <>
                  <Dot color={COLOR_APP} />
                  {data.applications.total}{' '}
                  {data.applications.total === 1 ? 'group' : 'groups'}
                </>
              }
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Card variant="outlined" sx={SECTION_CARD_SX}>
              <CardContent>
                <PanelHeader caption={formatRange(data.trend24h.rangeStart, data.trend24h.rangeEnd)}>
                  24h alarm activity
                </PanelHeader>

                {!trendHasData ? (
                  <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">No alarms in last 24h</Typography>
                  </Box>
                ) : (
                  <ReactECharts
                    option={trendOption(data.trend24h)}
                    style={{ height: 220 }}
                    notMerge
                  />
                )}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={SECTION_CARD_SX}>
              <CardContent>
                <PanelHeader>Active alarms by category</PanelHeader>

                {data.activeAlarms.total === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 44, color: COLOR_ONLINE, mb: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      All clear
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ pt: 0.5 }}>
                    {CATEGORY_ORDER.map(cat => (
                      <CategoryBar
                        key={cat}
                        label={CATEGORY_LABELS[cat]}
                        count={data.activeAlarms.byCategory[cat] || 0}
                        max={data.activeAlarms.total}
                      />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
}

async function fetchAlarmsInRange(startIso, endIso) {
  let all = [];
  let page = 1;

  while (page <= TREND_MAX_PAGES) {
    const res = await DeviceApi.getAlarmEvents({
      start: startIso,
      end: endIso,
      page,
      pageSize: PAGE_SIZE,
      sortBy: 'startTime',
      sortDir: 'desc',
    });

    const batch = res?.events || [];
    all = all.concat(batch);

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

function bucketByHour(events, endTs) {
  const buckets = new Array(24).fill(0);
  const labels = new Array(24).fill('');

  const endHour = new Date(endTs);
  endHour.setMinutes(0, 0, 0);

  const startHour = new Date(endHour.getTime() - 23 * 60 * 60 * 1000);

  for (let i = 0; i < 24; i++) {
    const t = new Date(startHour.getTime() + i * 60 * 60 * 1000);
    labels[i] = String(t.getHours()).padStart(2, '0');
  }

  events.forEach(e => {
    if (!e.startTime) return;
    const t = new Date(e.startTime);
    const idx = Math.floor((t.getTime() - startHour.getTime()) / (60 * 60 * 1000));
    if (idx >= 0 && idx < 24) buckets[idx]++;
  });

  return {
    hours: labels,
    counts: buckets,
    rangeStart: startHour,
    rangeEnd: new Date(endTs),
  };
}

function formatRange(rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return null;

  const pad = n => String(n).padStart(2, '0');
  const fmt = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return `${fmt(rangeStart)} to ${fmt(rangeEnd)}`;
}

function trendOption(trend) {
  return {
    grid: { left: 40, right: 12, top: 28, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const p = params[0];
        const noun = `alarm${p.value === 1 ? '' : 's'}`;

        if (!trend.rangeStart) return `${p.name}:00 — ${p.value} ${noun}`;

        const t = new Date(trend.rangeStart.getTime() + p.dataIndex * 60 * 60 * 1000);
        const pad = n => String(n).padStart(2, '0');
        const dateStr =
          `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ` +
          `${pad(t.getHours())}:00`;

        return `${dateStr} — ${p.value} ${noun}`;
      },
    },
    xAxis: {
      type: 'category',
      data: trend.hours,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisLabel: { fontSize: 10, color: '#94A3B8', interval: 2 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: { fontSize: 10, color: '#94A3B8' },
      minInterval: 1,
    },
    series: [
      {
        type: 'bar',
        data: trend.counts,
        itemStyle: { color: COLOR_ALARM, borderRadius: [2, 2, 0, 0] },
        barCategoryGap: '20%',
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { type: 'dashed', color: '#94A3B8', width: 1 },
          label: {
            show: true,
            position: 'end',
            formatter: 'Now',
            color: '#64748B',
            fontSize: 10,
          },
          data: trend.hours.length > 0 ? [{ xAxis: trend.hours.length - 1 }] : [],
        },
      },
    ],
  };
}

function KpiCard({
  label,
  icon,
  footer,
  segmentedDonut,
  centerText,
}) {
  return (
    <Card variant="outlined" sx={{ ...SECTION_CARD_SX, height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: 0.5,
              lineHeight: 1.2,
            }}
          >
            {label}
          </Typography>

          <Box sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
        </Stack>

        <Box sx={{ width: 150, height: 150, mx: 'auto', mb: 1 }}>
          <ReactECharts
            option={{
              tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)',
              },
              graphic: {
                type: 'text',
                left: 'center',
                top: 'center',
                style: {
                  text:
                    centerText ||
                    `${segmentedDonut.total}\n${segmentedDonut.centerLabel}`,
                  textAlign: 'center',
                  fill: '#0F172A',
                  fontSize: 13,
                  fontWeight: 600,
                },
              },
              series: [
                {
                  type: 'pie',
                  radius: ['62%', '82%'],
                  center: ['50%', '50%'],
                  avoidLabelOverlap: false,
                  label: { show: false },
                  labelLine: { show: false },
                  data: segmentedDonut.segments.map(s => ({
                    value: s.value,
                    name: s.name,
                    itemStyle: { color: s.color },
                  })),
                },
              ],
            }}
            style={{ width: '100%', height: '100%' }}
            notMerge
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            minHeight: '1.25em',
          }}
        >
          {footer}
        </Typography>
      </CardContent>
    </Card>
  );
}

function PanelHeader({ children, caption }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          color: 'text.secondary',
          fontWeight: 700,
          letterSpacing: 0.5,
          lineHeight: 1.2,
        }}
      >
        {children}
      </Typography>

      {caption && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
        >
          {caption}
        </Typography>
      )}
    </Box>
  );
}

function Dot({ color }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: color,
        mr: 0.5,
        verticalAlign: '1px',
      }}
    />
  );
}

function CategoryBar({ label, count, max }) {
  const pct = max > 0 && count > 0
    ? Math.max(2, Math.round((count / max) * 100))
    : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.75, fontSize: '0.8125rem' }}>
      <Box sx={{ width: 100, color: 'text.secondary' }}>{label}</Box>

      <Box sx={{ flex: 1, height: 6, bgcolor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
        {count > 0 && (
          <Box sx={{ height: '100%', bgcolor: COLOR_ALARM, borderRadius: 3, width: `${pct}%` }} />
        )}
      </Box>

      <Box sx={{ width: 28, textAlign: 'right', color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </Box>
    </Box>
  );
}
