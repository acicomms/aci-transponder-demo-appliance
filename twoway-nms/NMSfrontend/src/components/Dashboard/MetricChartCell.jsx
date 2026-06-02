import { Card, CardContent, Typography, Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { isMetricEmpty } from './chartUtils';
import { SECTION_CARD_SX, SECTION_CARD_TITLE_SX } from '../../constants/cardStyles';

export default function MetricChartCell({ title, metric, optionBuilder }) {
  return (
    <Card variant="outlined" sx={{ ...SECTION_CARD_SX, height: '100%' }}>
      <CardContent>
        <Typography sx={{ ...SECTION_CARD_TITLE_SX, mb: 1.5 }}>{title}</Typography>
        {isMetricEmpty(metric) ? (
          <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">No data</Typography>
          </Box>
        ) : (
          <ReactECharts option={optionBuilder(metric)} style={{ height: 280, width: '100%' }} notMerge />
        )}
      </CardContent>
    </Card>
  );
}