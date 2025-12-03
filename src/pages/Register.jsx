import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/axios';
import { useDialog } from '../components/DialogProvider';

export default function Register() {
  const { register, handleSubmit } = useForm({ defaultValues: { role: 'student' } });
  const nav = useNavigate();
  const dialog = useDialog();
  const onSubmit = async (v) => {
    try {
      await api.post('/auth/register', v);
      await dialog.alert('Registered — awaiting admin approval');
      nav('/login');
    } catch (e) { dialog.alert(e.response?.data?.message || 'Failed'); }
  };
  return (
    <div className="min-h-[calc(100vh-72px)] grid place-items-center">
      <div className="max-w-md w-full card bg-white/90">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <input className="input" placeholder="Full name" {...register('name')} />
          <input className="input" placeholder="Email" {...register('email')} />
          <input className="input" placeholder="Password" type="password" {...register('password')} />
          <label>Register as</label>
          <select className="input" {...register('role')}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
          <button className="btn-primary" type="submit">Register</button>
        </form>
        <div className="mt-4 text-sm flex items-center justify-between">
          <span className="text-gray-600">Already have an account?</span>
          <button onClick={() => nav('/login')} className="btn-secondary">Login</button>
        </div>
      </div>
    </div>
  );
}
