import { useState } from 'react'
import { Button } from './Button'

export function CopyButton({ value, label = '复制' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return <Button type="button" className="bg-slate-900 hover:bg-slate-700" onClick={async () => { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>{copied ? '已复制' : label}</Button>
}
