import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Printer, FileText, Truck, ChevronDown, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/shared/dialog'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { supabase } from '@/lib/supabase'
import { formatCurrency, printContent } from '@/lib/utils'
import JsBarcode from 'jsbarcode'
import { buildDanfeHtml } from '@/components/danfe-template'
import { parseNFeXml } from '@/lib/nfe-xml-parser'
import type { Database, DanfeResult } from '@/types/database'

type Pedido = Database['public']['Tables']['sap_cache_pedidos']['Row']
type CachedLinha = Database['public']['Tables']['sap_cache_pedido_linhas']['Row']

interface PedidoDetalheDialogProps {
  pedido: Pedido | null
  open: boolean
  onClose: () => void
}

interface PrintHeader {
  CardCode: string
  CardName: string
  Vendedor: string
  CondPagamento: string
  DocCur: string
  DocDate: string
  DocDueDate: string
  Address2: string
  Comments: string
}

interface PrintLinha {
  ItemCode: string
  Dscription: string
  Quantity: number
  Price: number
  LineTotal: number
}

function pedidoToHeader(p: Pedido): PrintHeader {
  return {
    CardCode: p.card_code,
    CardName: p.card_name,
    Vendedor: p.vendedor,
    CondPagamento: p.cond_pagamento,
    DocCur: p.doc_cur,
    DocDate: p.doc_date,
    DocDueDate: p.doc_due_date ?? '',
    Address2: p.address2,
    Comments: p.comments,
  }
}

function cachedLinhasToPrint(linhas: CachedLinha[]): PrintLinha[] {
  return linhas.map((l) => ({
    ItemCode: l.item_code,
    Dscription: l.descricao,
    Quantity: Number(l.quantidade),
    Price: Number(l.preco),
    LineTotal: Number(l.total_linha),
  }))
}

