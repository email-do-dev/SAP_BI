import mssql from "npm:mssql@11";

let pool: mssql.ConnectionPool | null = null;

export async function getPool(): Promise<mssql.ConnectionPool> {
  if (pool?.connected) return pool;

  const config: mssql.config = {
    server: Deno.env.get("SAP_MSSQL_HOST")!,
    port: parseInt(Deno.env.get("SAP_MSSQL_PORT") || "1433"),
    database: Deno.env.get("SAP_MSSQL_DATABASE")!,
    user: Deno.env.get("SAP_MSSQL_USER")!,
    password: Deno.env.get("SAP_MSSQL_PASSWORD")!,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  pool = await new mssql.ConnectionPool(config).connect();
  return pool;
}

export async function querySap<T>(sql: string): Promise<T[]> {
  const db = await getPool();
  const result = await db.request().query(sql);
  return result.recordset as T[];
}

export async function querySapMulti(sql: string): Promise<{ header: Record<string, unknown>[]; lines: Record<string, unknown>[] }> {
  const db = await getPool();
  const result = await db.request().query(sql);
  return {
    header: result.recordsets[0] as Record<string, unknown>[],
    lines: (result.recordsets[1] ?? []) as Record<string, unknown>[],
  };
}

export async function querySapTriple(sql: string): Promise<{ header: Record<string, unknown>[]; lines: Record<string, unknown>[]; installments: Record<string, unknown>[] }> {
  const db = await getPool();
  const result = await db.request().query(sql);
  return {
    header: result.recordsets[0] as Record<string, unknown>[],
    lines: (result.recordsets[1] ?? []) as Record<string, unknown>[],
    installments: (result.recordsets[2] ?? []) as Record<string, unknown>[],
  };
}

// Query registry — whitelisted queries only
export const QUERIES: Record<string, string | ((params: Record<string, string | number>) => string)> = {
  // Dashboard KPIs
  dashboard_kpis: `
    SELECT
      (SELECT COUNT(*) FROM ORDR WHERE YEAR(DocDate) = YEAR(GETDATE()) AND CANCELED <> 'C') as total_pedidos,
      (SELECT ISNULL(SUM(DocTotal), 0) FROM OINV WHERE YEAR(DocDate) = YEAR(GETDATE()) AND CANCELED = 'N') as valor_faturamento,
      (SELECT COUNT(*) FROM ODLN WHERE DocStatus = 'O' AND CANCELED <> 'C') as entregas_pendentes,
      (SELECT COUNT(*) FROM ORDN WHERE YEAR(DocDate) = YEAR(GETDATE()) AND CANCELED <> 'C') as total_devolucoes
  `,

  // Monthly revenue (all history)
  faturamento_mensal: `
    SELECT
      FORMAT(DocDate, 'yyyy-MM') as mes,
      SUM(DocTotal) as valor
    FROM OINV
    WHERE CANCELED = 'N'
    GROUP BY FORMAT(DocDate, 'yyyy-MM')
    ORDER BY mes
  `,

  // Monthly KPIs breakdown (all history) — for period filtering
  dashboard_kpis_mensal: `
    SELECT mes, metric, valor FROM (
      SELECT FORMAT(DocDate, 'yyyy-MM') as mes, 'pedidos' as metric, COUNT(*) as valor
      FROM ORDR WHERE CANCELED <> 'C'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
      UNION ALL
      SELECT FORMAT(DocDate, 'yyyy-MM'), 'faturamento', SUM(DocTotal)
      FROM OINV WHERE CANCELED = 'N'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
      UNION ALL
      SELECT FORMAT(DocDate, 'yyyy-MM'), 'devolucoes', COUNT(*)
      FROM ORDN WHERE CANCELED <> 'C'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
      UNION ALL
      SELECT FORMAT(DocDate, 'yyyy-MM'), 'entregas', COUNT(*)
      FROM ODLN WHERE CANCELED <> 'C'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
    ) T
    ORDER BY mes, metric
  `,

  // Unified comercial view (PV + NF + EN) — 3 CTEs covering all ODLN docs
  pedidos: `
    WITH pedidos_ordem AS (
      SELECT
        T0.DocEntry as doc_entry,
        T0.DocNum as doc_num,
        T0.CardCode as card_code,
        T0.CardName as card_name,
        T0.DocDate as doc_date,
        T0.DocTotal as doc_total,
        T0.DocStatus as doc_status,
        'PV' as origem,
        ISNULL(SLP.SlpName, '') as vendedor,
        ISNULL(ADR.State, '') as uf,
        CASE WHEN T0.DocTotal = 0 THEN 'Bonificacao' ELSE 'Venda' END as tipo,
        NF.DocNum as nf_num,
        NF.DocEntry as nf_entry,
        EN.DocDate as entrega_data,
        CASE
          WHEN T0.CANCELED = 'Y' THEN 'Cancelado'
          WHEN EST.estorno_total > 0 AND (NF.DocTotal - EST.estorno_total) = 0 THEN 'Estorno'
          WHEN EN.DocEntry IS NOT NULL THEN 'Entregue'
          WHEN NF.DocEntry IS NOT NULL THEN 'Faturado'
          ELSE 'Pedido'
        END as status_pedido,
        ISNULL(GP.grupo_principal, 'Outros') as grupo_principal,
        NF.DocTotal as nf_total,
        NF.DocDate as nf_date,
        ISNULL(EST.estorno_total, 0) as estorno_total,
        CASE WHEN NF.DocTotal IS NOT NULL THEN NF.DocTotal - ISNULL(EST.estorno_total, 0) ELSE NULL END as faturamento_liquido,
        EN.DocEntry as en_entry,
        ISNULL(PG.PymntGroup, '') as cond_pagamento,
        T0.DocCur as doc_cur,
        T0.DocDueDate as doc_due_date,
        ISNULL(T0.Address2, '') as address2,
        ISNULL(T0.Comments, '') as comments,
        ISNULL(CG.GroupName, '') as canal,
        ISNULL(WV.total_weight_kg, 0) as total_weight_kg,
        ISNULL(WV.total_volume_m3, 0) as total_volume_m3,
        ISNULL(WV.total_pallets, 0) as total_pallets
      FROM ORDR T0
      LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
      LEFT JOIN CRD1 ADR ON T0.CardCode = ADR.CardCode AND ADR.AdresType = 'S' AND T0.ShipToCode = ADR.Address
      LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
      LEFT JOIN OCRD BP ON T0.CardCode = BP.CardCode
      LEFT JOIN OCRG CG ON BP.GroupCode = CG.GroupCode
      OUTER APPLY (
        SELECT
          SUM(L.Quantity * ISNULL(I.SWeight1, 0)) as total_weight_kg,
          SUM(L.Quantity * ISNULL(I.SVolume, 0)) as total_volume_m3,
          ROUND(SUM(L.Quantity / NULLIF(I.SalFactor1, 0)), 1) as total_pallets
        FROM RDR1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
      ) WV
      OUTER APPLY (
        SELECT TOP 1 I.Serial as DocNum, I.DocEntry, I.DocTotal, I.DocDate
        FROM OINV I
        WHERE I.CANCELED <> 'C'
          AND (
            EXISTS (SELECT 1 FROM INV1 IL WHERE IL.DocEntry = I.DocEntry
                    AND IL.BaseEntry = T0.DocEntry AND IL.BaseType = 17)
            OR EXISTS (SELECT 1 FROM INV21 LNK WHERE LNK.DocEntry = I.DocEntry
                       AND LNK.RefDocEntr = T0.DocEntry AND LNK.RefObjType = '17')
            OR EXISTS (SELECT 1 FROM INV1 IL WHERE IL.DocEntry = I.DocEntry AND IL.BaseType = 15
                       AND EXISTS (SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = IL.BaseEntry
                                   AND DL.BaseType = 17 AND DL.BaseEntry = T0.DocEntry))
          )
      ) NF
      OUTER APPLY (
        SELECT TOP 1 D.DocEntry, D.DocDate
        FROM ODLN D
        WHERE D.CANCELED <> 'C'
          AND (
            (NF.DocEntry IS NOT NULL AND EXISTS (SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = D.DocEntry
                    AND DL.BaseEntry = NF.DocEntry AND DL.BaseType = 13))
            OR EXISTS (SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = D.DocEntry
                       AND DL.BaseEntry = T0.DocEntry AND DL.BaseType = 17)
            OR (NF.DocEntry IS NOT NULL AND EXISTS (SELECT 1 FROM DLN21 LNK WHERE LNK.DocEntry = D.DocEntry
                       AND LNK.RefDocEntr = NF.DocEntry AND LNK.RefObjType = '13'))
            OR EXISTS (SELECT 1 FROM DLN21 LNK WHERE LNK.DocEntry = D.DocEntry
                       AND LNK.RefDocEntr = T0.DocEntry AND LNK.RefObjType = '17')
          )
      ) EN
      OUTER APPLY (
        SELECT TOP 1
          CASE WHEN I.QryGroup1 = 'Y' THEN 'Conserva' ELSE 'Outros' END as grupo_principal
        FROM RDR1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
        ORDER BY L.LineTotal DESC
      ) GP
      OUTER APPLY (
        SELECT
          SUM(RL.LineTotal) as estorno_total,
          COUNT(DISTINCT RL.DocEntry) as estorno_count
        FROM RIN1 RL
        INNER JOIN ORIN R ON RL.DocEntry = R.DocEntry
        WHERE R.CANCELED <> 'C'
          AND NF.DocEntry IS NOT NULL
          AND RL.BaseEntry = NF.DocEntry
          AND RL.BaseType = 13
      ) EST
      WHERE T0.CANCELED <> 'C'
    ),
    -- CTE 2: ODLN linked to NF but NOT to any PV (direct invoice -> delivery)
    entregas_via_nf AS (
      SELECT
        T0.DocEntry as doc_entry,
        T0.DocNum as doc_num,
        T0.CardCode as card_code,
        T0.CardName as card_name,
        T0.DocDate as doc_date,
        T0.DocTotal as doc_total,
        T0.DocStatus as doc_status,
        'EN' as origem,
        ISNULL(SLP.SlpName, '') as vendedor,
        ISNULL(ADR.State, '') as uf,
        CASE WHEN T0.DocTotal = 0 THEN 'Bonificacao' ELSE 'Venda' END as tipo,
        NF.DocNum as nf_num,
        NF.DocEntry as nf_entry,
        T0.DocDate as entrega_data,
        CASE
          WHEN T0.CANCELED = 'Y' THEN 'Cancelado'
          WHEN EST.estorno_total > 0 AND (NF.DocTotal - EST.estorno_total) = 0 THEN 'Estorno'
          ELSE 'Entregue'
        END as status_pedido,
        ISNULL(GP.grupo_principal, 'Outros') as grupo_principal,
        NF.DocTotal as nf_total,
        NF.DocDate as nf_date,
        ISNULL(EST.estorno_total, 0) as estorno_total,
        CASE WHEN NF.DocTotal IS NOT NULL THEN NF.DocTotal - ISNULL(EST.estorno_total, 0) ELSE NULL END as faturamento_liquido,
        T0.DocEntry as en_entry,
        ISNULL(PG.PymntGroup, '') as cond_pagamento,
        T0.DocCur as doc_cur,
        T0.DocDueDate as doc_due_date,
        ISNULL(T0.Address2, '') as address2,
        ISNULL(T0.Comments, '') as comments,
        ISNULL(CG.GroupName, '') as canal,
        ISNULL(WV.total_weight_kg, 0) as total_weight_kg,
        ISNULL(WV.total_volume_m3, 0) as total_volume_m3,
        ISNULL(WV.total_pallets, 0) as total_pallets
      FROM ODLN T0
      LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
      LEFT JOIN CRD1 ADR ON T0.CardCode = ADR.CardCode AND ADR.AdresType = 'S' AND T0.ShipToCode = ADR.Address
      LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
      LEFT JOIN OCRD BP ON T0.CardCode = BP.CardCode
      LEFT JOIN OCRG CG ON BP.GroupCode = CG.GroupCode
      OUTER APPLY (
        SELECT
          SUM(L.Quantity * ISNULL(I.SWeight1, 0)) as total_weight_kg,
          SUM(L.Quantity * ISNULL(I.SVolume, 0)) as total_volume_m3,
          ROUND(SUM(L.Quantity / NULLIF(I.SalFactor1, 0)), 1) as total_pallets
        FROM DLN1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
      ) WV
      -- Find linked NF (OINV) via DLN1/INV1 or DLN21/INV21
      OUTER APPLY (
        SELECT TOP 1 I.Serial as DocNum, I.DocEntry, I.DocTotal, I.DocDate
        FROM OINV I
        WHERE I.CANCELED <> 'C'
          AND (
            -- INV1 based on this delivery (BaseType=15)
            EXISTS (SELECT 1 FROM INV1 IL WHERE IL.DocEntry = I.DocEntry
                    AND IL.BaseEntry = T0.DocEntry AND IL.BaseType = 15)
            -- DLN1 based on NF (BaseType=13)
            OR EXISTS (SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = T0.DocEntry
                       AND DL.BaseEntry = I.DocEntry AND DL.BaseType = 13)
            -- INV21 header ref to delivery
            OR EXISTS (SELECT 1 FROM INV21 LNK WHERE LNK.DocEntry = I.DocEntry
                       AND LNK.RefDocEntr = T0.DocEntry AND LNK.RefObjType = '15')
            -- DLN21 header ref to NF
            OR EXISTS (SELECT 1 FROM DLN21 LNK WHERE LNK.DocEntry = T0.DocEntry
                       AND LNK.RefDocEntr = I.DocEntry AND LNK.RefObjType = '13')
          )
      ) NF
      OUTER APPLY (
        SELECT TOP 1
          CASE WHEN I.QryGroup1 = 'Y' THEN 'Conserva' ELSE 'Outros' END as grupo_principal
        FROM DLN1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
        ORDER BY L.LineTotal DESC
      ) GP
      OUTER APPLY (
        SELECT
          SUM(RL.LineTotal) as estorno_total,
          COUNT(DISTINCT RL.DocEntry) as estorno_count
        FROM RIN1 RL
        INNER JOIN ORIN R ON RL.DocEntry = R.DocEntry
        WHERE R.CANCELED <> 'C'
          AND NF.DocEntry IS NOT NULL
          AND RL.BaseEntry = NF.DocEntry
          AND RL.BaseType = 13
      ) EST
      WHERE T0.CANCELED <> 'C'
        AND NF.DocEntry IS NOT NULL
        -- Exclude deliveries already captured via PV in pedidos_ordem
        AND NOT EXISTS (
          SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = T0.DocEntry AND DL.BaseType = 17
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = DL.BaseEntry AND O.CANCELED <> 'C')
        )
        AND NOT EXISTS (
          SELECT 1 FROM DLN21 LNK WHERE LNK.DocEntry = T0.DocEntry AND LNK.RefObjType = '17'
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = LNK.RefDocEntr AND O.CANCELED <> 'C')
        )
        -- Also exclude deliveries whose NF is linked to a PV (PV->NF->EN flow)
        AND NOT EXISTS (
          SELECT 1 FROM INV1 IL WHERE IL.DocEntry = NF.DocEntry AND IL.BaseType = 17
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = IL.BaseEntry AND O.CANCELED <> 'C')
        )
        AND NOT EXISTS (
          SELECT 1 FROM INV21 LNK WHERE LNK.DocEntry = NF.DocEntry AND LNK.RefObjType = '17'
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = LNK.RefDocEntr AND O.CANCELED <> 'C')
        )
    ),
    -- CTE 3: Standalone ODLN not captured by pedidos_ordem or entregas_via_nf
    entregas_sem_pedido AS (
      SELECT
        T0.DocEntry as doc_entry,
        T0.DocNum as doc_num,
        T0.CardCode as card_code,
        T0.CardName as card_name,
        T0.DocDate as doc_date,
        T0.DocTotal as doc_total,
        T0.DocStatus as doc_status,
        'EN' as origem,
        ISNULL(SLP.SlpName, '') as vendedor,
        ISNULL(ADR.State, '') as uf,
        CASE WHEN T0.DocTotal = 0 THEN 'Bonificacao' ELSE 'Venda' END as tipo,
        NULL as nf_num,
        NULL as nf_entry,
        T0.DocDate as entrega_data,
        CASE WHEN T0.CANCELED = 'Y' THEN 'Cancelado' ELSE 'Entregue' END as status_pedido,
        ISNULL(GP.grupo_principal, 'Outros') as grupo_principal,
        NULL as nf_total,
        NULL as nf_date,
        0 as estorno_total,
        NULL as faturamento_liquido,
        T0.DocEntry as en_entry,
        ISNULL(PG.PymntGroup, '') as cond_pagamento,
        T0.DocCur as doc_cur,
        T0.DocDueDate as doc_due_date,
        ISNULL(T0.Address2, '') as address2,
        ISNULL(T0.Comments, '') as comments,
        ISNULL(CG.GroupName, '') as canal,
        ISNULL(WV.total_weight_kg, 0) as total_weight_kg,
        ISNULL(WV.total_volume_m3, 0) as total_volume_m3,
        ISNULL(WV.total_pallets, 0) as total_pallets
      FROM ODLN T0
      LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
      LEFT JOIN CRD1 ADR ON T0.CardCode = ADR.CardCode AND ADR.AdresType = 'S' AND T0.ShipToCode = ADR.Address
      LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
      LEFT JOIN OCRD BP ON T0.CardCode = BP.CardCode
      LEFT JOIN OCRG CG ON BP.GroupCode = CG.GroupCode
      OUTER APPLY (
        SELECT
          SUM(L.Quantity * ISNULL(I.SWeight1, 0)) as total_weight_kg,
          SUM(L.Quantity * ISNULL(I.SVolume, 0)) as total_volume_m3,
          ROUND(SUM(L.Quantity / NULLIF(I.SalFactor1, 0)), 1) as total_pallets
        FROM DLN1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
      ) WV
      OUTER APPLY (
        SELECT TOP 1
          CASE WHEN I.QryGroup1 = 'Y' THEN 'Conserva' ELSE 'Outros' END as grupo_principal
        FROM DLN1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
        ORDER BY L.LineTotal DESC
      ) GP
      WHERE T0.CANCELED <> 'C'
        -- Exclude deliveries already captured by pedidos_ordem (TOP 1 per PV)
        AND T0.DocEntry NOT IN (
          SELECT en_entry FROM pedidos_ordem WHERE en_entry IS NOT NULL
        )
        -- Exclude deliveries already captured by entregas_via_nf
        AND T0.DocEntry NOT IN (
          SELECT doc_entry FROM entregas_via_nf
        )
    ),
    nfs_sem_pedido AS (
      SELECT
        T0.DocEntry as doc_entry,
        T0.Serial as doc_num,
        T0.CardCode as card_code,
        T0.CardName as card_name,
        T0.DocDate as doc_date,
        T0.DocTotal as doc_total,
        T0.DocStatus as doc_status,
        'NF' as origem,
        ISNULL(SLP.SlpName, '') as vendedor,
        ISNULL(ADR.State, '') as uf,
        CASE WHEN T0.DocTotal = 0 THEN 'Bonificacao' ELSE 'Venda' END as tipo,
        T0.Serial as nf_num,
        T0.DocEntry as nf_entry,
        EN.DocDate as entrega_data,
        CASE
          WHEN T0.CANCELED = 'Y' THEN 'Cancelado'
          WHEN EST.estorno_total > 0 AND (T0.DocTotal - EST.estorno_total) = 0 THEN 'Estorno'
          WHEN EN.DocEntry IS NOT NULL THEN 'Entregue'
          ELSE 'Faturado'
        END as status_pedido,
        ISNULL(GP.grupo_principal, 'Outros') as grupo_principal,
        T0.DocTotal as nf_total,
        T0.DocDate as nf_date,
        ISNULL(EST.estorno_total, 0) as estorno_total,
        T0.DocTotal - ISNULL(EST.estorno_total, 0) as faturamento_liquido,
        EN.DocEntry as en_entry,
        ISNULL(PG.PymntGroup, '') as cond_pagamento,
        T0.DocCur as doc_cur,
        T0.DocDueDate as doc_due_date,
        ISNULL(T0.Address2, '') as address2,
        ISNULL(T0.Comments, '') as comments,
        ISNULL(CG.GroupName, '') as canal,
        ISNULL(WV.total_weight_kg, 0) as total_weight_kg,
        ISNULL(WV.total_volume_m3, 0) as total_volume_m3,
        ISNULL(WV.total_pallets, 0) as total_pallets
      FROM OINV T0
      LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
      LEFT JOIN CRD1 ADR ON T0.CardCode = ADR.CardCode AND ADR.AdresType = 'S' AND T0.ShipToCode = ADR.Address
      LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
      LEFT JOIN OCRD BP ON T0.CardCode = BP.CardCode
      LEFT JOIN OCRG CG ON BP.GroupCode = CG.GroupCode
      OUTER APPLY (
        SELECT
          SUM(L.Quantity * ISNULL(I.SWeight1, 0)) as total_weight_kg,
          SUM(L.Quantity * ISNULL(I.SVolume, 0)) as total_volume_m3,
          ROUND(SUM(L.Quantity / NULLIF(I.SalFactor1, 0)), 1) as total_pallets
        FROM INV1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
      ) WV
      OUTER APPLY (
        SELECT TOP 1 D.DocEntry, D.DocDate
        FROM ODLN D
        WHERE D.CANCELED <> 'C'
          AND (
            EXISTS (SELECT 1 FROM DLN1 DL WHERE DL.DocEntry = D.DocEntry
                    AND DL.BaseEntry = T0.DocEntry AND DL.BaseType = 13)
            OR EXISTS (SELECT 1 FROM DLN21 LNK WHERE LNK.DocEntry = D.DocEntry
                       AND LNK.RefDocEntr = T0.DocEntry AND LNK.RefObjType = '13')
          )
      ) EN
      OUTER APPLY (
        SELECT TOP 1
          CASE WHEN I.QryGroup1 = 'Y' THEN 'Conserva' ELSE 'Outros' END as grupo_principal
        FROM INV1 L
        INNER JOIN OITM I ON L.ItemCode = I.ItemCode
        WHERE L.DocEntry = T0.DocEntry
        ORDER BY L.LineTotal DESC
      ) GP
      OUTER APPLY (
        SELECT SUM(RL.LineTotal) as estorno_total
        FROM RIN1 RL
        INNER JOIN ORIN R ON RL.DocEntry = R.DocEntry
        WHERE R.CANCELED <> 'C'
          AND RL.BaseEntry = T0.DocEntry
          AND RL.BaseType = 13
      ) EST
      WHERE T0.CANCELED <> 'C'
        AND T0.DocEntry NOT IN (SELECT nf_entry FROM pedidos_ordem WHERE nf_entry IS NOT NULL)
        AND T0.DocEntry NOT IN (SELECT nf_entry FROM entregas_via_nf WHERE nf_entry IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM INV1 IL WHERE IL.DocEntry = T0.DocEntry AND IL.BaseType = 17
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = IL.BaseEntry AND O.CANCELED <> 'C')
        )
        AND NOT EXISTS (
          SELECT 1 FROM INV21 LNK WHERE LNK.DocEntry = T0.DocEntry AND LNK.RefObjType = '17'
          AND EXISTS (SELECT 1 FROM ORDR O WHERE O.DocEntry = LNK.RefDocEntr AND O.CANCELED <> 'C')
        )
    )
    SELECT * FROM pedidos_ordem
    UNION ALL
    SELECT * FROM entregas_via_nf
    UNION ALL
    SELECT * FROM entregas_sem_pedido
    UNION ALL
    SELECT * FROM nfs_sem_pedido
    ORDER BY doc_date DESC
  `,

  // Order line items (live query) — kept for backwards compatibility
  pedido_linhas: (params) => `
    SELECT
      T0.ItemCode,
      T0.Dscription,
      T0.Quantity,
      T0.Price,
      T0.LineTotal
    FROM RDR1 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // PV detail (header + lines)
  pedido_detalhe_pv: (params) => `
    SELECT
      T0.CardCode, T0.CardName,
      ISNULL(SLP.SlpName, '') as Vendedor,
      ISNULL(PG.PymntGroup, '') as CondPagamento,
      T0.DocCur, T0.DocDate, T0.DocDueDate,
      T0.Address2, T0.Comments
    FROM ORDR T0
    LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
    LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
    WHERE T0.DocEntry = ${Number(params.docEntry)};

    SELECT
      T0.ItemCode, T0.Dscription,
      T0.Quantity, T0.Price, T0.LineTotal
    FROM RDR1 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // NF detail (header + lines)
  pedido_detalhe_nf: (params) => `
    SELECT
      T0.CardCode, T0.CardName,
      ISNULL(SLP.SlpName, '') as Vendedor,
      ISNULL(PG.PymntGroup, '') as CondPagamento,
      T0.DocCur, T0.DocDate, T0.DocDueDate,
      T0.Address2, T0.Comments
    FROM OINV T0
    LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
    LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
    WHERE T0.DocEntry = ${Number(params.docEntry)};

    SELECT
      T0.ItemCode, T0.Dscription,
      T0.Quantity, T0.Price, T0.LineTotal
    FROM INV1 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // NF fiscal detail (DANFE-style, header + lines with fiscal fields)
  pedido_detalhe_nf_fiscal: (params) => `
    SELECT
      T0.CardCode, T0.CardName,
      ISNULL(SLP.SlpName, '') as Vendedor,
      ISNULL(PG.PymntGroup, '') as CondPagamento,
      T0.DocCur, T0.DocDate, T0.DocDueDate,
      T0.Address2, T0.Comments,
      T0.DocNum,
      ISNULL(T0.U_ChaveAcesso, '') as ChaveNFe,
      CAST(T0.Serial AS varchar) as NFNum,
      ISNULL(T0.FolioPref, '1') as Serie,
      T0.DocTotal,
      ISNULL(ADM.TaxIdNum, '') as CNPJ_Emitente,
      ISNULL(ADM.TaxIdNum2, '') as IE_Emitente,
      ISNULL(ADM.CompnyName, '') as RazaoSocial_Emitente,
      ISNULL(ADM.CompnyAddr, '') as Endereco_Emitente,
      ISNULL(FISC.TaxId0, ISNULL(C.LicTradNum, '')) as CNPJ_Destinatario,
      ISNULL(FISC.TaxId4, ISNULL(C.VatIdUnCmp, '')) as IE_Destinatario
    FROM OINV T0
    LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
    LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
    LEFT JOIN OCRD C ON T0.CardCode = C.CardCode
    LEFT JOIN CRD7 FISC ON T0.CardCode = FISC.CardCode AND FISC.AddrType = 'S'
    CROSS JOIN OADM ADM
    WHERE T0.DocEntry = ${Number(params.docEntry)};

    SELECT
      T0.ItemCode, T0.Dscription,
      T0.Quantity, T0.Price, T0.LineTotal,
      ISNULL(I.SuppCatNum, '') as NCM,
      ISNULL(T0.unitMsr, '') as Unidade
    FROM INV1 T0
    LEFT JOIN OITM I ON T0.ItemCode = I.ItemCode
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // EN detail (header + lines)
  pedido_detalhe_en: (params) => `
    SELECT
      T0.CardCode, T0.CardName,
      ISNULL(SLP.SlpName, '') as Vendedor,
      ISNULL(PG.PymntGroup, '') as CondPagamento,
      T0.DocCur, T0.DocDate, T0.DocDueDate,
      T0.Address2, T0.Comments
    FROM ODLN T0
    LEFT JOIN OSLP SLP ON T0.SlpCode = SLP.SlpCode
    LEFT JOIN OCTG PG ON T0.GroupNum = PG.GroupNum
    WHERE T0.DocEntry = ${Number(params.docEntry)};

    SELECT
      T0.ItemCode, T0.Dscription,
      T0.Quantity, T0.Price, T0.LineTotal
    FROM DLN1 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // Deliveries (all history)
  entregas: `
    SELECT
      T0.DocEntry as doc_entry,
      T0.DocNum as doc_num,
      T0.CardCode as card_code,
      T0.CardName as card_name,
      T0.DocDate as doc_date,
      T0.DocTotal as doc_total,
      T0.DocStatus as doc_status,
      T0.Address2 as address
    FROM ODLN T0
    WHERE T0.CANCELED <> 'C'
    ORDER BY T0.DocDate DESC
  `,

  // Delivery line items (live query)
  entrega_linhas: (params) => `
    SELECT
      T0.ItemCode,
      T0.Dscription,
      T0.Quantity,
      T0.Price,
      T0.LineTotal
    FROM DLN1 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,

  // Returns (ORDN, all history)
  devolucoes_returns: `
    SELECT
      T0.DocEntry as doc_entry,
      T0.DocNum as doc_num,
      T0.CardCode as card_code,
      T0.CardName as card_name,
      T0.DocDate as doc_date,
      T0.DocTotal as doc_total,
      'return' as doc_type
    FROM ORDN T0
    WHERE T0.CANCELED <> 'C'
    ORDER BY T0.DocDate DESC
  `,

  // Credit memos (ORIN, all history)
  devolucoes_credit_memos: `
    SELECT
      T0.DocEntry as doc_entry,
      T0.DocNum as doc_num,
      T0.CardCode as card_code,
      T0.CardName as card_name,
      T0.DocDate as doc_date,
      T0.DocTotal as doc_total,
      'credit_memo' as doc_type
    FROM ORIN T0
    WHERE T0.CANCELED <> 'C'
    ORDER BY T0.DocDate DESC
  `,

  // Return/credit memo line items (live query)
  devolucao_linhas: (params) => {
    const table = params.docType === "credit_memo" ? "RIN1" : "RDN1";
    return `
      SELECT
        T0.ItemCode,
        T0.Dscription,
        T0.Quantity,
        T0.Price,
        T0.LineTotal
      FROM ${table} T0
      WHERE T0.DocEntry = ${Number(params.docEntry)}
    `;
  },

  // Vendor invoices for freight association (last 12 months)
  fornecedor_notas: `
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.CardName,
      T0.DocTotal,
      T0.DocDate
    FROM OPCH T0
    WHERE T0.DocStatus = 'O'
      AND T0.DocDate >= DATEADD(MONTH, -12, GETDATE())
    ORDER BY T0.DocDate DESC
  `,

  // Line items for all doc types (PV/NF/EN) — used by sap-sync for pedido_linhas cache
  pedido_linhas_sync: `
    SELECT T0.DocEntry as doc_entry, 'PV' as origem, T0.LineNum as line_num,
           T0.ItemCode as item_code, T0.Dscription as descricao,
           T0.Quantity as quantidade, T0.Price as preco, T0.LineTotal as total_linha
    FROM RDR1 T0
    INNER JOIN ORDR H ON T0.DocEntry = H.DocEntry
    WHERE H.CANCELED <> 'C' AND H.DocDate >= DATEADD(MONTH, -12, GETDATE())
    UNION ALL
    SELECT T0.DocEntry, 'NF', T0.LineNum, T0.ItemCode, T0.Dscription,
           T0.Quantity, T0.Price, T0.LineTotal
    FROM INV1 T0
    INNER JOIN OINV H ON T0.DocEntry = H.DocEntry
    WHERE H.CANCELED <> 'C' AND H.DocDate >= DATEADD(MONTH, -12, GETDATE())
    UNION ALL
    SELECT T0.DocEntry, 'EN', T0.LineNum, T0.ItemCode, T0.Dscription,
           T0.Quantity, T0.Price, T0.LineTotal
    FROM DLN1 T0
    INNER JOIN ODLN H ON T0.DocEntry = H.DocEntry
    WHERE H.CANCELED <> 'C' AND H.DocDate >= DATEADD(MONTH, -12, GETDATE())
  `,

  // Customer addresses for route calculation
  customer_address: (params) => `
    SELECT
      T0.CardCode,
      T0.CardName,
      T0.Address as street,
      T0.City,
      T0.State1 as state,
      T0.ZipCode
    FROM OCRD T0
    WHERE T0.CardCode = '${String(params.cardCode).replace(/'/g, "''")}'
  `,

  // === ESTOQUE ===

  // Estoque por deposito
  estoque_por_deposito: `
    SELECT
      W.WhsName as deposito,
      COUNT(DISTINCT T.ItemCode) as num_itens,
      SUM(T.OnHand) as qtd,
      SUM(T.OnHand * I.AvgPrice) as valor
    FROM OITW T
    INNER JOIN OWHS W ON T.WhsCode = W.WhsCode
    INNER JOIN OITM I ON T.ItemCode = I.ItemCode
    WHERE I.InvntItem = 'Y' AND T.OnHand > 0
    GROUP BY W.WhsName
    ORDER BY valor DESC
  `,

  // Estoque valorizacao por grupo (all groups)
  estoque_valorizacao: `
    SELECT
      ISNULL(G.ItmsGrpNam, 'Sem Grupo') as grupo,
      COUNT(DISTINCT I.ItemCode) as num_itens,
      SUM(W.OnHand) as qtd,
      SUM(W.OnHand * I.AvgPrice) as valor
    FROM OITW W
    INNER JOIN OITM I ON W.ItemCode = I.ItemCode
    LEFT JOIN OITB G ON I.ItmsGrpCod = G.ItmsGrpCod
    WHERE I.InvntItem = 'Y' AND W.OnHand > 0
    GROUP BY G.ItmsGrpNam
    ORDER BY valor DESC
  `,

  // Estoque abaixo do minimo (all items)
  estoque_abaixo_minimo: `
    SELECT
      I.ItemCode as item_code,
      I.ItemName as item_name,
      ISNULL(G.ItmsGrpNam, 'Sem Grupo') as grupo,
      I.OnHand as estoque,
      I.MinLevel as minimo,
      I.MinLevel - I.OnHand as diferenca
    FROM OITM I
    LEFT JOIN OITB G ON I.ItmsGrpCod = G.ItmsGrpCod
    WHERE I.InvntItem = 'Y'
      AND I.MinLevel > 0
      AND I.OnHand < I.MinLevel
    ORDER BY diferenca DESC
  `,

  // Estoque giro (menor giro = mais lento, 6 meses)
  estoque_giro: `
    SELECT TOP 100
      I.ItemCode as item_code,
      I.ItemName as item_name,
      I.OnHand as em_estoque,
      ISNULL(S.vendido, 0) as vendido_6m,
      CASE WHEN I.OnHand > 0 AND ISNULL(S.vendido, 0) > 0
        THEN ROUND(CAST(ISNULL(S.vendido, 0) AS float) / CAST(I.OnHand AS float), 2)
        ELSE 0
      END as giro
    FROM OITM I
    LEFT JOIN (
      SELECT IL.ItemCode, SUM(IL.Quantity) as vendido
      FROM INV1 IL
      INNER JOIN OINV IV ON IL.DocEntry = IV.DocEntry
      WHERE IV.DocDate >= DATEADD(MONTH, -6, GETDATE()) AND IV.CANCELED = 'N'
      GROUP BY IL.ItemCode
    ) S ON I.ItemCode = S.ItemCode
    WHERE I.InvntItem = 'Y' AND I.OnHand > 0
    ORDER BY giro ASC
  `,

  // === PRODUCAO ===

  // Producao ordens por status (12 meses)
  producao_ordens: `
    SELECT
      CASE Status WHEN 'P' THEN 'Planejada' WHEN 'R' THEN 'Liberada' WHEN 'L' THEN 'Encerrada' END as status,
      COUNT(*) as qtd,
      SUM(PlannedQty) as planejada,
      SUM(CmpltQty) as completada,
      CASE WHEN SUM(PlannedQty) > 0
        THEN ROUND(SUM(CmpltQty) * 100.0 / SUM(PlannedQty), 1)
        ELSE 0
      END as pct
    FROM OWOR
    WHERE CreateDate >= DATEADD(MONTH, -12, GETDATE())
      AND Status IN ('P', 'R', 'L')
    GROUP BY Status
  `,

  // Top 50 materias primas consumidas (12 meses)
  producao_consumo_mp: `
    SELECT TOP 50
      I.ItemCode as item_code,
      I.ItemName as item_name,
      SUM(W1.IssuedQty) as qtd_consumida,
      SUM(W1.IssuedQty * I.AvgPrice) as valor
    FROM WOR1 W1
    INNER JOIN OWOR W ON W1.DocEntry = W.DocEntry
    INNER JOIN OITM I ON W1.ItemCode = I.ItemCode
    WHERE W.CreateDate >= DATEADD(MONTH, -12, GETDATE())
      AND W.Status IN ('R', 'L')
    GROUP BY I.ItemCode, I.ItemName
    ORDER BY valor DESC
  `,

  // Planejado vs realizado mensal (all history)
  producao_planejado_vs_real: `
    SELECT
      FORMAT(CreateDate, 'yyyy-MM') as mes,
      SUM(PlannedQty) as planejado,
      SUM(CmpltQty) as realizado,
      CASE WHEN SUM(PlannedQty) > 0
        THEN ROUND(SUM(CmpltQty) * 100.0 / SUM(PlannedQty), 1)
        ELSE 0
      END as eficiencia_pct
    FROM OWOR
    WHERE Status IN ('R', 'L')
    GROUP BY FORMAT(CreateDate, 'yyyy-MM')
    ORDER BY mes
  `,

  // === COMPRAS ===

  // Pedidos de compra abertos
  compras_abertas: `
    SELECT
      COUNT(*) as total,
      SUM(DocTotal) as valor,
      SUM(CASE WHEN DocDueDate < GETDATE() THEN 1 ELSE 0 END) as atrasados,
      SUM(CASE WHEN DocDueDate < GETDATE() THEN DocTotal ELSE 0 END) as valor_atrasados
    FROM OPOR
    WHERE DocStatus = 'O' AND CANCELED <> 'C'
  `,

  // Compras mensais (all history) — POs + AP Invoices for complete view
  compras_mes: `
    SELECT mes, SUM(num_pedidos) as num_pedidos, SUM(valor) as valor
    FROM (
      SELECT FORMAT(DocDate, 'yyyy-MM') as mes, COUNT(*) as num_pedidos, SUM(DocTotal) as valor
      FROM OPOR WHERE CANCELED <> 'C'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
      UNION ALL
      SELECT FORMAT(DocDate, 'yyyy-MM') as mes, COUNT(*) as num_pedidos, SUM(DocTotal) as valor
      FROM OPCH WHERE CANCELED = 'N'
      GROUP BY FORMAT(DocDate, 'yyyy-MM')
    ) T
    GROUP BY mes
    ORDER BY mes
  `,

  // Lead time fornecedores (all history, top 30, relaxed to >= 1 delivery)
  compras_lead_time: `
    SELECT TOP 30
      P.CardName as fornecedor,
      AVG(DATEDIFF(DAY, PO.DocDate, P.DocDate)) as lead_time_medio,
      MIN(DATEDIFF(DAY, PO.DocDate, P.DocDate)) as lead_time_min,
      MAX(DATEDIFF(DAY, PO.DocDate, P.DocDate)) as lead_time_max
    FROM OPDN P
    INNER JOIN PDN1 PL ON P.DocEntry = PL.DocEntry
    INNER JOIN OPOR PO ON PL.BaseEntry = PO.DocEntry AND PL.BaseType = 22
    WHERE P.CANCELED <> 'C'
    GROUP BY P.CardName
    HAVING COUNT(*) >= 1
    ORDER BY lead_time_medio DESC
  `,

  // === FINANCEIRO ===

  // Contas a Receber aging
  cr_aging: `
    SELECT
      ISNULL(SUM(CASE WHEN T0.DocDueDate >= GETDATE() THEN T0.DocTotal - T0.PaidToDate END), 0) as a_vencer,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 1 AND 30 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_1_30,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 31 AND 60 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_31_60,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 61 AND 90 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_61_90,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) > 90 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_90_mais,
      ISNULL(SUM(T0.DocTotal - T0.PaidToDate), 0) as total_aberto
    FROM OINV T0
    WHERE T0.DocStatus = 'O' AND T0.CANCELED = 'N'
  `,

  // Contas a Pagar aging
  cp_aging: `
    SELECT
      ISNULL(SUM(CASE WHEN T0.DocDueDate >= GETDATE() THEN T0.DocTotal - T0.PaidToDate END), 0) as a_vencer,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 1 AND 30 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_1_30,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 31 AND 60 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_31_60,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) BETWEEN 61 AND 90 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_61_90,
      ISNULL(SUM(CASE WHEN DATEDIFF(DAY, T0.DocDueDate, GETDATE()) > 90 THEN T0.DocTotal - T0.PaidToDate END), 0) as vencido_90_mais,
      ISNULL(SUM(T0.DocTotal - T0.PaidToDate), 0) as total_aberto
    FROM OPCH T0
    WHERE T0.DocStatus = 'O' AND T0.CANCELED = 'N'
  `,

  // Cashflow projection (90 days)
  cashflow_projection: `
    SELECT due_date, SUM(receber) as receber, SUM(pagar) as pagar
    FROM (
      SELECT CONVERT(varchar(10), I.DueDate, 23) as due_date, I.InsTotal as receber, 0 as pagar
      FROM INV6 I
      INNER JOIN OINV H ON I.DocEntry = H.DocEntry
      WHERE H.DocStatus = 'O' AND H.CANCELED = 'N'
        AND I.DueDate BETWEEN GETDATE() AND DATEADD(DAY, 90, GETDATE())
      UNION ALL
      SELECT CONVERT(varchar(10), P.DueDate, 23) as due_date, 0 as receber, P.InsTotal as pagar
      FROM PCH6 P
      INNER JOIN OPCH H ON P.DocEntry = H.DocEntry
      WHERE H.DocStatus = 'O' AND H.CANCELED = 'N'
        AND P.DueDate BETWEEN GETDATE() AND DATEADD(DAY, 90, GETDATE())
    ) T
    GROUP BY due_date
    ORDER BY due_date
  `,

  // Margem mensal (all history)
  margem_mensal: `
    SELECT
      FORMAT(T0.DocDate, 'yyyy-MM') as mes,
      SUM(T0.DocTotal) as receita,
      SUM(T0.DocTotal - T0.GrosProfit) as custo,
      SUM(T0.GrosProfit) as lucro_bruto,
      CASE WHEN SUM(T0.DocTotal) > 0
        THEN ROUND(SUM(T0.GrosProfit) * 100.0 / SUM(T0.DocTotal), 2)
        ELSE 0
      END as margem_pct
    FROM OINV T0
    WHERE T0.CANCELED = 'N'
    GROUP BY FORMAT(T0.DocDate, 'yyyy-MM')
    ORDER BY mes
  `,

  // Vendas por canal with monthly breakdown (all history)
  vendas_por_canal: `
    SELECT
      ISNULL(G.GroupName, 'Sem Grupo') as canal,
      FORMAT(T0.DocDate, 'yyyy-MM') as mes,
      COUNT(*) as num_notas,
      SUM(T0.DocTotal) as valor_total
    FROM OINV T0
    INNER JOIN OCRD C ON T0.CardCode = C.CardCode
    LEFT JOIN OCRG G ON C.GroupCode = G.GroupCode
    WHERE T0.CANCELED = 'N'
    GROUP BY G.GroupName, FORMAT(T0.DocDate, 'yyyy-MM')
    ORDER BY valor_total DESC
  `,

  // Top 50 clientes with monthly breakdown (all history)
  top_clientes: `
    SELECT TOP 50
      T0.CardCode as card_code,
      T0.CardName as card_name,
      FORMAT(T0.DocDate, 'yyyy-MM') as mes,
      COUNT(*) as num_notas,
      SUM(T0.DocTotal) as valor_total
    FROM OINV T0
    WHERE T0.CANCELED = 'N'
    GROUP BY T0.CardCode, T0.CardName, FORMAT(T0.DocDate, 'yyyy-MM')
    ORDER BY valor_total DESC
  `,

  // Ciclo de caixa (PMR + PME + PMP, 3 meses)
  ciclo_caixa: `
    SELECT
      ISNULL((
        SELECT AVG(DATEDIFF(DAY, T0.DocDate, T0.DocDueDate))
        FROM OINV T0
        WHERE T0.DocDate >= DATEADD(MONTH, -3, GETDATE()) AND T0.CANCELED = 'N'
      ), 0) as pmr,
      ISNULL((
        SELECT CASE WHEN SUM(SOLD.qty) > 0
          THEN ROUND(SUM(OITM.OnHand * OITM.AvgPrice) / (SUM(SOLD.qty * SOLD.price) / 90.0), 0)
          ELSE 0 END
        FROM OITM
        LEFT JOIN (
          SELECT IL.ItemCode, SUM(IL.Quantity) as qty, AVG(IL.Price) as price
          FROM INV1 IL
          INNER JOIN OINV I ON IL.DocEntry = I.DocEntry
          WHERE I.DocDate >= DATEADD(MONTH, -3, GETDATE()) AND I.CANCELED = 'N'
          GROUP BY IL.ItemCode
        ) SOLD ON OITM.ItemCode = SOLD.ItemCode
        WHERE OITM.InvntItem = 'Y' AND OITM.OnHand > 0
      ), 0) as pme,
      ISNULL((
        SELECT AVG(DATEDIFF(DAY, T0.DocDate, T0.DocDueDate))
        FROM OPCH T0
        WHERE T0.DocDate >= DATEADD(MONTH, -3, GETDATE()) AND T0.CANCELED = 'N'
      ), 0) as pmp
  `,

  // Comercial — SKU group analysis (revenue by product group per month)
  comercial_grupo_sku: `
    SELECT
      FORMAT(H.DocDate, 'yyyy-MM') as mes,
      CASE
        WHEN I.QryGroup1 = 'Y' THEN 'Conserva'
        ELSE 'Outros'
      END as grupo_sku,
      COUNT(DISTINCT H.DocEntry) as num_notas,
      SUM(L.Quantity) as volume,
      SUM(L.LineTotal) as receita
    FROM INV1 L
    INNER JOIN OINV H ON L.DocEntry = H.DocEntry
    INNER JOIN OITM I ON L.ItemCode = I.ItemCode
    WHERE H.CANCELED = 'N'
    GROUP BY FORMAT(H.DocDate, 'yyyy-MM'),
      CASE WHEN I.QryGroup1 = 'Y' THEN 'Conserva' ELSE 'Outros' END
    ORDER BY mes, receita DESC
  `,

  // Item packaging/palletization from OITM — only finished products (Produto Acabado, code P*)
  item_packaging: `
    SELECT
      I.ItemCode as item_code,
      ISNULL(I.ItemName, I.ItemCode) as item_name,
      ISNULL(I.SalFactor1, 0) as boxes_per_pallet,
      ISNULL(I.SWeight1, 0) as box_weight_kg,
      ISNULL(I.SVolume, 0) as box_volume_m3,
      ROUND(ISNULL(I.SalFactor1, 0) * ISNULL(I.SWeight1, 0), 2) as pallet_weight_kg
    FROM OITM I
    INNER JOIN OITB G ON I.ItmsGrpCod = G.ItmsGrpCod
    WHERE I.InvntItem = 'Y'
      AND I.SellItem = 'Y'
      AND I.ItemCode LIKE 'P%'
      AND G.ItmsGrpNam = 'PRODUTOS ACABADOS'
    ORDER BY I.ItemCode
  `,

  // === PRODUCAO (Module) ===

  // Production orders list (per OP, last 24 months)
  producao_ordens_lista: `
    SELECT W.DocEntry as doc_entry, W.DocNum as doc_num,
      CASE W.Status WHEN 'P' THEN 'Planejada' WHEN 'R' THEN 'Liberada' WHEN 'L' THEN 'Encerrada' END as status,
      W.ItemCode as item_code, I.ItemName as item_name, W.Warehouse as warehouse,
      W.PlannedQty as planned_qty, W.CmpltQty as completed_qty, W.RjctQty as rejected_qty,
      W.CreateDate as create_date, W.StartDate as start_date, W.DueDate as due_date, W.CloseDate as close_date,
      CASE WHEN W.PlannedQty > 0 THEN ROUND(W.CmpltQty*100.0/W.PlannedQty,1) ELSE 0 END as eficiencia_pct,
      (SELECT COUNT(*) FROM WOR1 C WHERE C.DocEntry=W.DocEntry) as num_components
    FROM OWOR W LEFT JOIN OITM I ON W.ItemCode=I.ItemCode
    WHERE W.Status IN ('P','R','L') AND W.CreateDate >= DATEADD(MONTH,-24,GETDATE())
    ORDER BY W.CreateDate DESC
  `,

  // Production order detail (multi-recordset: header + BOM components)
  producao_ordem_detalhe: (params) => `
    SELECT W.DocEntry as doc_entry, W.DocNum as doc_num,
      CASE W.Status WHEN 'P' THEN 'Planejada' WHEN 'R' THEN 'Liberada' WHEN 'L' THEN 'Encerrada' END as status,
      W.ItemCode as item_code, I.ItemName as item_name, W.Warehouse as warehouse,
      W.PlannedQty as planned_qty, W.CmpltQty as completed_qty, W.RjctQty as rejected_qty,
      W.CreateDate as create_date, W.StartDate as start_date, W.DueDate as due_date, W.CloseDate as close_date,
      CASE WHEN W.PlannedQty > 0 THEN ROUND(W.CmpltQty*100.0/W.PlannedQty,1) ELSE 0 END as eficiencia_pct,
      W.Comments as comments
    FROM OWOR W LEFT JOIN OITM I ON W.ItemCode=I.ItemCode
    WHERE W.DocEntry = ${Number(params.doc_entry)};

    SELECT C.ItemCode as item_code, I.ItemName as item_name,
      C.PlannedQty as planned_qty, C.IssuedQty as issued_qty,
      (C.PlannedQty - C.IssuedQty) as pending_qty,
      ISNULL(I.OnHand, 0) as stock_available,
      I.InvntryUom as uom
    FROM WOR1 C LEFT JOIN OITM I ON C.ItemCode=I.ItemCode
    WHERE C.DocEntry = ${Number(params.doc_entry)}
    ORDER BY C.LineNum
  `,

  // BOM forecast — get BOM for an item with stock info
  producao_bom_forecast: (params) => `
    SELECT TOP 50
      T.Code as bom_code, T.Name as bom_name,
      L.ItemCode as item_code, I.ItemName as item_name,
      L.Quantity as qty_per_unit,
      ISNULL(I.OnHand, 0) as stock_available,
      I.InvntryUom as uom
    FROM ITT1 L
    INNER JOIN OITT T ON L.Father = T.Code
    INNER JOIN OITM I ON L.Code = I.ItemCode
    WHERE T.Code = '${String(params.item_code).replace(/'/g, "''")}'
    ORDER BY L.LineNum
  `,

  // Diagnostic: check which columns exist in SAP tables
  diag_sap_columns: (params) => `
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${String(params.table).replace(/'/g, "''")}'
    ${params.columns ? `AND COLUMN_NAME IN (${String(params.columns).split(',').map((c: string) => `'${c.trim()}'`).join(',')})` : ''}
    ORDER BY COLUMN_NAME
  `,

  // DANFE completo (3 recordsets: header, lines, installments)
  danfe_completo: (params) => `
    SELECT
      T0.DocEntry, T0.DocNum,
      ISNULL(T0.U_ChaveAcesso, '') as ChaveNFe,
      CAST(T0.Serial AS varchar) as NFNum,
      ISNULL(T0.FolioPref, '1') as Serie,
      T0.DocDate, T0.DocDueDate,
      T0.DocTotal, ISNULL(T0.VatSum, 0) as VatSum,
      ISNULL(T0.DiscSum, 0) as DiscSum,
      ISNULL(T0.TotalExpns, 0) as TotalExpns,
      ISNULL(T0.Comments, '') as Comments,
      ISNULL(T0.JrnlMemo, '') as NaturezaOp,
      ISNULL(T0.NumAtCard, '') as NumAtCard,
      ISNULL(T0.Address2, '') as Address2,
      -- Emitente
      ISNULL(ADM.TaxIdNum, '') as CNPJ_Emitente,
      ISNULL(ADM.TaxIdNum2, '') as IE_Emitente,
      ISNULL(ADM.CompnyName, '') as RazaoSocial_Emitente,
      ISNULL(ADM.CompnyAddr, '') as Endereco_Emitente,
      -- Destinatario (CRD7 = Brazilian fiscal tax IDs)
      T0.CardCode, T0.CardName,
      ISNULL(FISC.TaxId0, ISNULL(C.LicTradNum, '')) as CNPJ_Destinatario,
      ISNULL(FISC.TaxId4, ISNULL(C.VatIdUnCmp, '')) as IE_Destinatario,
      ISNULL(C.Phone1, '') as Fone_Destinatario,
      -- Endereco entrega
      ISNULL(ADDR.Street, '') as Rua,
      ISNULL(ADDR.Block, '') as Bairro,
      ISNULL(ADDR.City, '') as Cidade,
      ISNULL(ADDR.State, '') as UF,
      ISNULL(ADDR.ZipCode, '') as CEP,
      ISNULL(ADDR.StreetNo, '') as Numero,
      -- Transporte
      ISNULL(SHP.TrnspName, '') as Transportadora,
      CASE T0.TrnspCode
        WHEN 0 THEN '0 - Emitente'
        WHEN 1 THEN '1 - Destinatario'
        WHEN 2 THEN '2 - Terceiros'
        ELSE '9 - Sem Frete'
      END as FreteModalidade,
      '' as PlacaVeiculo,
      '' as UF_Veiculo,
      '' as RNTC,
      0 as VolumesQtd,
      '' as VolumesEspecie,
      ISNULL(PRODS.peso_liquido, 0) as PesoLiquido,
      ISNULL(PRODS.peso_bruto, 0) as PesoBruto,
      -- Totais de produto e impostos
      ISNULL(PRODS.total_produtos, 0) as TotalProdutos,
      ISNULL(PRODS.base_icms, 0) as BaseICMS,
      ISNULL(PRODS.valor_icms, 0) as ValorICMS,
      0 as ICMS_ST_Base,
      0 as ICMS_ST_Valor,
      0 as PIS_Total,
      0 as COFINS_Total,
      0 as IPI_Total,
      '' as ProtocoloAutorizacao,
      '' as DataAutorizacao,
      '' as InfoComplementar
    FROM OINV T0
    CROSS JOIN OADM ADM
    LEFT JOIN OCRD C ON T0.CardCode = C.CardCode
    LEFT JOIN CRD7 FISC ON T0.CardCode = FISC.CardCode AND FISC.AddrType = 'S'
    LEFT JOIN CRD1 ADDR ON T0.CardCode = ADDR.CardCode
      AND ADDR.AdresType = 'S'
      AND T0.ShipToCode = ADDR.Address
    LEFT JOIN OSHP SHP ON T0.TrnspCode = SHP.TrnspCode
    OUTER APPLY (
      SELECT
        SUM(L.LineTotal) as total_produtos,
        SUM(L.LineTotal) as base_icms,
        SUM(L.VatSum) as valor_icms,
        SUM(L.Quantity * ISNULL(I.SWeight1, 0)) as peso_liquido,
        SUM(L.Quantity * ISNULL(I.SWeight1, 0) * 1.05) as peso_bruto
      FROM INV1 L
      LEFT JOIN OITM I ON L.ItemCode = I.ItemCode
      WHERE L.DocEntry = T0.DocEntry
    ) PRODS
    WHERE T0.DocEntry = ${Number(params.docEntry)} AND T0.CANCELED <> 'C';

    SELECT
      T0.ItemCode, T0.Dscription,
      T0.Quantity, T0.Price, T0.LineTotal,
      ISNULL(I.SuppCatNum, '') as NCM,
      ISNULL(T0.unitMsr, '') as Unidade,
      ISNULL(T0.CFOPCode, '') as CFOP,
      ISNULL(T0.CSTCode, '') as CST,
      ISNULL(T0.VatSum, 0) as ICMS_Valor,
      ISNULL(T0.VatPrcnt, 0) as ICMS_Aliq,
      ISNULL(T0.LineTotal, 0) as ICMS_Base,
      0 as PIS_Valor,
      0 as PIS_Aliq,
      0 as COFINS_Valor,
      0 as COFINS_Aliq,
      0 as IPI_Valor,
      0 as IPI_Aliq,
      0 as ICMS_ST_Valor
    FROM INV1 T0
    LEFT JOIN OITM I ON T0.ItemCode = I.ItemCode
    WHERE T0.DocEntry = ${Number(params.docEntry)};

    SELECT
      T0.InstlmntID as Parcela,
      T0.DueDate as Vencimento,
      T0.InsTotal as Valor
    FROM INV6 T0
    WHERE T0.DocEntry = ${Number(params.docEntry)}
    ORDER BY T0.InstlmntID
  `,

  // Delivery customer addresses (for route calc)
  delivery_addresses: (params) => `
    SELECT DISTINCT
      T1.CardCode,
      T1.CardName,
      T1.Address2 as delivery_address
    FROM ODLN T0
    INNER JOIN OCRD T1 ON T0.CardCode = T1.CardCode
    WHERE T0.DocEntry = ${Number(params.docEntry)}
  `,
};

export async function readNFeXml(docEntry: number): Promise<string> {
  const db = await getPool();
  const safeDocEntry = Number(docEntry);
  if (!safeDocEntry || isNaN(safeDocEntry)) throw new Error("DocEntry inválido");

  // 1. Get ChaveAcesso from OINV
  const keyResult = await db.request().query(
    `SELECT T0.U_ChaveAcesso FROM OINV T0 WHERE T0.DocEntry = ${safeDocEntry} AND T0.CANCELED = 'N'`
  );
  const chaveAcesso = keyResult.recordset?.[0]?.U_ChaveAcesso as string | undefined;
  if (!chaveAcesso) throw new Error("Chave de acesso não encontrada para esta NF");

  // 2. Try to read XML file from filesystem via OPENROWSET
  const basePath = "D:\\NFe_XMLs\\emitidas";
  const suffixes = [".xml", "-nfe.xml", "-procNFe.xml"];

  for (const suffix of suffixes) {
    const filePath = `${basePath}\\${chaveAcesso}${suffix}`;
    try {
      const result = await db.request().query(
        `SELECT CAST(BulkColumn AS NVARCHAR(MAX)) AS xml_content
         FROM OPENROWSET(BULK '${filePath}', SINGLE_BLOB) AS x`
      );
      const content = result.recordset?.[0]?.xml_content as string | undefined;
      if (content) return content;
    } catch {
      // File not found with this suffix, try next
      continue;
    }
  }

  throw new Error(`XML da NFe não encontrado para chave ${chaveAcesso}`);
}

export function resolveQuery(
  name: string,
  params?: Record<string, string | number>
): string {
  const q = QUERIES[name];
  if (!q) throw new Error(`Unknown query: ${name}`);
  if (typeof q === "function") {
    if (!params) throw new Error(`Query ${name} requires params`);
    return q(params);
  }
  return q;
}
