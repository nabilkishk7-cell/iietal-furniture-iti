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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      inventory_count_lines: {
        Row: {
          count_id: string
          counted_qty: number
          created_at: string
          current_qty: number
          id: string
          item_id: number
          ministry_qty: number
          notes: string | null
          system_qty: number
        }
        Insert: {
          count_id: string
          counted_qty?: number
          created_at?: string
          current_qty?: number
          id?: string
          item_id: number
          ministry_qty?: number
          notes?: string | null
          system_qty?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          created_at?: string
          current_qty?: number
          id?: string
          item_id?: number
          ministry_qty?: number
          notes?: string | null
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          branch_manager_name: string | null
          branch_manager_title: string | null
          counted_by_name: string
          counted_on: string
          counters: Json
          created_at: string
          created_by: string | null
          id: string
          location_id: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          branch_manager_name?: string | null
          branch_manager_title?: string | null
          counted_by_name: string
          counted_on?: string
          counters?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          branch_manager_name?: string | null
          branch_manager_title?: string | null
          counted_by_name?: string
          counted_on?: string
          counters?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          code: string
          created_at: string
          custody_entity: string | null
          custody_recipient: string | null
          id: number
          image_url: string | null
          item_count: number
          ministry_qty: number
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          custody_entity?: string | null
          custody_recipient?: string | null
          id?: never
          image_url?: string | null
          item_count?: number
          ministry_qty?: number
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          custody_entity?: string | null
          custody_recipient?: string | null
          id?: never
          image_url?: string | null
          item_count?: number
          ministry_qty?: number
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          id?: never
          name: string
          sort_order?: number
        }
        Update: {
          id?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      movements: {
        Row: {
          created_at: string
          created_by: string | null
          employee_name: string | null
          from_location_id: number | null
          id: string
          item_id: number
          moved_on: string
          notes: string | null
          qty: number
          security_from: string | null
          security_to: string | null
          to_location_id: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_name?: string | null
          from_location_id?: number | null
          id?: string
          item_id: number
          moved_on?: string
          notes?: string | null
          qty: number
          security_from?: string | null
          security_to?: string | null
          to_location_id?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_name?: string | null
          from_location_id?: number | null
          id?: string
          item_id?: number
          moved_on?: string
          notes?: string | null
          qty?: number
          security_from?: string | null
          security_to?: string | null
          to_location_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          item_id: number
          location_id: number
          qty: number
        }
        Insert: {
          item_id: number
          location_id: number
          qty?: number
        }
        Update: {
          item_id?: number
          location_id?: number
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
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
    }
    Views: {
      v_distribution: {
        Row: {
          item_id: number | null
          location_id: number | null
          qty: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "reviewer", "user"],
    },
  },
} as const