function buildPrintHtml(header: PrintHeader, lines: PrintLinha[], totalGeral: number) {
  const fmtDate = (d: string) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'
  const fmtCur = (v: number) => formatCurrency(v)

  const headerHtml = `<div class="header-grid">
    <div><span class="label">Cliente:</span> <span class="value">${header.CardCode} — ${header.CardName}</span></div>
    <div><span class="label">Vendedor:</span> <span class="value">${header.Vendedor || '—'}</span></div>
    <div><span class="label">Cond. Pagamento:</span> <span class="value">${header.CondPagamento || '—'}</span></div>
    <div><span class="label">Moeda:</span> <span class="value">${header.DocCur || 'BRL'}</span></div>
    <div><span class="label">Data Documento:</span> <span class="value">${fmtDate(header.DocDate)}</span></div>
    <div><span class="label">Vencimento:</span> <span class="value">${fmtDate(header.DocDueDate)}</span></div>
    ${header.Address2 ? `<div style="grid-column:span 2"><span class="label">Endereço:</span> <span class="value">${header.Address2}</span></div>` : ''}
    ${header.Comments ? `<div style="grid-column:span 2"><span class="label">Comentários:</span> <span class="value">${header.Comments}</span></div>` : ''}
  </div>`

  const linesHtml = `<table>
    <thead><tr><th>Código</th><th>Descrição</th><th class="right">Qtd</th><th class="right">Preço Unit.</th><th class="right">Total</th></tr></thead>
    <tbody>${lines.map((l) => `<tr><td>${l.ItemCode}</td><td>${l.Dscription}</td><td class="right">${l.Quantity}</td><td class="right">${fmtCur(l.Price)}</td><td class="right">${fmtCur(l.LineTotal)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="4" class="right">Total Geral:</td><td class="right">${fmtCur(totalGeral)}</td></tr></tfoot>
  </table>`

  return headerHtml + linesHtml
}

function generateBarcodeSvg(chaveNFe: string): string {
  if (!chaveNFe || chaveNFe.length < 44) return ''
  try {
    const svgNs = 'http://www.w3.org/2000/svg'
    const svgEl = document.createElementNS(svgNs, 'svg')
    JsBarcode(svgEl, chaveNFe.replace(/\D/g, ''), {
      format: 'CODE128',
      width: 1,
      height: 30,
      displayValue: false,
      margin: 0,
    })
    return svgEl.outerHTML
  } catch {
    return ''
  }
}

type PrintOption = { label: string; icon: typeof FileText; action: () => void }

export function PedidoDetalheDialog({ pedido, open, onClose }: PedidoDetalheDialogProps) {
  // Fetch line items from cache
  const { data: cachedLinhas, isLoading } = useQuery({
    queryKey: ['pedido_linhas', pedido?.doc_entry, pedido?.origem],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sap_cache_pedido_linhas') as any)
        .select('*')
        .eq('doc_entry', pedido!.doc_entry)
        .eq('origem', pedido!.origem)
        .order('line_num')
      if (error) throw error
      return data as CachedLinha[]
    },
    enabled: !!pedido && open,
  })

  const lines = cachedLinhas ? cachedLinhasToPrint(cachedLinhas) : []
  const totalGeral = lines.reduce((sum, l) => sum + (l.LineTotal ?? 0), 0)
  const header = pedido ? pedidoToHeader(pedido) : null

  const origemLabel = pedido?.origem === 'PV' ? 'Pedido' : pedido?.origem === 'NF' ? 'Nota Fiscal' : 'Entrega'
  const title = `${origemLabel} ${pedido?.doc_num ?? ''}`

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [printLoading, setPrintLoading] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Close dropdown when dialog closes
  useEffect(() => {
    if (!open) {
      setDropdownOpen(false)
      setPrintLoading(null)
    }
  }, [open])

  const handlePrintCurrentDoc = () => {
    if (!header) return
    printContent(title, buildPrintHtml(header, lines, totalGeral))
  }

  const handlePrintOtherDoc = async (docEntry: number, origem: 'PV' | 'NF' | 'EN', docLabel: string) => {
    const win = window.open('', '_blank')
    setPrintLoading(origem)
    setDropdownOpen(false)

    try {
      // Fetch header from sap_cache_pedidos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: headerRows, error: hErr } = await (supabase.from('sap_cache_pedidos') as any)
        .select('*')
        .eq('doc_entry', docEntry)
        .eq('origem', origem)
        .limit(1)
      if (hErr) throw hErr

      // Fetch lines from cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lineRows, error: lErr } = await (supabase.from('sap_cache_pedido_linhas') as any)
        .select('*')
        .eq('doc_entry', docEntry)
        .eq('origem', origem)
        .order('line_num')
      if (lErr) throw lErr

      const otherPedido = (headerRows as Pedido[])?.[0]
      if (!otherPedido) {
        win?.close()
        return
      }

      const otherHeader = pedidoToHeader(otherPedido)
      const otherLines = cachedLinhasToPrint(lineRows as CachedLinha[])
      const total = otherLines.reduce((sum, l) => sum + (l.LineTotal ?? 0), 0)
      printContent(docLabel, buildPrintHtml(otherHeader, otherLines, total), win)
    } catch (err) {
      console.error('Print fetch error:', err)
      win?.close()
    } finally {
      setPrintLoading(null)
    }
  }

  const handlePrintNfFiscal = async (docEntry: number) => {
    const win = window.open('', '_blank')
    setPrintLoading('nf_fiscal')
    setDropdownOpen(false)

    try {
      let danfe: DanfeResult | null = null

      // Try XML-based DANFE first (more complete and faithful to authorized NFe)
      try {
        const { data: xmlResult, error: xmlError } = await supabase.functions.invoke('sap-query', {
          body: { query: 'nfe_xml', params: { docEntry } },
        })
        if (!xmlError && xmlResult?.xml_content) {
          danfe = parseNFeXml(xmlResult.xml_content)
          console.log('DANFE gerado a partir do XML da NFe')
        }
      } catch (xmlErr) {
        console.warn('XML da NFe não disponível, usando fallback SQL:', xmlErr)
      }

      // Fallback: SQL query (danfe_completo)
      if (!danfe) {
        const { data: result, error } = await supabase.functions.invoke('sap-query', {
          body: { query: 'danfe_completo', params: { docEntry } },
        })
        if (error) throw error
        danfe = result as DanfeResult
      }

      const danfeHeader = danfe?.header?.[0]
      if (!danfeHeader) {
        win?.close()
        return
      }

      const barcodeSvg = generateBarcodeSvg(danfeHeader.ChaveNFe)
      const html = buildDanfeHtml(danfeHeader, danfe.lines ?? [], danfe.installments ?? [], barcodeSvg)

      if (win) {
        win.document.write(html)
        win.document.close()
        win.print()
      }
    } catch (err) {
      console.error('DANFE print error:', err)
      win?.close()
    } finally {
      setPrintLoading(null)
    }
  }

  // Build print options based on pedido data
  const printOptions: PrintOption[] = []
  if (pedido) {
    if (pedido.origem === 'PV') {
      printOptions.push({
        label: 'Pedido de Venda',
        icon: FileText,
        action: handlePrintCurrentDoc,
      })
    }

    if (pedido.origem === 'NF') {
      printOptions.push({
        label: 'Nota Fiscal (DANFE)',
        icon: FileText,
        action: () => handlePrintNfFiscal(pedido.doc_entry),
      })
    } else if (pedido.nf_entry) {
      printOptions.push({
        label: 'Nota Fiscal (DANFE)',
        icon: FileText,
        action: () => handlePrintNfFiscal(pedido.nf_entry!),
      })
    }

    if (pedido.origem === 'EN') {
      printOptions.push({
        label: 'Entrega',
        icon: Truck,
        action: handlePrintCurrentDoc,
      })
    } else if (pedido.en_entry) {
      printOptions.push({
        label: 'Entrega',
        icon: Truck,
        action: () => handlePrintOtherDoc(pedido.en_entry!, 'EN', `Entrega ${pedido.doc_num}`),
      })
    }
  }

  const renderPrintButton = () => {
    if (!header || printOptions.length === 0) return null

    if (printOptions.length === 1) {
      const opt = printOptions[0]
      return (
        <button
          onClick={opt.action}
          disabled={!!printLoading}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {printLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          Imprimir {opt.label}
        </button>
      )
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={!!printLoading}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {printLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          Imprimir
          <ChevronDown size={14} />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-border bg-card py-1 shadow-lg">
            {printOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={opt.action}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <opt.icon size={14} className="text-muted-foreground" />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-3xl"
    >
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : header ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            {renderPrintButton()}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{header.CardCode} — {header.CardName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vendedor:</span>
              <p className="font-medium">{header.Vendedor || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cond. Pagamento:</span>
              <p className="font-medium">{header.CondPagamento || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Moeda:</span>
              <p className="font-medium">{header.DocCur || 'BRL'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data Documento:</span>
              <p className="font-medium">{header.DocDate ? format(new Date(header.DocDate), 'dd/MM/yyyy') : '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimento:</span>
              <p className="font-medium">{header.DocDueDate ? format(new Date(header.DocDueDate), 'dd/MM/yyyy') : '—'}</p>
            </div>
            {header.Address2 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Endereço Entrega:</span>
                <p className="font-medium">{header.Address2}</p>
              </div>
            )}
            {header.Comments && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Comentários:</span>
                <p className="font-medium">{header.Comments}</p>
              </div>
            )}
          </div>

          <h3 className="text-sm font-medium text-muted-foreground">Itens</h3>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground">Código</th>
                  <th className="px-3 py-2 text-left text-muted-foreground">Descrição</th>
                  <th className="px-3 py-2 text-right text-muted-foreground">Qtd</th>
                  <th className="px-3 py-2 text-right text-muted-foreground">Preço Unit.</th>
                  <th className="px-3 py-2 text-right text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">{l.ItemCode}</td>
                    <td className="px-3 py-2">{l.Dscription}</td>
                    <td className="px-3 py-2 text-right">{l.Quantity}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l.Price)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l.LineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium">Total Geral:</td>
                  <td className="px-3 py-2 text-right font-bold">{formatCurrency(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum detalhe encontrado.</p>
      )}
    </Dialog>
  )
}
