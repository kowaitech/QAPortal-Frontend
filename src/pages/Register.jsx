import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/axios';
import { useDialog } from '../components/DialogProvider';

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors }, control } = useForm({ 
    defaultValues: { role: 'student' } 
  });
  const nav = useNavigate();
  const dialog = useDialog();
  const role = watch('role');
  const isStudent = role === 'student';
  const [mobileNumber, setMobileNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Mobile number validation - exactly 10 digits
  const validateMobileNumber = (value) => {
    if (!value) return true; // Optional field
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      return 'Mobile number must be exactly 10 digits';
    }
    return true;
  };
  
  // Handle mobile number input with +91 prefix
  const handleMobileChange = (e, onChange) => {
    const value = e.target.value;
    // Remove all non-digits
    const digitsOnly = value.replace(/\D/g, '');
    // Limit to 10 digits
    const limitedDigits = digitsOnly.slice(0, 10);
    setMobileNumber(limitedDigits);
    // Update form value
    onChange(limitedDigits);
  };
  
  const onSubmit = async (v) => {
    try {
      // Add +91 prefix to mobile number if provided
      const mobileWithCode = v.mobileNumber ? `+91${v.mobileNumber}` : undefined;
      const payload = {
        ...v,
        mobileNumber: mobileWithCode
      };
      const { data } = await api.post('/auth/register', payload);
      
      // Show role-specific success message
      let successMessage;
      if (v.role === 'student') {
        successMessage = 'Registration successful! You can now login.';
      } else if (v.role === 'staff') {
        successMessage = 'Registration successful! Admin approval is required. You will be able to login once an admin approves your account.';
      } else {
        successMessage = data?.message || 'Registration successful! Awaiting admin approval.';
      }
      
      await dialog.alert(successMessage);
      nav('/login');
    } catch (e) { 
      dialog.alert(e.response?.data?.message || 'Registration failed. Please try again.'); 
    }
  };
  
  return (
    <div className="fixed inset-0 top-[72px] flex items-center justify-center px-4 py-4 overflow-hidden bg-transparent">
      <div className="w-full max-w-2xl card bg-white/95 backdrop-blur-sm shadow-xl max-h-full flex flex-col overflow-hidden">
        <div className="mb-3 text-center space-y-1 flex-shrink-0">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Create your account</h2>
          <p className="text-xs text-gray-600">
            Join the portal to take tests and track your progress.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 min-h-0">
          <form className="space-y-3 pb-2" onSubmit={handleSubmit(onSubmit)}>
          {/* Full Name - Full Width */}
          <div>
            <input 
              className="input h-11" 
              placeholder="Full name" 
              {...register('name', { required: 'Name is required' })} 
            />
            {errors.name && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.name.message}</p>}
          </div>
          
          {/* Email and Password - Two Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input 
                className="input h-11" 
                placeholder="Email" 
                type="email" 
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: emailPattern,
                    message: 'Please enter a valid email address'
                  }
                })} 
              />
              {errors.email && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.email.message}</p>}
            </div>
            
            <div>
              <div className="relative">
                <input 
                  className="input h-11 pr-10" 
                  placeholder="Password" 
                  type={showPassword ? 'text' : 'password'} 
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    }
                  })} 
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
          </div>
          
          {/* College Name - Full Width */}
          <div>
            <input 
              className="input h-11" 
              placeholder="College Name" 
              {...register('collegeName')} 
            />
          </div>
          
          {/* Mobile Number - Full Width with +91 prefix */}
          <div>
            <div className="flex items-stretch">
              <span className="inline-flex items-center px-4 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-gray-700 font-medium text-sm">
                +91
              </span>
              <Controller
                name="mobileNumber"
                control={control}
                rules={{ validate: validateMobileNumber }}
                render={({ field: { onChange } }) => (
                  <input 
                    className="input rounded-l-none flex-1 h-11" 
                    placeholder="Mobile Number (10 digits)" 
                    type="tel" 
                    value={mobileNumber}
                    onChange={(e) => handleMobileChange(e, onChange)}
                    maxLength={10}
                  />
                )}
              />
            </div>
            {errors.mobileNumber && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.mobileNumber.message}</p>}
          </div>
          
          {/* Department and Register as - Two Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input 
                className="input h-11" 
                placeholder="Department" 
                {...register('department')} 
              />
            </div>
            
            <div>
              <select 
                className="input h-11" 
                {...register('role')}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
          
          {/* Year of Passing - Full Width (only for students) */}
          {isStudent && (
            <div>
              <input 
                className="input h-11" 
                placeholder="Year of Passing" 
                type="number" 
                min="2000" 
                max="2100"
                {...register('yearOfPassing', { 
                  valueAsNumber: true,
                  min: {
                    value: 2000,
                    message: 'Year must be 2000 or later'
                  },
                  max: {
                    value: 2100,
                    message: 'Year must be 2100 or earlier'
                  }
                })} 
              />
              {errors.yearOfPassing && <p className="text-red-500 text-xs mt-1.5 ml-1">{errors.yearOfPassing.message}</p>}
            </div>
          )}
          
          {/* Submit Button */}
          <button 
            className="btn-primary w-full h-11 text-base font-semibold mt-4" 
            type="submit"
          >
            Register
          </button>
        </form>
        </div>

        {/* Login Link */}
        <div className="mt-3 text-center flex-shrink-0 pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Already have an account? </span>
          <button 
            onClick={() => nav('/login')} 
            className="text-sm font-medium text-[#552e81] hover:text-[#4b2a72] hover:underline transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
