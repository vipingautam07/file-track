import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

export default function ErrorMessage({
  title = 'Something went wrong',
  message,
  onRetry,
  variant = 'card', // 'card' | 'inline' | 'page'
}) {
  if (!message) return null;

  if (variant === 'inline') {
    return (
      <div className="flex items-start gap-2 text-xs font-semibold text-rose-600 bg-rose-50/50 border border-rose-100 rounded-lg p-2.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span className="flex-1">{message}</span>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 mb-5 shadow-sm">
          <XCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary btn-sm gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="error-card-premium p-4.5 mb-5 flex gap-3.5 items-start bg-rose-50/30 border border-rose-100/80 rounded-xl">
      <div className="w-9 h-9 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center text-rose-500 flex-shrink-0 shadow-xs">
        <AlertTriangle className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 mb-0.5">{title}</h4>
        <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary btn-sm h-8 py-0 px-2.5 rounded-lg flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}
