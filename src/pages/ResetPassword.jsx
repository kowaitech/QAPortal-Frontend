import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../utils/axios';
import { useDialog } from '../components/DialogProvider';

export default function ResetPassword() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialog = useDialog();

  const onSubmit = async (v) => {
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email: v.email, otp: v.otp, newPassword: v.password });
      await dialog.alert('Password reset successful. You can login now.');
      window.location.href = '/login';
    } catch (e) {
      dialog.alert(e.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto card">
      <h2 className="text-xl mb-4">Reset Password</h2>
      <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
        <input className="input" placeholder="Email" {...register('email', { required: 'Email is required' })} />
        {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}

        <input className="input" placeholder="OTP" {...register('otp', { required: 'OTP is required' })} />
        {errors.otp && <span className="text-red-500 text-sm">{errors.otp.message}</span>}

        <input className="input" placeholder="New Password" type="password" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })} />
        {errors.password && <span className="text-red-500 text-sm">{errors.password.message}</span>}

        <input className="input" placeholder="Confirm Password" type="password" {...register('confirm', { validate: val => val === watch('password') || 'Passwords do not match' })} />
        {errors.confirm && <span className="text-red-500 text-sm">{errors.confirm.message}</span>}

        <button className="btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}


