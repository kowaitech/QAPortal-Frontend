import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../utils/axios';
import { useAuthStore } from '../utils/authStore';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../components/DialogProvider';

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const setAuth = useAuthStore(state => state.setAuth);
  const nav = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dialog = useDialog();

  const onSubmit = async (v) => {
    console.log('Login attempt with:', v);
    setIsSubmitting(true);

    try {
      console.log('Making API call to:', `${api.defaults.baseURL}/auth/login`);
      const { data } = await api.post('/auth/login', v);
      console.log('Login successful:', data);
      setAuth(data.user, data.accessToken);

      // Redirect based on user role
      switch (data.user.role) {
        case 'admin':
          nav('/admin');
          break;
        case 'staff':
          nav('/staff');
          break;
        case 'student':
          nav('/student');
          break;
        default:
          nav('/');
      }
    } catch (e) {
      console.error('Login error:', e);
      console.error('Error response:', e.response);
      const errorMessage = e.response?.data?.message || e.message || 'Login failed';
      console.error('Error details:', {
        status: e.response?.status,
        message: errorMessage,
        data: e.response?.data
      });
      dialog.alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 top-[72px] flex items-center justify-center px-4 py-4 overflow-hidden bg-transparent">
      <div className="w-full max-w-md card bg-white/95 backdrop-blur-sm shadow-xl">
        <div className="mb-6 text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h2>
          <p className="text-xs text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <input
              className="input h-11"
              placeholder="Email"
              type="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="relative">
              <input
                className="input h-11 pr-10"
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m1.17 1.17L3 3m0 0l18 18m-4.29-4.29A9.97 9.97 0 0118.88 18.88M15.71 15.71L3 3m18 18l-3.29-3.29" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.password.message}</p>}
          </div>

          <button
            className="btn-primary w-full h-11 text-base font-semibold mt-2"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a 
            className="text-sm text-[#552e81] hover:text-[#4b2a72] hover:underline transition-colors" 
            href="/forgot-password"
          >
            Forgot password?
          </a>
        </div>

        <div className="mt-4 text-center pt-4 border-t border-gray-100">
          <span className="text-sm text-gray-600">New user? </span>
          <button 
            onClick={() => nav('/register')} 
            className="text-sm font-medium text-[#552e81] hover:text-[#4b2a72] hover:underline transition-colors"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}



