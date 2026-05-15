import type { SelectHTMLAttributes } from 'react'

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" {...props} />
}
