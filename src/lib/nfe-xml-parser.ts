import type { DanfeHeader, DanfeLinha, DanfeDuplicata, DanfeResult } from '@/types/database'

/**
 * Parse NFe XML (v4.0) into DanfeResult using native DOMParser.
 * Zero external dependencies.
 */
export function parseNFeXml(xmlString: string): DanfeResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  // Handle parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Erro ao parsear XML da NFe: ' + parseError.textContent)
  }

  // Helper to get text content from first matching element
  const txt = (parent: Element | Document, tag: string): string => {
    const el = parent.getElementsByTagName(tag)[0]
    return el?.textContent?.trim() ?? ''
  }

  const num = (parent: Element | Document, tag: string): number => {
    const v = txt(parent, tag)
    return v ? Number(v) : 0
  }

  // Find main NFe node
  const nfe = doc.getElementsByTagName('NFe')[0] ?? doc.getElementsByTagName('nfeProc')[0]
  if (!nfe) throw new Error('XML não contém elemento NFe válido')

  const infNFe = nfe.getElementsByTagName('infNFe')[0]
  if (!infNFe) throw new Error('XML não contém infNFe')

  // === IDE (Identificação) ===
  const ide = infNFe.getElementsByTagName('ide')[0]

  // === EMIT (Emitente) ===
  const emit = infNFe.getElementsByTagName('emit')[0]
  const emitEnder = emit?.getElementsByTagName('enderEmit')[0]

  // === DEST (Destinatário) ===
  const dest = infNFe.getElementsByTagName('dest')[0]
  const destEnder = dest?.getElementsByTagName('enderDest')[0]

  // === TOTAL ===
  const total = infNFe.getElementsByTagName('total')[0]
  const icmsTot = total?.getElementsByTagName('ICMSTot')[0]

  // === TRANSP (Transporte) ===
  const transp = infNFe.getElementsByTagName('transp')[0]
  const transporta = transp?.getElementsByTagName('transporta')[0]
  const veicTransp = transp?.getElementsByTagName('veicTransp')[0]
  const volumes = transp?.getElementsByTagName('vol')

  // === COBR (Cobrança) / DUP (Duplicatas) ===
  const cobr = infNFe.getElementsByTagName('cobr')[0]
  const dups = cobr?.getElementsByTagName('dup') ?? []

  // === INFADIC (Informações Adicionais) ===
  const infAdic = infNFe.getElementsByTagName('infAdic')[0]

  // === PROTNFE (Protocolo de Autorização) ===
  const protNFe = doc.getElementsByTagName('protNFe')[0]
  const infProt = protNFe?.getElementsByTagName('infProt')[0]

  // Extract chave de acesso from infNFe Id attribute
  const chaveNFe = (infNFe.getAttribute('Id') ?? '').replace(/^NFe/, '')

  // Build emitente address
  const emitEndParts = emitEnder ? [
    txt(emitEnder, 'xLgr'),
    txt(emitEnder, 'nro'),
    txt(emitEnder, 'xBairro'),
    txt(emitEnder, 'xMun'),
    txt(emitEnder, 'UF'),
    txt(emitEnder, 'CEP'),
  ].filter(Boolean) : []

  // Frete modalidade
  const modFrete = transp ? txt(transp, 'modFrete') : ''
  const freteMap: Record<string, string> = {
    '0': '0 - Emitente',
    '1': '1 - Destinatario',
    '2': '2 - Terceiros',
    '9': '9 - Sem Frete',
  }

  // Volume info (first vol element)
  const vol0 = volumes?.[0]

  const header: DanfeHeader = {
    DocEntry: 0,
    DocNum: num(ide, 'nNF'),
    ChaveNFe: chaveNFe,
    NFNum: txt(ide, 'nNF'),
    Serie: txt(ide, 'serie'),
    DocDate: formatXmlDate(txt(ide, 'dhEmi')),
    DocDueDate: formatXmlDate(txt(ide, 'dhSaiEnt') || txt(ide, 'dhEmi')),
    DocTotal: num(icmsTot, 'vNF'),
    VatSum: num(icmsTot, 'vICMS'),
    DiscSum: num(icmsTot, 'vDesc'),
    TotalExpns: num(icmsTot, 'vFrete'),
    Comments: '',
    NaturezaOp: txt(ide, 'natOp'),
    NumAtCard: '',
    Address2: '',
    // Emitente
    CNPJ_Emitente: txt(emit, 'CNPJ'),
    IE_Emitente: txt(emit, 'IE'),
    RazaoSocial_Emitente: txt(emit, 'xNome'),
    Endereco_Emitente: emitEndParts.join(', '),
    // Destinatário
    CardCode: '',
    CardName: txt(dest, 'xNome'),
    CNPJ_Destinatario: txt(dest, 'CNPJ') || txt(dest, 'CPF'),
    IE_Destinatario: txt(dest, 'IE'),
    Fone_Destinatario: destEnder ? txt(destEnder, 'fone') : '',
    Rua: destEnder ? txt(destEnder, 'xLgr') : '',
    Bairro: destEnder ? txt(destEnder, 'xBairro') : '',
    Cidade: destEnder ? txt(destEnder, 'xMun') : '',
    UF: destEnder ? txt(destEnder, 'UF') : '',
    CEP: destEnder ? txt(destEnder, 'CEP') : '',
    Numero: destEnder ? txt(destEnder, 'nro') : '',
    // Transporte
    Transportadora: transporta ? txt(transporta, 'xNome') : '',
    FreteModalidade: freteMap[modFrete] ?? modFrete,
    PlacaVeiculo: veicTransp ? txt(veicTransp, 'placa') : '',
    UF_Veiculo: veicTransp ? txt(veicTransp, 'UF') : '',
    RNTC: veicTransp ? txt(veicTransp, 'RNTC') : '',
    VolumesQtd: vol0 ? num(vol0, 'qVol') : 0,
    VolumesEspecie: vol0 ? txt(vol0, 'esp') : '',
    PesoLiquido: vol0 ? num(vol0, 'pesoL') : 0,
    PesoBruto: vol0 ? num(vol0, 'pesoB') : 0,
    // Totais
    TotalProdutos: num(icmsTot, 'vProd'),
    BaseICMS: num(icmsTot, 'vBC'),
    ValorICMS: num(icmsTot, 'vICMS'),
    ICMS_ST_Base: num(icmsTot, 'vBCST'),
    ICMS_ST_Valor: num(icmsTot, 'vST'),
    PIS_Total: num(icmsTot, 'vPIS'),
    COFINS_Total: num(icmsTot, 'vCOFINS'),
    IPI_Total: num(icmsTot, 'vIPI'),
    // Protocolo
    ProtocoloAutorizacao: infProt ? txt(infProt, 'nProt') : '',
    DataAutorizacao: infProt ? formatXmlDate(txt(infProt, 'dhRecbto')) : '',
    // Info complementar
    InfoComplementar: infAdic ? txt(infAdic, 'infCpl') : '',
  }

  // === DET (Itens) ===
  const detElements = infNFe.getElementsByTagName('det')
  const lines: DanfeLinha[] = []

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i]
    const prod = det.getElementsByTagName('prod')[0]
    const imposto = det.getElementsByTagName('imposto')[0]

    // ICMS — can be in various sub-elements (ICMS00, ICMS10, ICMS20, etc.)
    const icmsGroup = imposto?.getElementsByTagName('ICMS')[0]
    const icmsEl = icmsGroup ? findFirstChild(icmsGroup) : null

    // PIS
    const pisGroup = imposto?.getElementsByTagName('PIS')[0]
    const pisEl = pisGroup ? findFirstChild(pisGroup) : null

    // COFINS
    const cofinsGroup = imposto?.getElementsByTagName('COFINS')[0]
    const cofinsEl = cofinsGroup ? findFirstChild(cofinsGroup) : null

    // IPI
    const ipiGroup = imposto?.getElementsByTagName('IPI')[0]
    const ipiEl = ipiGroup ? (ipiGroup.getElementsByTagName('IPITrib')[0] ?? null) : null

    lines.push({
      ItemCode: txt(prod, 'cProd'),
      Dscription: txt(prod, 'xProd'),
      NCM: txt(prod, 'NCM'),
      Unidade: txt(prod, 'uCom'),
      CFOP: txt(prod, 'CFOP'),
      CST: icmsEl ? (txt(icmsEl, 'orig') + txt(icmsEl, 'CST') || txt(icmsEl, 'CSOSN')) : '',
      Quantity: num(prod, 'qCom'),
      Price: num(prod, 'vUnCom'),
      LineTotal: num(prod, 'vProd'),
      ICMS_Base: icmsEl ? num(icmsEl, 'vBC') : 0,
      ICMS_Valor: icmsEl ? num(icmsEl, 'vICMS') : 0,
      ICMS_Aliq: icmsEl ? num(icmsEl, 'pICMS') : 0,
      PIS_Valor: pisEl ? num(pisEl, 'vPIS') : 0,
      PIS_Aliq: pisEl ? num(pisEl, 'pPIS') : 0,
      COFINS_Valor: cofinsEl ? num(cofinsEl, 'vCOFINS') : 0,
      COFINS_Aliq: cofinsEl ? num(cofinsEl, 'pCOFINS') : 0,
      IPI_Valor: ipiEl ? num(ipiEl, 'vIPI') : 0,
      IPI_Aliq: ipiEl ? num(ipiEl, 'pIPI') : 0,
      ICMS_ST_Valor: icmsEl ? num(icmsEl, 'vICMSST') : 0,
    })
  }

  // === Duplicatas ===
  const installments: DanfeDuplicata[] = []
  for (let i = 0; i < dups.length; i++) {
    const dup = dups[i]
    installments.push({
      Parcela: i + 1,
      Vencimento: txt(dup, 'dVenc'),
      Valor: num(dup, 'vDup'),
    })
  }

  return { header: [header], lines, installments }
}

/** Find first child element (not text node) */
function findFirstChild(parent: Element): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].nodeType === 1) return parent.children[i]
  }
  return null
}

/** Convert XML datetime (2024-01-15T10:30:00-03:00) to ISO date string */
function formatXmlDate(dt: string): string {
  if (!dt) return ''
  // Return just the date part for simple date fields
  return dt.substring(0, 10)
}
