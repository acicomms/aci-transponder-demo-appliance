import { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableRow, Paper, 
  Button, Box, Typography 
} from '@mui/material';
import apiClient from '../../api/axiosClient'; 

const formatLoginTime = (timeStr) => {
  if (!timeStr) return 'N/A';
  
  // 直接將後端傳來的字串餵給 Date
  const date = new Date(timeStr);
  
  // 檢查是否為無效日期
  if (isNaN(date.getTime())) {
    return timeStr; 
  }
  
  // 強制使用 24 小時制與在地化顯示
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

export default function LoginHistory() {
  const [logs, setLogs] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    apiClient.get('/auth/history')
      .then(res => setLogs(res.data))
      .catch(err => console.error("無法取得紀錄", err));
  }, []);

  // --- 分頁邏輯計算 ---
  const totalPages = Math.ceil(logs.length / rowsPerPage); // 計算總頁數
  const startIndex = (currentPage - 1) * rowsPerPage;      // 當前頁的起始索引
  const currentLogs = logs.slice(startIndex, startIndex + rowsPerPage); // 裁切當前頁的資料


  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">Login Record</Typography>
      
      <Paper sx={{ overflowX: 'auto', width: '100%', borderRadius: 2, boxShadow: 3 }}>
        <Table sx={{ minWidth: 600 }}>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell>Log ID</TableCell>
              <TableCell>User name</TableCell>
              <TableCell>Login time</TableCell>
              <TableCell>IP</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.id}</TableCell>
                <TableCell>{log.username}</TableCell>
                <TableCell>{formatLoginTime(log.loginTime)}</TableCell>
                <TableCell>{log.ipAddress}</TableCell>
                <TableCell>{log.status}</TableCell>
              </TableRow>
            ))}
            
            {/* 如果沒有資料的提示 */}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No login records
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* --- 分頁控制按鈕區塊 --- */}
      {logs.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handlePrevPage} 
            disabled={currentPage === 1}
          >
            Previous Page
          </Button>
          
          <Typography variant="body1">
             {currentPage} page / taotal {totalPages} pages
          </Typography>
          
          <Button 
            variant="outlined" 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages}
          >
            Next page
          </Button>
        </Box>
      )}
   </Box>
  );
}