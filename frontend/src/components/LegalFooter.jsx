export default function LegalFooter({ className = '' }) {
  return (
    <footer className={`border-t border-slate-100 bg-white ${className}`}>
      {/* Lawyers Contact Strip */}
      <div className="border-b border-slate-100 px-4 py-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 text-center">
            Legal Representatives
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8 flex-wrap">
            {/* Lawyer 1 */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-slate-600">PS</span>
              </div>
              <div>
                <p className="text-md font-bold text-slate-800 leading-tight">Pankaj Shrivastava</p>
                <p className="text-xs text-slate-600 mt-0.5">Advocate &amp; Legal Consultant</p>
                <a href="tel:9826992948" className="text-md text-blue-600 font-semibold hover:text-blue-700 transition-colors mt-0.5 inline-block">
                  📞 9826992948
                </a>
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-slate-100" />

            {/* Lawyer 2 */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-slate-600">NK</span>
              </div>
              <div>
                <p className="text-md font-bold text-slate-800 leading-tight">Nitin Katare</p>
                <p className="text-xs text-slate-600 mt-0.5">Advocate &amp; Legal Consultant</p>
                <a href="tel:8319954272" className="text-md text-blue-600 font-semibold hover:text-blue-700 transition-colors mt-0.5 inline-block">
                  📞 8319954272
                </a>
              </div>
            </div>
          </div>
          <p className="text-center text-[12px] text-slate-600 mt-4">
            📍 Shop No. 8, JSM Tower, opposite HP Petrol Pump, Beema Kunj, Bhopal
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="text-center text-slate-400 py-4 space-y-1">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <p className="font-bold text-md text-slate-500 flex items-center gap-1.5">
            <img src="/logo.jpg" alt="Logo" className="w-3.5 h-3.5 object-contain" />
            Kripanidhi Legal Services Pvt Ltd
          </p>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <p className="font-bold text-md text-slate-500">Chitransh Law Services</p>
        </div>
        <p className="text-sm">Serving Banking Partners &amp; Financial Institutions</p>
      </div>
    </footer>
  );
}
