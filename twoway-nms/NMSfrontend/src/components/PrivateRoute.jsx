import { Navigate, Outlet } from 'react-router-dom';

export default function PrivateRoute() {
  // 檢查 localStorage 中是否存在 token
  // (這只是前端的初步防護，真正的安全性依然由後端 Spring Security 把關)
  const token = localStorage.getItem('token');

  // 如果有 token，渲染包在裡面的子路由 (<Outlet />)
  // 如果沒有 token，導向 /login，並使用 replace 替換歷史紀錄 (避免按上一頁又跳回來)
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}