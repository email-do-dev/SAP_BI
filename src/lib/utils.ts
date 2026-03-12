import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function printContent(title: string, html: string, existingWindow?: Window | null) {
  const win = existingWindow ?? window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #1a1a1a; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }
  th { background: #f5f5f5; text-align: left; font-weight: 600; }
  td.right, th.right { text-align: right; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: 13px; }
  .header-grid .label { color: #666; }
  .header-grid .value { font-weight: 500; }
  .total-row { font-weight: bold; background: #f9f9f9; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${title}</h1>
${html}
</body></html>`)
  win.document.close()
  win.print()
}

/** Filter array by date range. dateField can be 'mes' (yyyy-MM), 'doc_date' (yyyy-MM-dd), or 'due_date' */
export function filterByDateRange<T extends Record<string, unknown>>(
  data: T[],
  dateField: string,
  from: string,
  to: string
): T[] {
  if (!from && !to) return data
  return data.filter((row) => {
    const val = String(row[dateField] ?? '')
    if (!val) return false
    // Normalize: 'yyyy-MM' → 'yyyy-MM-01', 'yyyy-MM-dd' stays as-is
    const normalized = val.length === 7 ? `${val}-01` : val
    if (from && normalized < from) return false
    if (to && normalized > to) return false
    return true
  })
}

/** Compute comparison between current and previous values */
export function computeComparison(current: number, previous: number): { delta: number; pct: number; direction: 'up' | 'down' | 'flat' } {
  const delta = current - previous
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : current > 0 ? 100 : 0
  const direction = delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const
  return { delta, pct: Math.round(pct * 10) / 10, direction }
}

export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; header: string }[],
  filename: string
) {
  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val)
    return str.includes(';') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const header = columns.map((c) => escape(c.header)).join(';')
  const rows = data.map((row) =>
    columns.map((c) => escape(row[c.key])).join(';')
  )
  const csv = [header, ...rows].join('\r\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
