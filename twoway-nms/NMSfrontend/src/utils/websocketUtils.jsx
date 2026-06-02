export const getWebSocketUrl = () => {

    if (import.meta.env.DEV) {
      // 本機開發時 直接指向 Spring Boot
      return 'ws://localhost:8080/ws-monitoring/websocket'; 
    }
  
    // 遠端部屬 (Docker/Nginx)  動態抓取當前網址與 Port
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // 會自動抓到 twowayiot.com:9080
  
    return `${wsProtocol}//${host}/ws-monitoring/websocket`;
  };