import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import type { DanfeHeader, DanfeLinha, DanfeDuplicata } from '@/types/database'

function fmtDate(d: string) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy') } catch { return d }
}

function fmtCnpj(v: string) {
  if (!v || v.length < 14) return v || '—'
  const digits = v.replace(/\D/g, '')
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return v
}

function fmtCep(v: string) {
  if (!v) return '—'
  const digits = v.replace(/\D/g, '')
  if (digits.length === 8) return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  return v
}

function formatChaveNFe(chave: string): string {
  if (!chave) return ''
  return chave.replace(/(\d{4})/g, '$1 ').trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildDanfeHtml(
  header: DanfeHeader,
  lines: DanfeLinha[],
  installments: DanfeDuplicata[],
  barcodeSvg: string
): string {
  const fmtCur = (v: number) => formatCurrency(v)
  const totalProdutos = header.TotalProdutos || lines.reduce((s, l) => s + (l.LineTotal || 0), 0)
  const enderecoDestinatario = [header.Rua, header.Numero, header.Bairro, header.Cidade, header.UF, fmtCep(header.CEP)]
    .filter(Boolean).join(', ')

  const hasTransportDetails = !!(header.PlacaVeiculo || header.VolumesQtd || header.PesoLiquido || header.PesoBruto)

  const duplicatasHtml = installments.length > 0
    ? installments.map(d =>
      `<div class="dup-item">
        <span class="dup-num">${d.Parcela}</span>
        <span class="dup-date">${fmtDate(d.Vencimento)}</span>
        <span class="dup-val">${fmtCur(d.Valor)}</span>
      </div>`
    ).join('')
    : '<div class="dup-item"><span>Sem duplicatas</span></div>'

  // Build product columns based on available data
  const hasIpiCol = lines.some(l => (l.IPI_Valor || 0) > 0)

  const linhasHtml = lines.map(l => `
    <tr>
      <td>${escapeHtml(l.ItemCode)}</td>
      <td class="desc">${escapeHtml(l.Dscription)}</td>
      <td class="center">${escapeHtml(l.NCM || '')}</td>
      <td class="center">${escapeHtml(l.CST || '')}</td>
      <td class="center">${escapeHtml(l.CFOP || '')}</td>
      <td class="center">${escapeHtml(l.Unidade || '')}</td>
      <td class="right">${l.Quantity}</td>
      <td class="right">${fmtCur(l.Price)}</td>
      <td class="right">${fmtCur(l.LineTotal)}</td>
      <td class="right">${fmtCur(l.ICMS_Valor || 0)}</td>
      <td class="right">${l.ICMS_Aliq ? l.ICMS_Aliq.toFixed(2) + '%' : ''}</td>
      ${hasIpiCol ? `<td class="right">${fmtCur(l.IPI_Valor || 0)}</td>` : ''}
    </tr>
  `).join('')

  // Info complementar: combine XML infCpl + Comments + NumAtCard
  const infoLines: string[] = []
  if (header.InfoComplementar) infoLines.push(header.InfoComplementar)
  if (header.Comments) infoLines.push(header.Comments)
  if (header.NumAtCard) infoLines.push('Pedido Cliente: ' + header.NumAtCard)
  const infoComplementarText = infoLines.join('\n')

  // Protocolo de autorização
  const protocoloHtml = header.ProtocoloAutorizacao
    ? `<div class="danfe-protocolo">
        <span class="label">Protocolo de Autorizacao de Uso: </span>
        <span class="value">${escapeHtml(header.ProtocoloAutorizacao)} - ${fmtDate(header.DataAutorizacao)}</span>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>DANFE - NF ${header.NFNum}</title>
<style>
  @page { size: A4; margin: 5mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #000; }

  .danfe { width: 190mm; margin: 0 auto; border: 1.5px solid #000; }

  /* --- HEADER --- */
  .danfe-top { display: flex; border-bottom: 1.5px solid #000; }
  .danfe-top-emitente { flex: 1; border-right: 1.5px solid #000; padding: 4px 6px; }
  .danfe-top-emitente .razao { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
  .danfe-top-emitente .info { font-size: 7px; line-height: 1.4; }

  .danfe-top-center { width: 60mm; border-right: 1.5px solid #000; padding: 4px 6px; text-align: center; }
  .danfe-top-center .danfe-title { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
  .danfe-top-center .danfe-desc { font-size: 7px; margin-bottom: 4px; }
  .danfe-top-center .nf-num { font-size: 14px; font-weight: 700; }
  .danfe-top-center .nf-serie { font-size: 9px; margin-top: 2px; }
  .danfe-top-center .entry-exit { font-size: 8px; margin-top: 4px; }
  .danfe-top-center .entry-exit .box { display: inline-block; border: 1px solid #000; width: 14px; height: 14px; line-height: 14px; font-weight: 700; font-size: 10px; }

  .danfe-top-barcode { width: 60mm; padding: 4px 6px; text-align: center; }
  .danfe-top-barcode svg { width: 100%; height: 30px; }

  /* --- CHAVE --- */
  .danfe-chave { border-bottom: 1.5px solid #000; padding: 3px 6px; text-align: center; }
  .danfe-chave .label { font-size: 7px; font-weight: 600; text-transform: uppercase; color: #333; }
  .danfe-chave .value { font-size: 9px; font-family: 'Courier New', monospace; letter-spacing: 1.5px; margin-top: 1px; }

  /* --- PROTOCOLO --- */
  .danfe-protocolo { border-bottom: 1.5px solid #000; padding: 3px 6px; text-align: center; }
  .danfe-protocolo .label { font-size: 7px; font-weight: 600; text-transform: uppercase; color: #333; }
  .danfe-protocolo .value { font-size: 8px; font-family: 'Courier New', monospace; }

  /* --- NATUREZA --- */
  .danfe-natureza { border-bottom: 1.5px solid #000; padding: 3px 6px; display: flex; gap: 8px; }
  .danfe-natureza .field { flex: 1; }
  .danfe-natureza .field .lbl { font-size: 6px; color: #333; text-transform: uppercase; }
  .danfe-natureza .field .val { font-size: 8px; font-weight: 600; }

  /* --- DESTINATARIO --- */
  .danfe-dest { border-bottom: 1.5px solid #000; }
  .danfe-dest .section-title { font-size: 7px; font-weight: 700; background: #e8e8e8; padding: 2px 6px; text-transform: uppercase; border-bottom: 1px solid #000; }
  .danfe-dest .fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
  .danfe-dest .field { padding: 2px 6px; border-right: 1px solid #000; border-bottom: 1px solid #000; }
  .danfe-dest .field:last-child { border-right: none; }
  .danfe-dest .field.wide { grid-column: span 2; }
  .danfe-dest .field.full { grid-column: span 3; }
  .danfe-dest .field .lbl { font-size: 6px; color: #333; text-transform: uppercase; }
  .danfe-dest .field .val { font-size: 8px; font-weight: 500; }

  /* --- IMPOSTOS --- */
  .danfe-impostos { border-bottom: 1.5px solid #000; }
  .danfe-impostos .section-title { font-size: 7px; font-weight: 700; background: #e8e8e8; padding: 2px 6px; text-transform: uppercase; border-bottom: 1px solid #000; }
  .danfe-impostos .fields { display: flex; flex-wrap: wrap; }
  .danfe-impostos .field { flex: 1; min-width: 0; padding: 2px 6px; border-right: 1px solid #000; text-align: right; }
  .danfe-impostos .field:last-child { border-right: none; }
  .danfe-impostos .field .lbl { font-size: 6px; color: #333; text-transform: uppercase; text-align: left; }
  .danfe-impostos .field .val { font-size: 9px; font-weight: 600; }
  .danfe-impostos .row2 { border-top: 1px solid #000; }

  /* --- TRANSPORTE --- */
  .danfe-transporte { border-bottom: 1.5px solid #000; }
  .danfe-transporte .section-title { font-size: 7px; font-weight: 700; background: #e8e8e8; padding: 2px 6px; text-transform: uppercase; border-bottom: 1px solid #000; }
  .danfe-transporte .fields { display: flex; }
  .danfe-transporte .field { flex: 1; padding: 2px 6px; border-right: 1px solid #000; }
  .danfe-transporte .field:last-child { border-right: none; }
  .danfe-transporte .field .lbl { font-size: 6px; color: #333; text-transform: uppercase; }
  .danfe-transporte .field .val { font-size: 8px; font-weight: 500; }
  .danfe-transporte .row2 { border-top: 1px solid #000; }

  /* --- PRODUTOS --- */
  .danfe-produtos { border-bottom: 1.5px solid #000; }
  .danfe-produtos .section-title { font-size: 7px; font-weight: 700; background: #e8e8e8; padding: 2px 6px; text-transform: uppercase; border-bottom: 1px solid #000; }
  .danfe-produtos table { border-collapse: collapse; width: 100%; }
  .danfe-produtos th { font-size: 6.5px; font-weight: 700; text-transform: uppercase; padding: 2px 3px; border-bottom: 1px solid #000; border-right: 1px solid #ccc; text-align: left; background: #f5f5f5; }
  .danfe-produtos th:last-child { border-right: none; }
  .danfe-produtos td { font-size: 7.5px; padding: 1.5px 3px; border-bottom: 1px solid #ddd; border-right: 1px solid #eee; }
  .danfe-produtos td:last-child { border-right: none; }
  .danfe-produtos td.right, .danfe-produtos th.right { text-align: right; }
  .danfe-produtos td.center, .danfe-produtos th.center { text-align: center; }
  .danfe-produtos td.desc { max-width: 45mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .danfe-produtos tr:last-child td { border-bottom: none; }

  /* --- FOOTER (dados adicionais + duplicatas) --- */
  .danfe-footer { display: flex; }
  .danfe-footer-info { flex: 1; border-right: 1.5px solid #000; padding: 4px 6px; min-height: 30mm; }
  .danfe-footer-info .section-title { font-size: 7px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
  .danfe-footer-info .content { font-size: 7.5px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }

  .danfe-footer-dup { width: 65mm; padding: 4px 6px; }
  .danfe-footer-dup .section-title { font-size: 7px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
  .dup-item { display: flex; justify-content: space-between; font-size: 7.5px; padding: 1px 0; border-bottom: 1px dotted #ccc; }
  .dup-item:last-child { border-bottom: none; }
  .dup-num { width: 20px; font-weight: 600; }
  .dup-date { flex: 1; text-align: center; }
  .dup-val { font-weight: 600; text-align: right; }

  @media print {
    body { margin: 0; }
    .danfe { border-width: 1px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="danfe">

  <!-- HEADER: Emitente | DANFE info | Barcode -->
  <div class="danfe-top">
    <div class="danfe-top-emitente">
      <div class="razao">${escapeHtml(header.RazaoSocial_Emitente || '—')}</div>
      <div class="info">
        ${escapeHtml(header.Endereco_Emitente || '')}<br>
        CNPJ: ${fmtCnpj(header.CNPJ_Emitente)} &nbsp; IE: ${escapeHtml(header.IE_Emitente || '—')}
      </div>
    </div>
    <div class="danfe-top-center">
      <div class="danfe-title">DANFE</div>
      <div class="danfe-desc">Documento Auxiliar da<br>Nota Fiscal Eletronica</div>
      <div class="entry-exit">
        <span class="box">1</span> SAIDA
      </div>
      <div class="nf-num">N&ordm; ${escapeHtml(String(header.NFNum))}</div>
      <div class="nf-serie">SERIE ${escapeHtml(header.Serie)}</div>
    </div>
    <div class="danfe-top-barcode">
      ${barcodeSvg || '<div style="font-size:7px;color:#999;margin-top:10px;">Sem codigo de barras</div>'}
      <div style="font-size:6.5px; margin-top:2px; font-family: 'Courier New', monospace; letter-spacing: 1px; word-break: break-all;">
        ${formatChaveNFe(header.ChaveNFe)}
      </div>
    </div>
  </div>

  <!-- CHAVE DE ACESSO -->
  ${header.ChaveNFe ? `
  <div class="danfe-chave">
    <span class="label">Chave de Acesso: </span>
    <span class="value">${formatChaveNFe(header.ChaveNFe)}</span>
  </div>` : ''}

  <!-- PROTOCOLO DE AUTORIZACAO -->
  ${protocoloHtml}

  <!-- NATUREZA DA OPERACAO -->
  <div class="danfe-natureza">
    <div class="field" style="flex:2">
      <div class="lbl">Natureza da Operacao</div>
      <div class="val">${escapeHtml(header.NaturezaOp || 'Venda de Mercadoria')}</div>
    </div>
    <div class="field">
      <div class="lbl">Data de Emissao</div>
      <div class="val">${fmtDate(header.DocDate)}</div>
    </div>
    <div class="field">
      <div class="lbl">Data de Saida</div>
      <div class="val">${fmtDate(header.DocDueDate || header.DocDate)}</div>
    </div>
  </div>

  <!-- DESTINATARIO / REMETENTE -->
  <div class="danfe-dest">
    <div class="section-title">Destinatario / Remetente</div>
    <div class="fields">
      <div class="field wide">
        <div class="lbl">Nome / Razao Social</div>
        <div class="val">${escapeHtml(header.CardName || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">CNPJ / CPF</div>
        <div class="val">${fmtCnpj(header.CNPJ_Destinatario)}</div>
      </div>
      <div class="field wide">
        <div class="lbl">Endereco</div>
        <div class="val">${escapeHtml(enderecoDestinatario || header.Address2 || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">Inscricao Estadual</div>
        <div class="val">${escapeHtml(header.IE_Destinatario || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">Municipio</div>
        <div class="val">${escapeHtml(header.Cidade || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">UF</div>
        <div class="val">${escapeHtml(header.UF || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">CEP</div>
        <div class="val">${fmtCep(header.CEP)}</div>
      </div>
    </div>
  </div>

  <!-- CALCULO DO IMPOSTO -->
  <div class="danfe-impostos">
    <div class="section-title">Calculo do Imposto</div>
    <div class="fields">
      <div class="field">
        <div class="lbl">Base de Calculo ICMS</div>
        <div class="val">${fmtCur(header.BaseICMS || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor do ICMS</div>
        <div class="val">${fmtCur(header.ValorICMS || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Base ICMS ST</div>
        <div class="val">${fmtCur(header.ICMS_ST_Base || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor ICMS ST</div>
        <div class="val">${fmtCur(header.ICMS_ST_Valor || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor Total dos Produtos</div>
        <div class="val">${fmtCur(totalProdutos)}</div>
      </div>
    </div>
    <div class="fields row2">
      <div class="field">
        <div class="lbl">Valor do Frete</div>
        <div class="val">${fmtCur(header.TotalExpns || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor do IPI</div>
        <div class="val">${fmtCur(header.IPI_Total || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor do PIS</div>
        <div class="val">${fmtCur(header.PIS_Total || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor do COFINS</div>
        <div class="val">${fmtCur(header.COFINS_Total || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Desconto</div>
        <div class="val">${fmtCur(header.DiscSum || 0)}</div>
      </div>
      <div class="field">
        <div class="lbl">Valor Total da NF</div>
        <div class="val">${fmtCur(header.DocTotal)}</div>
      </div>
    </div>
  </div>

  <!-- TRANSPORTADOR / VOLUMES -->
  <div class="danfe-transporte">
    <div class="section-title">Transportador / Volumes Transportados</div>
    <div class="fields">
      <div class="field" style="flex:2">
        <div class="lbl">Razao Social</div>
        <div class="val">${escapeHtml(header.Transportadora || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">Frete por Conta</div>
        <div class="val">${escapeHtml(header.FreteModalidade || 'Emitente')}</div>
      </div>
      <div class="field">
        <div class="lbl">Placa Veiculo</div>
        <div class="val">${escapeHtml(header.PlacaVeiculo || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">UF</div>
        <div class="val">${escapeHtml(header.UF_Veiculo || '—')}</div>
      </div>
    </div>
    ${hasTransportDetails ? `
    <div class="fields row2">
      <div class="field">
        <div class="lbl">Quantidade</div>
        <div class="val">${header.VolumesQtd || '—'}</div>
      </div>
      <div class="field">
        <div class="lbl">Especie</div>
        <div class="val">${escapeHtml(header.VolumesEspecie || '—')}</div>
      </div>
      <div class="field">
        <div class="lbl">Peso Bruto (kg)</div>
        <div class="val">${header.PesoBruto ? header.PesoBruto.toFixed(3) : '—'}</div>
      </div>
      <div class="field">
        <div class="lbl">Peso Liquido (kg)</div>
        <div class="val">${header.PesoLiquido ? header.PesoLiquido.toFixed(3) : '—'}</div>
      </div>
    </div>` : ''}
  </div>

  <!-- PRODUTOS / SERVICOS -->
  <div class="danfe-produtos">
    <div class="section-title">Dados dos Produtos / Servicos</div>
    <table>
      <thead>
        <tr>
          <th>Codigo</th>
          <th>Descricao do Produto</th>
          <th class="center">NCM/SH</th>
          <th class="center">CST</th>
          <th class="center">CFOP</th>
          <th class="center">UN</th>
          <th class="right">QTD</th>
          <th class="right">Vl. Unit.</th>
          <th class="right">Vl. Total</th>
          <th class="right">Vl. ICMS</th>
          <th class="right">Aliq. ICMS</th>
          ${hasIpiCol ? '<th class="right">Vl. IPI</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${linhasHtml}
      </tbody>
    </table>
  </div>

  <!-- DADOS ADICIONAIS + DUPLICATAS -->
  <div class="danfe-footer">
    <div class="danfe-footer-info">
      <div class="section-title">Dados Adicionais</div>
      <div class="content">${escapeHtml(infoComplementarText)}</div>
    </div>
    <div class="danfe-footer-dup">
      <div class="section-title">Duplicatas</div>
      ${duplicatasHtml}
    </div>
  </div>

</div>
</body>
</html>`
}
