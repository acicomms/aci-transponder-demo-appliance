import { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Button,Box,Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel
} from '@mui/material';
import apiClient from '../../api/axiosClient';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'USER', password: '', active: true });

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch (error) {
      console.error("獲取使用者失敗", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpen = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, role: user.role, password: '', active: user.active });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'USER', password: '', active: true });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, formData);
      } else {
        await apiClient.post('/users', formData);
      }
      setOpen(false);
      fetchUsers();
    } catch (error) {
      alert("failed: " + (error.response?.data || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('confirm to delete？')) {
      try {
        await apiClient.delete(`/users/${id}`);
        fetchUsers();
      } catch (error) {
        alert("delete fail");
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">User Management Settings</Typography>
      <Button variant="contained" color="primary" onClick={() => handleOpen()} sx={{ mb: 2 }}>Add user</Button>
      <Paper sx={{ overflowX: 'auto', width: '100%', borderRadius: 2, boxShadow: 3 }}>
        <Table sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Status (Active)</TableCell>
              <TableCell>Operate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.active ? ' active' : ' unactive'}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleOpen(user)}>Edit</Button>
                  <Button size="small" color="error" onClick={() => handleDelete(user.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>


      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth />
          <TextField label="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} fullWidth disabled={!!editingUser} />
          <TextField label="Permissions (ADMIN/USER)" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} fullWidth />
          <TextField label="Password " type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} fullWidth />
          <FormControlLabel
            control={<Switch checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />}
            label="Account Activation Status"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}