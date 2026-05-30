export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          bill_id: string
          created_at: string
          description: string
          id: string
          line_total: number | null
          quantity: number
          unit_price: number
        }
        Insert: {
          bill_id: string
          created_at?: string
          description: string
          id?: string
          line_total?: number | null
          quantity?: number
          unit_price: number
        }
        Update: {
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          line_total?: number | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          balance: number | null
          bill_number: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          issued_at: string
          notes: string | null
          paid: number
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          supplier_id: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number | null
          bill_number?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          paid?: number
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          supplier_id: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number | null
          bill_number?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          paid?: number
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          supplier_id?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          currency: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          tax_id: string | null
          tax_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          document_id: string | null
          id: string
          name: string
          neighborhood_id: string | null
          notes: string | null
          phone: string | null
          portal_user_id: string | null
          purchase_frequency: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          name: string
          neighborhood_id?: string | null
          notes?: string | null
          phone?: string | null
          portal_user_id?: string | null
          purchase_frequency?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          name?: string
          neighborhood_id?: string | null
          notes?: string | null
          phone?: string | null
          portal_user_id?: string | null
          purchase_frequency?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          license_plate: string | null
          name: string
          phone: string | null
          vehicle: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          name: string
          phone?: string | null
          vehicle?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          license_plate?: string | null
          name?: string
          phone?: string | null
          vehicle?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          max_stock: number | null
          min_stock: number
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          max_stock?: number | null
          min_stock?: number
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          max_stock?: number | null
          min_stock?: number
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          recorded_by: string | null
          reference: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          recorded_by?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          recorded_by?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          line_total: number | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          line_total?: number | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: number
          issued_at: string
          notes: string | null
          paid: number
          sale_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          notes?: string | null
          paid?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          notes?: string | null
          paid?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_date: string | null
          id: string
          notes: string | null
          order_number: number
          seller_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          recorded_by: string | null
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          price: number
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          price: number
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: number
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          planned_quantity: number
          produced_quantity: number
          product_id: string
          responsible_id: string | null
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["batch_status"]
          unit_cost: number
          updated_at: string
        }
        Insert: {
          batch_number?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity: number
          produced_quantity?: number
          product_id: string
          responsible_id?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          batch_number?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_quantity?: number
          produced_quantity?: number
          product_id?: string
          responsible_id?: string | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          balance: number | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_id: string | null
          paid: number
          sale_number: number
          seller_id: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid?: number
          sale_number?: number
          seller_id: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid?: number
          sale_number?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          address: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          driver_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          scheduled_for: string | null
          shipment_number: number
          status: Database["public"]["Enums"]["shipment_status"]
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          scheduled_for?: string | null
          shipment_number?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          scheduled_for?: string | null
          shipment_number?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_order_to_sale: {
        Args: { _order_id: string }
        Returns: {
          id: string
          sale_number: number
        }[]
      }
      create_guest_order: {
        Args: {
          _address: string
          _document_id: string
          _items: Json
          _name: string
          _neighborhood_id: string
          _notes: string
          _phone: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_bill_totals: { Args: { _bill_id: string }; Returns: undefined }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      recalc_sale_totals: { Args: { _sale_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "seller"
        | "production_operator"
        | "logistics_operator"
        | "customer"
        | "operations"
      batch_status: "planned" | "in_progress" | "completed" | "cancelled"
      bill_status: "draft" | "received" | "paid" | "overdue" | "cancelled"
      customer_status: "active" | "inactive" | "prospect"
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "cancelled"
      movement_type:
        | "in"
        | "out"
        | "adjust"
        | "production"
        | "sale"
        | "transfer"
      order_status:
        | "draft"
        | "confirmed"
        | "in_production"
        | "ready"
        | "delivered"
        | "cancelled"
      payment_method: "cash" | "transfer" | "card" | "other"
      sale_status: "draft" | "confirmed" | "paid" | "cancelled"
      shipment_status: "pending" | "in_transit" | "delivered" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "seller",
        "production_operator",
        "logistics_operator",
        "customer",
        "operations",
      ],
      batch_status: ["planned", "in_progress", "completed", "cancelled"],
      bill_status: ["draft", "received", "paid", "overdue", "cancelled"],
      customer_status: ["active", "inactive", "prospect"],
      invoice_status: ["draft", "issued", "paid", "overdue", "cancelled"],
      movement_type: ["in", "out", "adjust", "production", "sale", "transfer"],
      order_status: [
        "draft",
        "confirmed",
        "in_production",
        "ready",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cash", "transfer", "card", "other"],
      sale_status: ["draft", "confirmed", "paid", "cancelled"],
      shipment_status: ["pending", "in_transit", "delivered", "cancelled"],
    },
  },
} as const
