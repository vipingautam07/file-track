import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { extractError } from '../lib/constants';

const schema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'bank_member', 'customer']),
  phone: z.string().optional(),
  password: z.string().optional(),
}).refine((d) => {
  if (d.role !== 'customer' && (!d.password || d.password.length < 8)) {
    return false;
  }
  return true;
}, { message: 'Password required (min 8 chars) for admin/bank users', path: ['password'] });

export default function CreateUserModal({ onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'customer' },
  });
  const role = watch('role');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/users', data);
      toast.success('User created successfully');
      onCreated();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add New User</h2>
          <button className="btn btn-ghost p-2" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Role <span className="text-red-400">*</span></label>
            <select {...register('role')} className="form-input form-select">
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="bank_member">Bank Member</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name <span className="text-red-400">*</span></label>
              <input {...register('fullName')} className={`form-input ${errors.fullName ? 'error' : ''}`} placeholder="Full name" />
              {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input {...register('phone')} className="form-input" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div>
            <label className="form-label">Email <span className="text-red-400">*</span></label>
            <input {...register('email')} type="email" className={`form-input ${errors.email ? 'error' : ''}`} placeholder="user@example.com" />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>

          {role !== 'customer' && (
            <div>
              <label className="form-label">Password <span className="text-red-400">*</span></label>
              <input {...register('password')} type="password" className={`form-input ${errors.password ? 'error' : ''}`} placeholder="Min 8 characters" />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>
          )}

          {role === 'customer' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              Customer accounts use magic links for access. No password required.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
