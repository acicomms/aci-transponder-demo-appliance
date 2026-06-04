import apiClient from './axiosClient';

export const DeviceApi = {
  // ==========================================
  //grpc取得chirpstack資料 - 強制同步
  // ==========================================
  getAppDeviceTree: async () => {
    try {
      // 把原本的 get('/iot/applications') 改成 post('/iot/applications/sync')
      // 這樣每次網頁載入呼叫這支 API 時，後端都會強制去 ChirpStack 拉取最新清單並覆蓋 MySQL
      const appRes = await apiClient.post('/iot/applications/sync');
      // const appRes = await apiClient.get('/iot/applications');
      const appsData = Array.isArray(appRes.data) ? appRes.data : [];

      console.log('1. 取得的 Applications:', appsData);

      // 2. 針對每一個 Application 取得底下的 Devices
      const treeDataPromises = appsData.map(async (app) => {
        // 兼容不同的 ID 命名 
        const appId = app.id || app.applicationId;

        if (!appId) {
          console.warn('找不到 Application ID', app);
          return { ...app, itemType: 'application', devices: [] };
        }

        try {
          const devRes = await apiClient.get(`/iot/devices?applicationId=${appId}`);
          const devicesData = Array.isArray(devRes.data) ? devRes.data : [];

          return {
            ...app,
            id: appId,
            name: app.name || `App ${appId}`,
            itemType: 'application',
            devices: devicesData.map(dev => ({
              ...dev,
              devEui: dev.devEui || dev.deviceEui || dev.id,
              name: dev.name || dev.devEui || 'Unknown Device',
              itemType: 'device'
            }))
          };
        } catch (error) {
          console.error(`取得 Application ${appId} 的設備失敗:`, error);
          return { ...app, id: appId, itemType: 'application', devices: [] };
        }
      });

      const fullTreeData = await Promise.all(treeDataPromises);
      console.log('組合好的 Application-Device Tree:', fullTreeData);
      return fullTreeData;
    } catch (error) {
      console.error('取得 Application Tree 失敗:', error);
      throw error;
    }



  },

  // ==========================================
  // 取得 Application 清單
  // ==========================================
  getApplications: async () => {
    try {
      const res = await apiClient.get('/iot/applications');
      return res.data;
    } catch (error) {
      console.error('取得 Applications 失敗:', error);
      throw error;
    }
  },

  // ==========================================
  // Create Application (POST /iot/applications)
  // ==========================================
  createApplication: async (name, description) => {
    try {
      const res = await apiClient.post('/iot/applications', {
        name,
        description: description || ''
      });
      return res.data;
    } catch (error) {
      console.error('Create Application FAIL:', error);
      throw error;
    }
  },

  // ==========================================
  // Update Application (PUT /iot/applications/{id})
  // ==========================================
  updateApplication: async (id, name, description) => {
    try {
      const res = await apiClient.put(`/iot/applications/${id}`, {
        name,
        description: description || ''
      });
      return res.data;
    } catch (error) {
      console.error(`Update Application ${id} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // delete Application (DELETE /iot/applications/{id})
  // ChirpStack cascade delete 所有 devices
  // ==========================================
  deleteApplication: async (id) => {
    try {
      const res = await apiClient.delete(`/iot/applications/${id}`);
      return res.data;
    } catch (error) {
      console.error(`Delete Application ${id} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // List Device Profiles (GET /iot/device-profiles)
  // 給 Add Device modal 的 dropdown 用. backend用 tenant-id 列出全部 profile.
  // ==========================================
  listDeviceProfiles: async () => {
    try {
      const res = await apiClient.get('/iot/device-profiles');
      return res.data;
    } catch (error) {
      console.error('List Device Profiles FAIL:', error);
      throw error;
    }
  },

  // ==========================================
  // Create Device (POST /iot/devices)
  // ==========================================
  createDevice: async ({
    devEui, name, description, applicationId, deviceProfileId,
    appKey, isDisabled, skipFcntCheck,
  }) => {
    try {
      const res = await apiClient.post('/iot/devices', {
        devEui,
        name,
        description: description || '',
        applicationId,
        deviceProfileId,
        appKey,
        isDisabled: !!isDisabled,
        skipFcntCheck: !!skipFcntCheck,
      });
      return res.data;
    } catch (error) {
      console.error('Create Device FAIL:', error);
      throw error;
    }
  },

  // ==========================================
  // Get Device OTAA Keys (GET /iot/devices/{devEui}/keys)
  // ==========================================
  getDeviceKeys: async (devEui) => {
    try {
      const res = await apiClient.get(`/iot/devices/${devEui}/keys`);
      return res.data;
    } catch (error) {
      console.error(`Get Device Keys ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // Delete Device (DELETE /iot/devices/{devEui})
  // ==========================================
  deleteDevice: async (devEui) => {
    try {
      const res = await apiClient.delete(`/iot/devices/${devEui}`);
      return res.data;
    } catch (error) {
      console.error(`Delete Device ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // 取得即時數據 (03指令)
  // ==========================================
  startRealTimeMonitor: async (devEui) => {
    try {
      const res = await apiClient.post(`/iot/devices/${devEui}/start-monitor`);
      return res.data;
    } catch (error) {
      console.error(`啟動設備 ${devEui} 即時監控失敗:`, error);
      throw error;
    }
  },


  // ==========================================
  // 取得單一設備的完整聚合資料 (包含指令01和02)
  // ==========================================
  getDeviceDetail: async (devEui) => {
    try {
      const res = await apiClient.get(`/iot/devices/${devEui}/detail`);
      return res.data;
    } catch (error) {
      console.error(`取得設備 ${devEui} 詳細資訊失敗:`, error);
      throw error;
    }
  },

  // ==========================================
  // 手動同步設備資料 01和02
  // ==========================================
  syncDeviceData: async (devEui, target) => {
    try {
      // target 必須是 'INFO' 或 'SETTINGS'
      const res = await apiClient.post(`/iot/devices/${devEui}/sync0102`, { target });
      return res.data;
    } catch (error) {
      console.error(`同步設備 ${devEui} 資料失敗:`, error);
      throw error;
    }
  },

  // ==========================================
  // List Applicable Settings — GET /iot/devices/{devEui}/settings
  // ==========================================
  listApplicableSettings: async (devEui) => {
    try {
      const res = await apiClient.get(`/iot/devices/${devEui}/settings`);
      return res.data;
    } catch (error) {
      console.error(`List applicable settings for ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // Generic SET — POST /iot/devices/{devEui}/settings/{settingKey}
  // ==========================================
  setDeviceSetting: async (devEui, settingKey, value) => {
    try {
      const res = await apiClient.post(
        `/iot/devices/${devEui}/settings/${settingKey}`,
        { value: Number(value) }
      );
      return res.data;
    } catch (error) {
      console.error(`Set ${settingKey} on ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // Update health-status thresholds — PUT /iot/devices/{devEui}/health-thresholds
  // body: { ampOfflineMin, transponderOfflineMin }
  // ==========================================
  updateHealthThresholds: async (devEui, body) => {
    try {
      const res = await apiClient.put(
        `/iot/devices/${devEui}/health-thresholds`,
        body
      );
      return res.data;
    } catch (error) {
      console.error(`Update health thresholds ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // 更新設備座標 (0x80 0x45 指令, 走獨立 endpoint)
  // ==========================================
  updateDeviceLocation: async (devEui, lat, lon) => {
    try {
      const res = await apiClient.post(`/iot/devices/${devEui}/location`, {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon)
      });
      return res.data;
    } catch (error) {
      console.error(`更新設備 ${devEui} 座標失敗:`, error);
      throw error;
    }
  },

  // ==========================================
  // 更新設備實體地址 (0x90 0x33 UTF-16, 走獨立 endpoint)
  // ==========================================
  updateDeviceAddress: async (devEui, address) => {
    try {
      const res = await apiClient.post(`/iot/devices/${devEui}/address`, {
        address: address
      });
      return res.data;
    } catch (error) {
      console.error(`更新設備 ${devEui} 地址失敗:`, error);
      throw error;
    }
  },

  // ==========================================
  // 取得歷史資料
  // ==========================================
  getDeviceHistory: async (devEui, start, end) => {
    try {
      let url = `/iot/devices/${devEui}/history`;
      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }
      const res = await apiClient.get(url);
      return res.data;
    } catch (error) {
      console.error(`取得設備 ${devEui} 歷史資料失敗:`, error);
      throw error;
    }
  },

  // ==========================================
  // Get Device Link Metrics (GET /iot/devices/{devEui}/link-metrics)
  // ==========================================
  getDeviceLinkMetrics: async (devEui, start, end, aggregation) => {
    try {
      const res = await apiClient.get(`/iot/devices/${devEui}/link-metrics`, {
        params: { start, end, aggregation },
      });
      return res.data;
    } catch (error) {
      console.error(`Get Device Link Metrics ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // Get Gateway Metrics (GET /iot/gateways/{gatewayId}/metrics)
  // ==========================================
  getGatewayMetrics: async (gatewayId, start, end, aggregation) => {
    try {
      const res = await apiClient.get(`/iot/gateways/${gatewayId}/metrics`, {
        params: { start, end, aggregation },
      });
      return res.data;
    } catch (error) {
      console.error(`Get Gateway Metrics ${gatewayId} FAIL:`, error);
      throw error;
    }
  },

  // ==========================================
  // 指令04-09頻譜掃描
  // ==========================================
  scanSpectrum: async (devEui, type, part) => {
    try {
      const res = await apiClient.post(`/iot/${devEui}/spectrum/scan`, { type, part });
      return res.data;
    } catch (error) {
      console.error(`發送頻譜掃描指令失敗 [Type:${type}, Part:${part}]:`, error);
      throw error;
    }
  },



  // ==========================================
  // 強制清空設備的指令 Queue
  // ==========================================
  clearDeviceQueue: async (devEui) => {
    try {
      const res = await apiClient.delete(`/iot/devices/${devEui}/queue`);
      return res.data;
    } catch (error) {
      console.error(`強制清空設備 ${devEui} 佇列失敗:`, error);
      throw error;
    }
  },


  // ==========================================
  // 更改gateway的latitude longitude (gRPC)
  // ==========================================
  handleSaveGatewayLocation: async (gatewayId, newLat, newLon) => {
    try {

      const response = await apiClient.put(`/iot/gateways/${gatewayId}/location`, {
        latitude: newLat,
        longitude: newLon
      });

      // Axios 的回傳結果會放在 response.data 裡面
      const result = response.data;
      if (result.success) {
        alert("Gateway location update success！");
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("更新失敗", error);
      // 加上詳細的錯誤提示，方便以後 debug
      alert("save fail：" + (error.response?.data?.message || error.message));
    }
  },

  // ==========================================
  // 取得所有gateway清單
  // ==========================================
  getGateways: async () => {
    try {
      const res = await apiClient.get('/iot/gateways');
      return (res.data || []).map(gw => {
        // 修正：後端回傳的是 gatewayEui，將其統一對應到 gatewayId 與 id
        const correctGatewayId = gw.gatewayEui || gw.gatewayId;

        return {
          ...gw,
          gatewayId: correctGatewayId,
          id: correctGatewayId,
          itemType: 'gateway'
        };
      });
    } catch (error) {
      console.error('取得gw清單失敗:', error);
      throw error;
    }
  },
  // ==========================================
  // 取得全域地圖拓撲資料 (google map)
  // ==========================================
  getGlobalMapData: async () => {
    try {
      const res = await apiClient.get('/iot/dashboard/map-data');
      return res.data;
    } catch (error) {
      console.error("取得地圖資料失敗:", error);
      throw error;
    }
  },

  // ==========================================
  // 取得 Dashboard 統計資料與列表  (Dashboard)
  // ==========================================
  getDashboardAlarms: async (days) => {
    try {
      const res = await apiClient.get(`/iot/dashboard/alarms?days=${days}`);
      return res.data;
    } catch (error) {
      console.error("取得 Dashboard 資料失敗:", error);
      throw error;
    }
  },

  // ==========================================
  // 查詢 alarm 事件
  // ==========================================
  getAlarmEvents: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      (filters.devEui   || []).forEach(v => params.append('devEui',   v));
      (filters.category || []).forEach(v => params.append('category', v));
      (filters.status   || []).forEach(v => params.append('status',   v));
      if (filters.start    != null) params.append('start',    filters.start);
      if (filters.end      != null) params.append('end',      filters.end);
      if (filters.sortBy   != null) params.append('sortBy',   filters.sortBy);
      if (filters.sortDir  != null) params.append('sortDir',  filters.sortDir);
      if (filters.page     != null) params.append('page',     filters.page);
      if (filters.pageSize != null) params.append('pageSize', filters.pageSize);
      if (filters.countOnly!= null) params.append('countOnly', filters.countOnly);
      if (filters.since    != null) params.append('since',    filters.since);

      const res = await apiClient.get(`/iot/alarms/events?${params.toString()}`);
      return res.data;
    } catch (error) {
      console.error("取得 alarm events 失敗:", error);
      throw error;
    }
  },

  // ==========================================
  // Link Test (Diagnostics) — sequential request-response.
  // ==========================================

  // POST /iot/devices/{devEui}/diagnostics/rf-test/start
  // body: { mode: 'READ'|'SET', readTarget: 'STATUS' (READ),
  //         settingKey, value (SET), timeoutSec (1~30) }
  startRfTest: async (devEui, body) => {
    try {
      const res = await apiClient.post(
        `/iot/devices/${devEui}/diagnostics/rf-test/start`,
        body
      );
      return res.data;
    } catch (error) {
      console.error(`Start RF test on ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // POST /iot/devices/{devEui}/diagnostics/rf-test/stop
  stopRfTest: async (devEui) => {
    try {
      const res = await apiClient.post(
        `/iot/devices/${devEui}/diagnostics/rf-test/stop`
      );
      return res.data;
    } catch (error) {
      console.error(`Stop RF test on ${devEui} FAIL:`, error);
      throw error;
    }
  },

  // GET /iot/devices/{devEui}/diagnostics/rf-test/status
  getRfTestStatus: async (devEui) => {
    try {
      const res = await apiClient.get(
        `/iot/devices/${devEui}/diagnostics/rf-test/status`
      );
      return res.data;
    } catch (error) {
      console.error(`Get RF test status ${devEui} FAIL:`, error);
      throw error;
    }
  },

};