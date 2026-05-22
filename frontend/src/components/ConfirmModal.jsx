import { X, AlertCircle } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  icon: Icon = AlertCircle
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="modal max-w-md w-full fade-in overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button 
            className="btn btn-ghost p-2" 
            onClick={onClose} 
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button 
            type="button" 
            className="btn btn-secondary text-sm" 
            onClick={onClose} 
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className="btn btn-primary text-sm min-w-[100px]" 
            onClick={onConfirm} 
            disabled={loading}
          >
            {loading ? <span className="spinner w-4 h-4" /> : null}
            {loading ? 'Sending…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
