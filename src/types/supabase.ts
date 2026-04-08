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
      companies: {
        Row: {
          address: string | null
          city: string | null
          company_size: string | null
          context_links: Json | null
          country: string | null
          created_at: string
          description: string | null
          external_id: string | null
          external_source: string | null
          id: number
          linkedin_url: string | null
          logo: Json | null
          metadata: Json | null
          name: string
          phone_number: string | null
          revenue: string | null
          sales_id: number | null
          sector: string | null
          service_area: string | null
          size: number | null
          state_abbr: string | null
          tax_identifier: string | null
          tech_maturity: string | null
          trade_type_id: string | null
          updated_at: string | null
          website: string | null
          zipcode: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_size?: string | null
          context_links?: Json | null
          country?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: number
          linkedin_url?: string | null
          logo?: Json | null
          metadata?: Json | null
          name: string
          phone_number?: string | null
          revenue?: string | null
          sales_id?: number | null
          sector?: string | null
          service_area?: string | null
          size?: number | null
          state_abbr?: string | null
          tax_identifier?: string | null
          tech_maturity?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
          website?: string | null
          zipcode?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_size?: string | null
          context_links?: Json | null
          country?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: number
          linkedin_url?: string | null
          logo?: Json | null
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          revenue?: string | null
          sales_id?: number | null
          sector?: string | null
          service_area?: string | null
          size?: number | null
          state_abbr?: string | null
          tax_identifier?: string | null
          tech_maturity?: string | null
          trade_type_id?: string | null
          updated_at?: string | null
          website?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_trade_type_id_fkey"
            columns: ["trade_type_id"]
            isOneToOne: false
            referencedRelation: "trade_types"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration: {
        Row: {
          config: Json
          id: number
        }
        Insert: {
          config?: Json
          id?: number
        }
        Update: {
          config?: Json
          id?: number
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          attachments: Json[] | null
          contact_id: number
          date: string | null
          id: number
          sales_id: number | null
          status: string | null
          text: string | null
        }
        Insert: {
          attachments?: Json[] | null
          contact_id: number
          date?: string | null
          id?: number
          sales_id?: number | null
          status?: string | null
          text?: string | null
        }
        Update: {
          attachments?: Json[] | null
          contact_id?: number
          date?: string | null
          id?: number
          sales_id?: number | null
          status?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactNotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactNotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactNotes_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar: Json | null
          background: string | null
          company_id: number | null
          email_jsonb: Json | null
          external_id: string | null
          external_source: string | null
          first_name: string | null
          first_seen: string | null
          gender: string | null
          has_newsletter: boolean | null
          id: number
          last_name: string | null
          last_seen: string | null
          lead_source_id: string | null
          linkedin_url: string | null
          metadata: Json | null
          phone_jsonb: Json | null
          sales_id: number | null
          status: string | null
          tags: number[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar?: Json | null
          background?: string | null
          company_id?: number | null
          email_jsonb?: Json | null
          external_id?: string | null
          external_source?: string | null
          first_name?: string | null
          first_seen?: string | null
          gender?: string | null
          has_newsletter?: boolean | null
          id?: number
          last_name?: string | null
          last_seen?: string | null
          lead_source_id?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          phone_jsonb?: Json | null
          sales_id?: number | null
          status?: string | null
          tags?: number[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar?: Json | null
          background?: string | null
          company_id?: number | null
          email_jsonb?: Json | null
          external_id?: string | null
          external_source?: string | null
          first_name?: string | null
          first_seen?: string | null
          gender?: string | null
          has_newsletter?: boolean | null
          id?: number
          last_name?: string | null
          last_seen?: string | null
          lead_source_id?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          phone_jsonb?: Json | null
          sales_id?: number | null
          status?: string | null
          tags?: number[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          attachments: Json[] | null
          date: string | null
          deal_id: number
          id: number
          sales_id: number | null
          text: string | null
          type: string | null
        }
        Insert: {
          attachments?: Json[] | null
          date?: string | null
          deal_id: number
          id?: number
          sales_id?: number | null
          text?: string | null
          type?: string | null
        }
        Update: {
          attachments?: Json[] | null
          date?: string | null
          deal_id?: number
          id?: number
          sales_id?: number | null
          text?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealNotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealNotes_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number | null
          archived_at: string | null
          category: string | null
          company_id: number | null
          contact_ids: number[] | null
          created_at: string
          description: string | null
          expected_closing_date: string | null
          id: number
          index: number | null
          lost_reason: string | null
          metadata: Json | null
          name: string
          sales_id: number | null
          stage: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          archived_at?: string | null
          category?: string | null
          company_id?: number | null
          contact_ids?: number[] | null
          created_at?: string
          description?: string | null
          expected_closing_date?: string | null
          id?: number
          index?: number | null
          lost_reason?: string | null
          metadata?: Json | null
          name: string
          sales_id?: number | null
          stage: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          archived_at?: string | null
          category?: string | null
          company_id?: number | null
          contact_ids?: number[] | null
          created_at?: string
          description?: string | null
          expected_closing_date?: string | null
          id?: number
          index?: number | null
          lost_reason?: string | null
          metadata?: Json | null
          name?: string
          sales_id?: number | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      favicons_excluded_domains: {
        Row: {
          domain: string
          id: number
        }
        Insert: {
          domain: string
          id?: number
        }
        Update: {
          domain?: string
          id?: number
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          administrator: boolean
          avatar: Json | null
          disabled: boolean
          email: string
          first_name: string
          id: number
          last_name: string
          user_id: string
        }
        Insert: {
          administrator: boolean
          avatar?: Json | null
          disabled?: boolean
          email: string
          first_name?: string
          id?: number
          last_name?: string
          user_id: string
        }
        Update: {
          administrator?: boolean
          avatar?: Json | null
          disabled?: boolean
          email?: string
          first_name?: string
          id?: number
          last_name?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          id: number
          name: string
        }
        Insert: {
          color: string
          id?: number
          name: string
        }
        Update: {
          color?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          contact_id: number
          done_date: string | null
          due_date: string | null
          id: number
          sales_id: number | null
          text: string | null
          type: string | null
        }
        Insert: {
          contact_id: number
          done_date?: string | null
          due_date?: string | null
          id?: number
          sales_id?: number | null
          text?: string | null
          type?: string | null
        }
        Update: {
          contact_id?: number
          done_date?: string | null
          due_date?: string | null
          id?: number
          sales_id?: number | null
          text?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_types: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      activity_log: {
        Row: {
          company: Json | null
          company_id: number | null
          contact: Json | null
          contact_note: Json | null
          date: string | null
          deal: Json | null
          deal_note: Json | null
          id: string | null
          sales_id: number | null
          type: string | null
        }
        Relationships: []
      }
      companies_summary: {
        Row: {
          address: string | null
          city: string | null
          context_links: Json | null
          country: string | null
          created_at: string | null
          description: string | null
          id: number | null
          linkedin_url: string | null
          logo: Json | null
          name: string | null
          nb_contacts: number | null
          nb_deals: number | null
          phone_number: string | null
          revenue: string | null
          sales_id: number | null
          sector: string | null
          size: number | null
          state_abbr: string | null
          tax_identifier: string | null
          website: string | null
          zipcode: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts_summary: {
        Row: {
          avatar: Json | null
          background: string | null
          company_id: number | null
          company_name: string | null
          email_fts: string | null
          email_jsonb: Json | null
          first_name: string | null
          first_seen: string | null
          gender: string | null
          has_newsletter: boolean | null
          id: number | null
          last_name: string | null
          last_seen: string | null
          linkedin_url: string | null
          nb_tasks: number | null
          phone_fts: string | null
          phone_jsonb: Json | null
          sales_id: number | null
          status: string | null
          tags: number[] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_sales_id_fkey"
            columns: ["sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      init_state: {
        Row: {
          is_initialized: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_avatar_for_email: { Args: { email: string }; Returns: string }
      get_domain_favicon: { Args: { domain_name: string }; Returns: string }
      get_note_attachments_function_url: { Args: never; Returns: string }
      get_user_id_by_email: {
        Args: { email: string }
        Returns: {
          id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      merge_contacts: {
        Args: { loser_id: number; winner_id: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
