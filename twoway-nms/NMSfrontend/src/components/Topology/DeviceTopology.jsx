import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, CircularProgress, Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import apiClient from '../../api/axiosClient';
import { useDevice } from '../../contexts/DeviceContext';

export default function DeviceTopology({ gateway }) {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { setSelectedDevice, appsData } = useDevice();

  useEffect(() => {
    if (!gateway || !gateway.gatewayId) return;
    fetchTopologyData();
  }, [gateway]);

  const fetchTopologyData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/iot/gateways/${gateway.gatewayId}/devices`);
      const allDevices = res.data || [];

      const rootNode = {
        name: gateway.name || gateway.gatewayId,
        symbolSize: 40,
        itemStyle: { color: '#1976d2', borderColor: '#115293', borderWidth: 2 },
        children: buildDeviceTree(allDevices, null)
      };
      setTreeData(rootNode);
    } catch (error) {
      console.error("無法取得拓撲圖資料", error);
    } finally {
      setLoading(false);
    }
  };

  const buildDeviceTree = (devices, parentId) => {
    return devices
      .filter(d => parentId === null ? (!d.parentDevEui) : (d.parentDevEui === parentId))
      .map(d => {
        // 統一用後端 healthStatus (5min/10min 門檻)
        // stale 視覺上等同 online (跟 StatusBadge 二元化策略一致)
        let nodeColor, nodeBorder, statusName;
        switch (d.healthStatus) {
          case 'online':
          case 'stale':
            nodeColor = '#4caf50'; nodeBorder = '#2e7d32'; statusName = 'Online';
            break;
          case 'alarm':
            nodeColor = '#f44336'; nodeBorder = '#b71c1c'; statusName = 'Alarm';
            break;
          case 'offline':
          default:
            nodeColor = '#9e9e9e'; nodeBorder = '#616161'; statusName = 'Offline';
        }

        return {
          name: d.name || d.devEui,
          value: d.devEui,
          statusText: statusName,
          symbolSize: 20,
          itemStyle: {
            color: nodeColor,
            borderColor: nodeBorder,
            borderWidth: 2
          },
          children: buildDeviceTree(devices, d.devEui)
        };
      });
  };

  const getOption = () => {
    if (!treeData) return {};
    return {
      tooltip: { 
        trigger: 'item', 
        formatter: (params) => {
          // 判斷如果是Gateway根節點
          if (params.data.symbolSize === 40) {
            return `<b>Gateway: ${params.data.name}</b>`;
          }
          // 如果是Device節點  顯示詳細資訊
          return `<b>Device: ${params.data.name}</b><br/>
                  DevEUI: ${params.data.value}<br/>
                  Status: ${params.data.statusText}`;
        } 
      },
      series: [{
        type: 'tree',
        data: [treeData],
        top: '5%', left: '15%', bottom: '5%', right: '20%',
        symbol: 'circle',
        roam: true,
        expandAndCollapse: true,
        label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 12 },
        leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
        lineStyle: { color: '#9fa8da', width: 2, curveness: 0.5 }
      }]
    };
  };

 
  const onChartClick = (params) => {
    // 檢查點擊的是否為設備節點 (排除 Gateway 根節點)
    if (params.data && params.data.value) {
      const targetDevEui = String(params.data.value).toLowerCase(); // 強制轉小寫

      console.log("Clicked:", targetDevEui);

      // 從全域資料中搜尋該設備的完整物件
      let foundDevice = null;
      appsData.forEach(app => {
        const dev = app.devices?.find(d => d.devEui === targetDevEui);
        if (dev) foundDevice = { ...dev, itemType: 'device' };
      });

      if (foundDevice) {
        setSelectedDevice(foundDevice);
      }


      if (!foundDevice) {
        console.warn("This device is not within any application; foolproof redirection mode is enabled.");
        alert("Test device")
      }


    } else {
      console.log("點擊無效，該節點沒有夾帶 value 屬性", params.data);
    }


};


return (
  <Box>
    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
    ) : (
      <ReactECharts
        option={getOption()}
        style={{ height: '500px', width: '100%' }}
        onEvents={{ 'click': onChartClick }} 
      />
    )}
  </Box>
);
}