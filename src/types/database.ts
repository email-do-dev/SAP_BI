export type AppRole = 'diretoria' | 'comercial' | 'logistica' | 'financeiro' | 'importacao' | 'producao'

export type CostType = 'frete_proprio' | 'frete_terceiro' | 'descarga'
export type CostSource = 'manual' | 'calculated' | 'sap'
export type ShipmentStatusType = 'programada' | 'em_expedicao' | 'expedida' | 'em_transito' | 'entregue_parcial' | 'entregue' | 'finalizada' | 'cancelada'
export type ReturnRequestStatusType = 'solicitada' | 'em_aprovacao' | 'aprovada' | 'nf_emitida' | 'retornada' | 'descartada' | 'fechada'

export interface PalletEntry {
  number: number
  shipment_item_id: string
  items: Array<{
    item_code: string
    descricao: string
    quantidade: number
    lote: string
  }>
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
          created_at: string
        }
        Insert: {
          user_id: string
          role: AppRole
        }
        Update: {
          role?: AppRole
        }
      }
      sap_cache_dashboard_kpis: {
        Row: {
          id: string
          total_pedidos: number
          valor_faturamento: number
          entregas_pendentes: number
          total_devolucoes: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_faturamento_mensal: {
        Row: {
          id: string
          mes: string
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_pedidos: {
        Row: {
          id: string
          doc_entry: number
          doc_num: number
          card_code: string
          card_name: string
          doc_date: string
          doc_total: number
          doc_status: string
          origem: 'PV' | 'EN' | 'NF'
          vendedor: string
          uf: string
          tipo: 'Venda' | 'Bonificacao'
          nf_num: string | null
          nf_entry: number | null
          entrega_data: string | null
          status_pedido: 'Pedido' | 'Faturado' | 'Entregue' | 'Cancelado' | 'Estorno'
          grupo_principal: string
          nf_total: number | null
          nf_date: string | null
          estorno_total: number
          faturamento_liquido: number | null
          en_entry: number | null
          cond_pagamento: string
          doc_cur: string
          doc_due_date: string | null
          address2: string
          comments: string
          canal: string
          total_weight_kg: number
          total_volume_m3: number
          total_pallets: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_comercial_grupo_sku: {
        Row: {
          id: string
          mes: string
          grupo_sku: string
          num_notas: number
          volume: number
          receita: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_pedido_linhas: {
        Row: {
          id: string
          doc_entry: number
          origem: 'PV' | 'NF' | 'EN'
          line_num: number
          item_code: string
          descricao: string
          quantidade: number
          preco: number
          total_linha: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_entregas: {
        Row: {
          id: string
          doc_entry: number
          doc_num: number
          card_code: string
          card_name: string
          doc_date: string
          doc_total: number
          doc_status: string
          address: string | null
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_devolucoes: {
        Row: {
          id: string
          doc_entry: number
          doc_num: number
          card_code: string
          card_name: string
          doc_date: string
          doc_total: number
          doc_type: 'return' | 'credit_memo'
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_custo_logistico: {
        Row: {
          id: string
          mes: string
          custo_total: number
          frete_proprio: number
          frete_terceiro: number
          descarga: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      logistics_costs: {
        Row: {
          id: string
          delivery_doc_entry: number
          cost_type: CostType
          amount: number
          description: string | null
          source: CostSource
          opch_doc_entry: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          delivery_doc_entry: number
          cost_type: CostType
          amount: number
          description?: string | null
          source: CostSource
          opch_doc_entry?: number | null
          created_by: string
        }
        Update: {
          amount?: number
          description?: string | null
        }
      }
      delivery_routes: {
        Row: {
          id: string
          delivery_doc_entry: number
          total_km: number
          route_points: string[]
          calculated_at: string
        }
        Insert: {
          delivery_doc_entry: number
          total_km: number
          route_points: string[]
        }
        Update: {
          total_km?: number
          route_points?: string[]
        }
      }
      // === Financeiro cache tables ===
      sap_cache_financeiro_aging: {
        Row: {
          id: string
          tipo: 'CR' | 'CP'
          a_vencer: number
          vencido_1_30: number
          vencido_31_60: number
          vencido_61_90: number
          vencido_90_mais: number
          total_aberto: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_financeiro_margem: {
        Row: {
          id: string
          mes: string
          receita: number
          custo: number
          lucro_bruto: number
          margem_pct: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_financeiro_cashflow: {
        Row: {
          id: string
          due_date: string
          receber: number
          pagar: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_financeiro_canal: {
        Row: {
          id: string
          canal: string
          mes: string | null
          num_notas: number
          valor_total: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_financeiro_top_clientes: {
        Row: {
          id: string
          card_code: string
          card_name: string
          mes: string | null
          num_notas: number
          valor_total: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_dashboard_kpis_mensal: {
        Row: {
          id: string
          mes: string
          metric: string
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_financeiro_ciclo: {
        Row: {
          id: string
          pmr: number
          pme: number
          pmp: number
          ciclo: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      // === Estoque cache tables ===
      sap_cache_estoque_deposito: {
        Row: {
          id: string
          deposito: string
          num_itens: number
          qtd: number
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_estoque_valorizacao: {
        Row: {
          id: string
          grupo: string
          num_itens: number
          qtd: number
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_estoque_abaixo_minimo: {
        Row: {
          id: string
          item_code: string
          item_name: string
          grupo: string
          estoque: number
          minimo: number
          diferenca: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_estoque_giro: {
        Row: {
          id: string
          item_code: string
          item_name: string
          em_estoque: number
          vendido_6m: number
          giro: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      // === Producao cache tables ===
      // === Production Module tables ===
      sap_cache_producao_ordens_lista: {
        Row: {
          id: string
          doc_entry: number
          doc_num: number
          status: string
          item_code: string
          item_name: string
          warehouse: string
          planned_qty: number
          completed_qty: number
          rejected_qty: number
          create_date: string
          start_date: string
          due_date: string
          close_date: string | null
          eficiencia_pct: number
          num_components: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      production_lines: {
        Row: {
          id: string
          name: string
          line_type: string
          capacity_per_hour: number
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          line_type: string
          capacity_per_hour?: number
          description?: string | null
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          line_type?: string
          capacity_per_hour?: number
          description?: string | null
          is_active?: boolean
          sort_order?: number
        }
      }
      production_steps: {
        Row: {
          id: string
          line_id: string
          name: string
          sequence: number
          is_checkpoint: boolean
          estimated_duration_min: number
          description: string | null
          is_active: boolean
        }
        Insert: {
          line_id: string
          name: string
          sequence: number
          is_checkpoint?: boolean
          estimated_duration_min?: number
          description?: string | null
        }
        Update: {
          name?: string
          sequence?: number
          is_checkpoint?: boolean
          estimated_duration_min?: number
          description?: string | null
          is_active?: boolean
        }
      }
      production_shifts: {
        Row: {
          id: string
          name: string
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          start_time: string
          end_time: string
          is_active?: boolean
        }
        Update: {
          name?: string
          start_time?: string
          end_time?: string
          is_active?: boolean
        }
      }
      production_line_shifts: {
        Row: {
          id: string
          line_id: string
          shift_id: string
        }
        Insert: {
          line_id: string
          shift_id: string
        }
        Update: Record<string, never>
      }
      production_stop_reasons: {
        Row: {
          id: string
          name: string
          category: string
          is_active: boolean
        }
        Insert: {
          name: string
          category: string
          is_active?: boolean
        }
        Update: {
          name?: string
          category?: string
          is_active?: boolean
        }
      }
      production_teams: {
        Row: {
          id: string
          name: string
          role: string
          is_active: boolean
        }
        Insert: {
          name: string
          role: string
          is_active?: boolean
        }
        Update: {
          name?: string
          role?: string
          is_active?: boolean
        }
      }
      production_team_assignments: {
        Row: {
          id: string
          team_id: string
          line_id: string
          shift_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          team_id: string
          line_id: string
          shift_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          valid_from?: string
          valid_until?: string | null
        }
      }
      pcp_daily_plans: {
        Row: {
          id: string
          plan_date: string
          line_id: string
          shift_id: string
          item_code: string
          item_name: string
          planned_qty: number
          sequence_order: number
          sap_wo_doc_entry: number | null
          notes: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          plan_date: string
          line_id: string
          shift_id: string
          item_code: string
          item_name: string
          planned_qty: number
          sequence_order?: number
          sap_wo_doc_entry?: number | null
          notes?: string | null
          status?: string
          created_by?: string | null
        }
        Update: {
          planned_qty?: number
          sequence_order?: number
          sap_wo_doc_entry?: number | null
          notes?: string | null
          status?: string
        }
      }
      sap_cache_producao_ordens: {
        Row: {
          id: string
          status: string
          qtd: number
          planejada: number
          completada: number
          pct: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_producao_consumo_mp: {
        Row: {
          id: string
          item_code: string
          item_name: string
          qtd_consumida: number
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_producao_planejado_vs_real: {
        Row: {
          id: string
          mes: string
          planejado: number
          realizado: number
          eficiencia_pct: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      // === Compras cache tables ===
      sap_cache_compras_abertas: {
        Row: {
          id: string
          total: number
          valor: number
          atrasados: number
          valor_atrasados: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_compras_mes: {
        Row: {
          id: string
          mes: string
          num_pedidos: number
          valor: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_compras_lead_time: {
        Row: {
          id: string
          fornecedor: string
          lead_time_medio: number
          lead_time_min: number
          lead_time_max: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_cache_item_packaging: {
        Row: {
          id: string
          item_code: string
          item_name: string
          boxes_per_pallet: number
          box_weight_kg: number
          box_volume_m3: number
          pallet_weight_kg: number
          refreshed_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      sap_sync_log: {
        Row: {
          id: string
          started_at: string
          completed_at: string | null
          status: 'ok' | 'partial' | 'error' | 'running'
          synced_count: number
          error_count: number
          errors: Array<{ step: string; message: string }>
          triggered_by: 'pg_cron' | 'manual'
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
      // === Importacao tables ===
      import_processes: {
        Row: {
          id: string
          reference: string
          status: import('../../src/lib/import-constants').ImportProcessStatus
          supplier: string
          incoterm: string
          currency: string
          exchange_rate: number
          container_number: string | null
          vessel: string | null
          port_origin: string | null
          port_destination: string | null
          etd: string | null
          eta: string | null
          arrival_date: string | null
          free_time_days: number
          daily_demurrage_rate: number
          sap_po_entry: number | null
          sap_nf_entry: number | null
          total_fob: number
          total_cif: number
          total_brl: number
          closing_checklist: Record<string, boolean>
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          supplier: string
          incoterm?: string
          currency?: string
          exchange_rate?: number
          container_number?: string | null
          vessel?: string | null
          port_origin?: string | null
          port_destination?: string | null
          etd?: string | null
          eta?: string | null
          arrival_date?: string | null
          free_time_days?: number
          daily_demurrage_rate?: number
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          status?: string
          supplier?: string
          incoterm?: string
          currency?: string
          exchange_rate?: number
          container_number?: string | null
          vessel?: string | null
          port_origin?: string | null
          port_destination?: string | null
          etd?: string | null
          eta?: string | null
          arrival_date?: string | null
          free_time_days?: number
          daily_demurrage_rate?: number
          sap_po_entry?: number | null
          sap_nf_entry?: number | null
          total_fob?: number
          total_cif?: number
          total_brl?: number
          closing_checklist?: Record<string, boolean>
          notes?: string | null
          updated_by?: string | null
        }
      }
      import_items: {
        Row: {
          id: string
          process_id: string
          description: string
          ncm: string | null
          quantity: number
          unit: string
          unit_price: number
          total_price: number
          gross_weight: number | null
          net_weight: number | null
          created_at: string
        }
        Insert: {
          process_id: string
          description: string
          ncm?: string | null
          quantity: number
          unit?: string
          unit_price: number
          gross_weight?: number | null
          net_weight?: number | null
        }
        Update: {
          description?: string
          ncm?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          gross_weight?: number | null
          net_weight?: number | null
        }
      }
      import_costs: {
        Row: {
          id: string
          process_id: string
          cost_type: import('../../src/lib/import-constants').ImportCostType
          cost_label: string
          planned_value: number
          actual_value: number
          currency: string
          exchange_rate: number
          payment_status: 'pendente' | 'pago' | 'parcial'
          receipt_storage_path: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          process_id: string
          cost_type: string
          cost_label?: string
          planned_value?: number
          actual_value?: number
          currency?: string
          exchange_rate?: number
          payment_status?: string
          receipt_storage_path?: string | null
          notes?: string | null
        }
        Update: {
          planned_value?: number
          actual_value?: number
          currency?: string
          exchange_rate?: number
          payment_status?: string
          receipt_storage_path?: string | null
          notes?: string | null
        }
      }
      import_documents: {
        Row: {
          id: string
          process_id: string
          doc_type: import('../../src/lib/import-constants').ImportDocType
          file_name: string
          storage_path: string
          file_size: number | null
          extracted_data: Record<string, unknown> | null
          ocr_status: 'none' | 'processing' | 'done' | 'error'
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          process_id: string
          doc_type: string
          file_name: string
          storage_path: string
          file_size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          extracted_data?: Record<string, unknown> | null
          ocr_status?: string
        }
      }
      import_tracking_events: {
        Row: {
          id: string
          process_id: string
          event_date: string
          location: string | null
          description: string
          vessel: string | null
          source: 'manual' | 'api'
          created_at: string
        }
        Insert: {
          process_id: string
          event_date?: string
          location?: string | null
          description: string
          vessel?: string | null
          source?: string
        }
        Update: Record<string, never>
      }
      import_timeline: {
        Row: {
          id: string
          process_id: string
          from_status: import('../../src/lib/import-constants').ImportProcessStatus | null
          to_status: import('../../src/lib/import-constants').ImportProcessStatus
          changed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          process_id: string
          from_status?: string | null
          to_status: string
          changed_by?: string | null
          notes?: string | null
        }
        Update: Record<string, never>
      }
      // === Logistics Module tables ===
      vehicles: {
        Row: {
          id: string
          plate: string
          vehicle_type: string
          ownership: 'own' | 'spot'
          operator_id: string | null
          max_weight_kg: number | null
          max_volume_m3: number | null
          max_pallets: number | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          plate: string
          vehicle_type: string
          ownership?: 'own' | 'spot'
          operator_id?: string | null
          max_weight_kg?: number | null
          max_volume_m3?: number | null
          max_pallets?: number | null
          description?: string | null
          is_active?: boolean
        }
        Update: {
          plate?: string
          vehicle_type?: string
          ownership?: 'own' | 'spot'
          operator_id?: string | null
          max_weight_kg?: number | null
          max_volume_m3?: number | null
          max_pallets?: number | null
          description?: string | null
          is_active?: boolean
        }
      }
      drivers: {
        Row: {
          id: string
          name: string
          cpf: string | null
          phone: string | null
          license_type: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          cpf?: string | null
          phone?: string | null
          license_type?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          cpf?: string | null
          phone?: string | null
          license_type?: string | null
          is_active?: boolean
        }
      }
      logistics_operators: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          contact_name: string | null
          contact_phone: string | null
          regions: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          regions?: string[]
          is_active?: boolean
        }
        Update: {
          name?: string
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          regions?: string[]
          is_active?: boolean
        }
      }
      item_packaging: {
        Row: {
          id: string
          item_code: string
          item_name: string
          boxes_per_pallet: number
          box_weight_kg: number | null
          box_volume_m3: number | null
          pallet_weight_kg: number | null
          notes: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          item_code: string
          item_name: string
          boxes_per_pallet?: number
          box_weight_kg?: number | null
          box_volume_m3?: number | null
          pallet_weight_kg?: number | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          item_code?: string
          item_name?: string
          boxes_per_pallet?: number
          box_weight_kg?: number | null
          box_volume_m3?: number | null
          pallet_weight_kg?: number | null
          notes?: string | null
          is_active?: boolean
        }
      }
      shipments: {
        Row: {
          id: string
          reference: string
          status: ShipmentStatusType
          delivery_date: string
          vehicle_id: string
          driver_id: string | null
          operator_id: string | null
          total_weight_kg: number
          total_volume_m3: number
          total_pallets: number
          total_value: number
          total_boxes: number
          notes: string | null
          expedition_verified_by: string | null
          expedition_verified_at: string | null
          loading_photo_path: string | null
          vehicle_photo_path: string | null
          seal_number: string | null
          seal_photo_path: string | null
          pallets_data: PalletEntry[]
          departed_at: string | null
          completed_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          delivery_date: string
          vehicle_id: string
          driver_id?: string | null
          operator_id?: string | null
          total_weight_kg?: number
          total_volume_m3?: number
          total_pallets?: number
          total_value?: number
          total_boxes?: number
          notes?: string | null
          created_by: string
        }
        Update: {
          status?: ShipmentStatusType
          delivery_date?: string
          vehicle_id?: string
          driver_id?: string | null
          operator_id?: string | null
          total_weight_kg?: number
          total_volume_m3?: number
          total_pallets?: number
          total_value?: number
          total_boxes?: number
          notes?: string | null
          expedition_verified_by?: string | null
          expedition_verified_at?: string | null
          loading_photo_path?: string | null
          vehicle_photo_path?: string | null
          seal_number?: string | null
          seal_photo_path?: string | null
          pallets_data?: PalletEntry[]
          departed_at?: string | null
          completed_at?: string | null
        }
      }
      shipment_items: {
        Row: {
          id: string
          shipment_id: string
          doc_entry: number
          doc_num: number | null
          origem: 'PV' | 'NF'
          card_code: string
          card_name: string
          doc_total: number
          weight_kg: number | null
          volume_m3: number | null
          pallet_count: number
          box_count: number
          delivery_type: 'direct' | 'operator'
          operator_id: string | null
          verified: boolean
          lot_numbers: string | null
          verified_qty: unknown | null
          delivery_status: 'pendente' | 'entregue' | 'devolvido_parcial' | 'devolvido_total'
          delivered_at: string | null
          canhoto_storage_path: string | null
          cte_doc_entry: number | null
          cte_value: number | null
          unloading_cost: number
          delivery_notes: string | null
          operator_delivered: boolean
          operator_delivered_at: string | null
          operator_expected_days: number | null
          loading_order: number | null
          uf: string
          created_at: string
        }
        Insert: {
          shipment_id: string
          doc_entry: number
          doc_num?: number | null
          origem?: 'PV' | 'NF'
          card_code: string
          card_name: string
          doc_total: number
          weight_kg?: number | null
          volume_m3?: number | null
          pallet_count?: number
          box_count?: number
          delivery_type?: 'direct' | 'operator'
          operator_id?: string | null
          loading_order?: number | null
          uf?: string
        }
        Update: {
          verified?: boolean
          loading_order?: number | null
          lot_numbers?: string | null
          verified_qty?: unknown | null
          delivery_status?: 'pendente' | 'entregue' | 'devolvido_parcial' | 'devolvido_total'
          delivered_at?: string | null
          canhoto_storage_path?: string | null
          cte_doc_entry?: number | null
          cte_value?: number | null
          unloading_cost?: number
          delivery_notes?: string | null
          operator_delivered?: boolean
          operator_delivered_at?: string | null
          operator_expected_days?: number | null
          delivery_type?: 'direct' | 'operator'
          operator_id?: string | null
        }
      }
      return_requests: {
        Row: {
          id: string
          reference: string
          status: ReturnRequestStatusType
          shipment_item_id: string | null
          original_doc_entry: number | null
          original_doc_num: number | null
          card_code: string
          card_name: string
          reason: string
          requested_by_type: 'driver' | 'client'
          requested_by_name: string | null
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          sap_return_doc_entry: number | null
          sap_credit_doc_entry: number | null
          physical_status: 'pendente' | 'em_transito' | 'recebido_fabrica' | 'descartado'
          physical_notes: string | null
          items: Array<{ item_code: string; description: string; quantity: number; value: number }>
          total_value: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          shipment_item_id?: string | null
          original_doc_entry?: number | null
          original_doc_num?: number | null
          card_code: string
          card_name: string
          reason: string
          requested_by_type: 'driver' | 'client'
          requested_by_name?: string | null
          items?: Array<{ item_code: string; description: string; quantity: number; value: number }>
          total_value?: number
          created_by: string
        }
        Update: {
          status?: ReturnRequestStatusType
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          sap_return_doc_entry?: number | null
          sap_credit_doc_entry?: number | null
          physical_status?: 'pendente' | 'em_transito' | 'recebido_fabrica' | 'descartado'
          physical_notes?: string | null
        }
      }
      shipment_tracking_events: {
        Row: {
          id: string
          shipment_id: string
          event_type: string
          shipment_item_id: string | null
          location: string | null
          description: string
          reported_by: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
        }
        Insert: {
          shipment_id: string
          event_type: string
          shipment_item_id?: string | null
          location?: string | null
          description: string
          reported_by?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Update: Record<string, never>
      }
      app_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_by?: string | null
        }
        Update: {
          value?: string
          description?: string | null
          updated_by?: string | null
        }
      }
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: AppRole[]
      }
      has_role: {
        Args: { _user_id: string; _role: AppRole }
        Returns: boolean
      }
    }
    Enums: {
      app_role: AppRole
      cost_type: CostType
      cost_source: CostSource
      shipment_status: ShipmentStatusType
      return_request_status: ReturnRequestStatusType
      import_process_status: import('../../src/lib/import-constants').ImportProcessStatus
      import_cost_type: import('../../src/lib/import-constants').ImportCostType
      import_doc_type: import('../../src/lib/import-constants').ImportDocType
    }
  }
}

// Pedido detail types (live SAP drill-down)
export interface PedidoDetalheHeader {
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

export interface PedidoDetalheLinha {
  ItemCode: string
  Dscription: string
  Quantity: number
  Price: number
  LineTotal: number
}

export interface PedidoDetalheResult {
  header: PedidoDetalheHeader[]
  lines: PedidoDetalheLinha[]
}

// NF Fiscal detail types (DANFE-style print)
export interface NfFiscalHeader extends PedidoDetalheHeader {
  DocNum: number
  ChaveNFe: string
  NFNum: string
  Serie: string
  DocTotal: number
  CNPJ_Emitente: string
  IE_Emitente: string
  RazaoSocial_Emitente: string
  Endereco_Emitente: string
  CNPJ_Destinatario: string
  IE_Destinatario: string
}

export interface NfFiscalLinha extends PedidoDetalheLinha {
  NCM: string
  Unidade: string
}

export interface NfFiscalResult {
  header: NfFiscalHeader[]
  lines: NfFiscalLinha[]
}

// DANFE completa types (3 recordsets)
export interface DanfeHeader {
  DocEntry: number
  DocNum: number
  ChaveNFe: string
  NFNum: string
  Serie: string
  DocDate: string
  DocDueDate: string
  DocTotal: number
  VatSum: number
  DiscSum: number
  TotalExpns: number
  Comments: string
  NaturezaOp: string
  NumAtCard: string
  Address2: string
  // Emitente
  CNPJ_Emitente: string
  IE_Emitente: string
  RazaoSocial_Emitente: string
  Endereco_Emitente: string
  // Destinatário
  CardCode: string
  CardName: string
  CNPJ_Destinatario: string
  IE_Destinatario: string
  Fone_Destinatario: string
  Rua: string
  Bairro: string
  Cidade: string
  UF: string
  CEP: string
  Numero: string
  // Transporte
  Transportadora: string
  FreteModalidade: string
  PlacaVeiculo: string
  UF_Veiculo: string
  RNTC: string
  VolumesQtd: number
  VolumesEspecie: string
  PesoLiquido: number
  PesoBruto: number
  // Totais calculados
  TotalProdutos: number
  BaseICMS: number
  ValorICMS: number
  ICMS_ST_Base: number
  ICMS_ST_Valor: number
  PIS_Total: number
  COFINS_Total: number
  IPI_Total: number
  // Protocolo de autorização
  ProtocoloAutorizacao: string
  DataAutorizacao: string
  // Informações complementares
  InfoComplementar: string
}

export interface DanfeLinha {
  ItemCode: string
  Dscription: string
  NCM: string
  Unidade: string
  CFOP: string
  CST: string
  Quantity: number
  Price: number
  LineTotal: number
  ICMS_Valor: number
  ICMS_Aliq: number
  ICMS_Base: number
  PIS_Valor: number
  PIS_Aliq: number
  COFINS_Valor: number
  COFINS_Aliq: number
  IPI_Valor: number
  IPI_Aliq: number
  ICMS_ST_Valor: number
}

export interface DanfeDuplicata {
  Parcela: number
  Vencimento: string
  Valor: number
}

export interface DanfeResult {
  header: DanfeHeader[]
  lines: DanfeLinha[]
  installments: DanfeDuplicata[]
}
