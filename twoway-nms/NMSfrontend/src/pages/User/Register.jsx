import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Box, Typography, Paper } from '@mui/material';
import apiClient from '../../api/axiosClient';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/auth/register', formData);
      alert('Register success! Please log in again.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data || 'login fail');
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 2 }}>
        <Typography variant="h5" align="center">Account Registration</Typography>
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TextField label="Username" required onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <TextField label="Email" type="email" required onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          <TextField label="Password" type="password" required onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
          <Button type="submit" variant="contained" color="primary" fullWidth>submit</Button>
        </form>
        <Button onClick={() => navigate('/login')} color="secondary">return login</Button>
      </Paper>
    </Box>
  );
}