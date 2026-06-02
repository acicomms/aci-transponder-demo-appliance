import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import MainDashboard from './pages/MainDashboard';
import Login from './pages/User/Login';
import Register from './pages/User/Register';
import PrivateRoute from './components/PrivateRoute';

import { DeviceProvider } from './contexts/DeviceContext';

const MainLayout = ({ children }) => (
  <DeviceProvider>
    <div>
      {children}
    </div>
  </DeviceProvider>
);

export default function App() {
  return (
    <Router>
      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<PrivateRoute />}>
          
          {/* 首頁：顯示設備內容 */}
          <Route path="/" element={
            <MainLayout>
              <MainDashboard view="device" />
            </MainLayout>
          } />

          {/* 使用者管理頁面： MainDashboard  但view變成 users */}
          <Route path="/settings/users" element={
            <MainLayout>
              <MainDashboard view="users" />
            </MainLayout>
          } />

          {/* 登入紀錄頁面： MainDashboard  但view變成 history */}
          <Route path="/settings/history" element={
            <MainLayout>
              <MainDashboard view="history" />
            </MainLayout>
          } />

          {/* Alarms: MainDashboard view="alarms" */}
          <Route path="/alarms" element={
            <MainLayout>
              <MainDashboard view="alarms" />
            </MainLayout>
          } />

          {/* Gateways: MainDashboard view="gateways-list" */}
          <Route path="/gateways" element={
            <MainLayout>
              <MainDashboard view="gateways-list" />
            </MainLayout>
          } />

          {/* Applications: MainDashboard view="applications-list" */}
          <Route path="/applications" element={
            <MainLayout>
              <MainDashboard view="applications-list" />
            </MainLayout>
          } />

        </Route>

        {/* 404  */}
        <Route path="*" element={<Navigate to="/" replace />} />
        
      </Routes>
    </Router>
  );
}