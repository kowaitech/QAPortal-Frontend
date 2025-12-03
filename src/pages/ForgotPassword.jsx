import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../utils/axios';
import { useDialog } from '../components/DialogProvider';

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialog = useDialog();

  const onSubmit = async (v) => {
    setIsSubmitting(true);
    try {
      await api.post('/auth/request-reset-otp', { email: v.email });
      setSent(true);
    } catch (e) {
      dialog.alert(e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] grid place-items-center">
      <div className="max-w-md w-full card bg-white/90">
        <h2 className="text-xl mb-4">Forgot Password</h2>
        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <input
            className="input"
            placeholder="Email"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
        {sent && (
          <div className="mt-4 text-sm">
            OTP sent if the email exists. <a className="text-blue-600 hover:underline" href="/reset-password">Reset Password</a>
          </div>
        )}
        <div className="mt-4 text-sm">
          <a className="text-[#552e81] hover:underline" href="/login">Back to login</a>
        </div>
      </div>
    </div>
  );
}


