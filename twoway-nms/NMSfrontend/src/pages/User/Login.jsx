import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Box, Typography, Paper } from '@mui/material';
import apiClient from '../../api/axiosClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      
      // 儲存 JWT Token 與使用者資訊
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      navigate('/'); // 登入成功，導向首頁
    } catch (err) {
      setError(err.response?.data || 'Login failed. Please check your credentials');
    }
  };

  return (
<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 2 }}>
        <Typography variant="h5" align="center">System Login</Typography>
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TextField label="Email" placeholder='admin' value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" placeholder='admin' type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" color="primary" fullWidth>Login</Button>
        </form>
      </Paper>
    </Box>
  );
}