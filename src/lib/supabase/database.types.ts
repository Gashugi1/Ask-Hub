export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor: string | null
          actor_name: string
          change_summary: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_label: string
          entity_type: string
          id: string
          ip_hash: string | null
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor?: string | null
          actor_name: string
          change_summary: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_label: string
          entity_type: string
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor?: string | null
          actor_name?: string
          change_summary?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_label?: string
          entity_type?: string
          id?: string
          ip_hash?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      compute_metrics: {
        Row: {
          attested_by: string
          attested_on: string
          created_at: string
          id: string
          label: string
          seed_key: string | null
          sort_order: number | null
          source: string
          sub_note: string | null
          updated_at: string
          value: string
        }
        Insert: {
          attested_by: string
          attested_on: string
          created_at?: string
          id?: string
          label: string
          seed_key?: string | null
          sort_order?: number | null
          source: string
          sub_note?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          attested_by?: string
          attested_on?: string
          created_at?: string
          id?: string
          label?: string
          seed_key?: string | null
          sort_order?: number | null
          source?: string
          sub_note?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_error: string | null
          email: string
          id: string
          message: string
          name: string
          source_ip_hash: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          email: string
          id?: string
          message: string
          name: string
          source_ip_hash?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          source_ip_hash?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      digest_sends: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          recipient_count: number
          resource_ids: string[]
          sent_at: string
          sent_by: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          recipient_count?: number
          resource_ids?: string[]
          sent_at?: string
          sent_by?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          recipient_count?: number
          resource_ids?: string[]
          sent_at?: string
          sent_by?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_events: {
        Row: {
          country_code: string | null
          created_at: string
          event_name: string
          filter_key: string | null
          filter_value: string | null
          id: string
          is_bot: boolean
          is_featured: boolean | null
          need: Database["public"]["Enums"]["need_type"] | null
          occurred_at: string
          resource_id: string | null
          search_term: string | null
          session_hash: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          event_name: string
          filter_key?: string | null
          filter_value?: string | null
          id?: string
          is_bot?: boolean
          is_featured?: boolean | null
          need?: Database["public"]["Enums"]["need_type"] | null
          occurred_at?: string
          resource_id?: string | null
          search_term?: string | null
          session_hash: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          event_name?: string
          filter_key?: string | null
          filter_value?: string | null
          id?: string
          is_bot?: boolean
          is_featured?: boolean | null
          need?: Database["public"]["Enums"]["need_type"] | null
          occurred_at?: string
          resource_id?: string | null
          search_term?: string | null
          session_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources_public"
            referencedColumns: ["id"]
          },
        ]
      }
      headline_stats: {
        Row: {
          attested_by: string
          attested_on: string
          created_at: string
          id: string
          is_hero: boolean
          label: string
          seed_key: string | null
          sort_order: number | null
          source: string
          updated_at: string
          value: string
        }
        Insert: {
          attested_by: string
          attested_on: string
          created_at?: string
          id?: string
          is_hero?: boolean
          label: string
          seed_key?: string | null
          sort_order?: number | null
          source: string
          updated_at?: string
          value: string
        }
        Update: {
          attested_by?: string
          attested_on?: string
          created_at?: string
          id?: string
          is_hero?: boolean
          label?: string
          seed_key?: string | null
          sort_order?: number | null
          source?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      impact_stories: {
        Row: {
          country: string
          created_at: string
          description: string
          id: string
          organisation: string
          seed_key: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          description?: string
          id?: string
          organisation: string
          seed_key?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          description?: string
          id?: string
          organisation?: string
          seed_key?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          is_ai_hub_partner: boolean
          logo_url: string | null
          name: string
          sort_order: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          is_ai_hub_partner?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          is_ai_hub_partner?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      partnerships: {
        Row: {
          created_at: string
          id: string
          note: string
          organisation: string
          owner: string | null
          sort_order: number | null
          stage: Database["public"]["Enums"]["partnership_stage"]
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          organisation: string
          owner?: string | null
          sort_order?: number | null
          stage?: Database["public"]["Enums"]["partnership_stage"]
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          organisation?: string
          owner?: string | null
          sort_order?: number | null
          stage?: Database["public"]["Enums"]["partnership_stage"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_label: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          is_active: boolean
          last_sign_in_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_label?: string
          email: string
          full_name?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_label?: string
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          created_at: string
          description: string
          id: string
          seed_key: string | null
          sort_order: number | null
          timeframe: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          seed_key?: string | null
          sort_order?: number | null
          timeframe?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          seed_key?: string | null
          sort_order?: number | null
          timeframe?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          action_label: string
          added_date: string
          banner_image_url: string | null
          countries_eligible: string[]
          created_at: string
          deadline: string | null
          description: string
          description_ar: string | null
          description_fr: string | null
          description_pt: string | null
          exclusivity: Database["public"]["Enums"]["exclusivity"] | null
          external_url: string
          geo_scope: Database["public"]["Enums"]["geo_scope"]
          id: string
          is_featured: boolean
          name: string
          need_primary: Database["public"]["Enums"]["need_type"]
          need_secondary: Database["public"]["Enums"]["need_type"] | null
          partner: string
          partner_tier: Database["public"]["Enums"]["partner_tier"]
          resource_type: string
          sectors_eligible: string[]
          sort_order: number | null
          stages_eligible: string[]
          status: Database["public"]["Enums"]["resource_status"]
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          action_label?: string
          added_date?: string
          banner_image_url?: string | null
          countries_eligible?: string[]
          created_at?: string
          deadline?: string | null
          description: string
          description_ar?: string | null
          description_fr?: string | null
          description_pt?: string | null
          exclusivity?: Database["public"]["Enums"]["exclusivity"] | null
          external_url: string
          geo_scope?: Database["public"]["Enums"]["geo_scope"]
          id?: string
          is_featured?: boolean
          name: string
          need_primary: Database["public"]["Enums"]["need_type"]
          need_secondary?: Database["public"]["Enums"]["need_type"] | null
          partner: string
          partner_tier: Database["public"]["Enums"]["partner_tier"]
          resource_type: string
          sectors_eligible?: string[]
          sort_order?: number | null
          stages_eligible?: string[]
          status?: Database["public"]["Enums"]["resource_status"]
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          action_label?: string
          added_date?: string
          banner_image_url?: string | null
          countries_eligible?: string[]
          created_at?: string
          deadline?: string | null
          description?: string
          description_ar?: string | null
          description_fr?: string | null
          description_pt?: string | null
          exclusivity?: Database["public"]["Enums"]["exclusivity"] | null
          external_url?: string
          geo_scope?: Database["public"]["Enums"]["geo_scope"]
          id?: string
          is_featured?: boolean
          name?: string
          need_primary?: Database["public"]["Enums"]["need_type"]
          need_secondary?: Database["public"]["Enums"]["need_type"] | null
          partner?: string
          partner_tier?: Database["public"]["Enums"]["partner_tier"]
          resource_type?: string
          sectors_eligible?: string[]
          sort_order?: number | null
          stages_eligible?: string[]
          status?: Database["public"]["Enums"]["resource_status"]
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_partner_fkey"
            columns: ["partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "resources_partner_fkey"
            columns: ["partner"]
            isOneToOne: false
            referencedRelation: "partners_public"
            referencedColumns: ["name"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string
          id: string
          key: string
          locale: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          locale?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          locale?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          description: string
          id: string
          link: string | null
          need: Database["public"]["Enums"]["need_type"] | null
          organisation: string | null
          programme_contact_email: string | null
          rejection_reason: string | null
          resource_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_ip_hash: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitter_email: string
          submitter_name: string | null
          target_resource_id: string | null
          type: Database["public"]["Enums"]["submission_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          link?: string | null
          need?: Database["public"]["Enums"]["need_type"] | null
          organisation?: string | null
          programme_contact_email?: string | null
          rejection_reason?: string | null
          resource_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_email: string
          submitter_name?: string | null
          target_resource_id?: string | null
          type: Database["public"]["Enums"]["submission_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          link?: string | null
          need?: Database["public"]["Enums"]["need_type"] | null
          organisation?: string | null
          programme_contact_email?: string | null
          rejection_reason?: string | null
          resource_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_ip_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitter_email?: string
          submitter_name?: string | null
          target_resource_id?: string | null
          type?: Database["public"]["Enums"]["submission_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_target_resource_id_fkey"
            columns: ["target_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_target_resource_id_fkey"
            columns: ["target_resource_id"]
            isOneToOne: false
            referencedRelation: "resources_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          categories: string[]
          confirm_token: string
          confirmed_at: string | null
          consent_at: string
          consent_text_version: string
          country: string | null
          created_at: string
          email: string
          id: string
          sector: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          categories?: string[]
          confirm_token: string
          confirmed_at?: string | null
          consent_at?: string
          consent_text_version: string
          country?: string | null
          created_at?: string
          email: string
          id?: string
          sector?: string | null
          unsubscribe_token: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          categories?: string[]
          confirm_token?: string
          confirmed_at?: string | null
          consent_at?: string
          consent_text_version?: string
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          sector?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      updates_log: {
        Row: {
          actor: string | null
          actor_name: string
          created_at: string
          id: string
          is_automatic: boolean
          occurred_at: string
          text: string
          updated_at: string
        }
        Insert: {
          actor?: string | null
          actor_name?: string
          created_at?: string
          id?: string
          is_automatic?: boolean
          occurred_at?: string
          text: string
          updated_at?: string
        }
        Update: {
          actor?: string | null
          actor_name?: string
          created_at?: string
          id?: string
          is_automatic?: boolean
          occurred_at?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "updates_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      compute_metrics_public: {
        Row: {
          id: string | null
          label: string | null
          sort_order: number | null
          sub_note: string | null
          value: string | null
        }
        Insert: {
          id?: string | null
          label?: string | null
          sort_order?: number | null
          sub_note?: string | null
          value?: string | null
        }
        Update: {
          id?: string | null
          label?: string | null
          sort_order?: number | null
          sub_note?: string | null
          value?: string | null
        }
        Relationships: []
      }
      headline_stats_public: {
        Row: {
          id: string | null
          is_hero: boolean | null
          label: string | null
          sort_order: number | null
          value: string | null
        }
        Insert: {
          id?: string | null
          is_hero?: boolean | null
          label?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Update: {
          id?: string | null
          is_hero?: boolean | null
          label?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Relationships: []
      }
      impact_stories_public: {
        Row: {
          country: string | null
          description: string | null
          id: string | null
          organisation: string | null
          sort_order: number | null
        }
        Insert: {
          country?: string | null
          description?: string | null
          id?: string | null
          organisation?: string | null
          sort_order?: number | null
        }
        Update: {
          country?: string | null
          description?: string | null
          id?: string | null
          organisation?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      need_counts_public: {
        Row: {
          live_count: number | null
          need: Database["public"]["Enums"]["need_type"] | null
        }
        Relationships: []
      }
      partners_public: {
        Row: {
          logo_url: string | null
          name: string | null
          sort_order: number | null
          website_url: string | null
        }
        Insert: {
          logo_url?: string | null
          name?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Update: {
          logo_url?: string | null
          name?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      programmes_public: {
        Row: {
          description: string | null
          id: string | null
          sort_order: number | null
          timeframe: string | null
          title: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          sort_order?: number | null
          timeframe?: string | null
          title?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          sort_order?: number | null
          timeframe?: string | null
          title?: string | null
        }
        Relationships: []
      }
      resources_public: {
        Row: {
          action_label: string | null
          added_date: string | null
          banner_image_url: string | null
          countries_eligible: string[] | null
          days_left: number | null
          deadline: string | null
          description: string | null
          description_ar: string | null
          description_fr: string | null
          description_pt: string | null
          exclusivity: Database["public"]["Enums"]["exclusivity"] | null
          external_url: string | null
          geo_scope: Database["public"]["Enums"]["geo_scope"] | null
          id: string | null
          is_closed: boolean | null
          is_featured: boolean | null
          name: string | null
          need_primary: Database["public"]["Enums"]["need_type"] | null
          need_secondary: Database["public"]["Enums"]["need_type"] | null
          partner_logo_url: string | null
          partner_name: string | null
          partner_tier: Database["public"]["Enums"]["partner_tier"] | null
          partner_website_url: string | null
          resource_type: string | null
          sectors_eligible: string[] | null
          sort_order: number | null
          stages_eligible: string[] | null
          sub_category: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_partner_fkey"
            columns: ["partner_name"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "resources_partner_fkey"
            columns: ["partner_name"]
            isOneToOne: false
            referencedRelation: "partners_public"
            referencedColumns: ["name"]
          },
        ]
      }
      settings_public: {
        Row: {
          key: string | null
          value: Json | null
        }
        Insert: {
          key?: string | null
          value?: Json | null
        }
        Update: {
          key?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      site_content_public: {
        Row: {
          key: string | null
          locale: string | null
          value: string | null
        }
        Insert: {
          key?: string | null
          locale?: string | null
          value?: string | null
        }
        Update: {
          key?: string | null
          locale?: string | null
          value?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_change_summary: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_diff: Json
          p_entity_type: string
        }
        Returns: string
      }
      audit_sentence_case: { Args: { p_value: string }; Returns: string }
      column_names: {
        Args: { table_name: string }
        Returns: {
          column_name: string
        }[]
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      enum_labels: {
        Args: never
        Returns: {
          enum_name: string
          labels: string[]
        }[]
      }
      function_privileges: {
        Args: never
        Returns: {
          can_execute: boolean
          grantee: string
          identity_args: string
          proname: string
          search_path_pinned: boolean
          security_definer: boolean
        }[]
      }
      index_names: {
        Args: { table_name: string }
        Returns: {
          index_name: string
        }[]
      }
      policy_inventory: {
        Args: never
        Returns: {
          cmd: string
          policyname: string
          roles: string[]
          tablename: string
        }[]
      }
      relation_columns: {
        Args: never
        Returns: {
          col_comment: string
          column_name: string
          relkind: string
          relname: string
          type_name: string
          type_schema: string
        }[]
      }
      relation_privileges: {
        Args: never
        Returns: {
          column_only: boolean
          grantee: string
          privilege: string
          relkind: string
          relname: string
        }[]
      }
      relation_security: {
        Args: never
        Returns: {
          owner: string
          policy_count: number
          relkind: string
          relname: string
          rls_enabled: boolean
          rls_forced: boolean
        }[]
      }
      submit_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string }
        Returns: undefined
      }
      submit_resource_suggestion: {
        Args: {
          p_description: string
          p_link: string
          p_need: string
          p_organisation: string
          p_programme_contact_email: string
          p_resource_name: string
          p_source_ip_hash: string
          p_submitter_email: string
          p_submitter_name: string
        }
        Returns: undefined
      }
      test_break_audit_log: { Args: never; Returns: undefined }
      test_unbreak_audit_log: { Args: never; Returns: undefined }
      trigger_inventory: {
        Args: never
        Returns: {
          argument_count: number
          function_name: string
          table_name: string
          trigger_name: string
        }[]
      }
      view_column_sources: {
        Args: never
        Returns: {
          base_column: string
          base_table: string
          view_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      audit_action:
        | "published"
        | "edited"
        | "created"
        | "deleted"
        | "approved"
        | "rejected"
        | "role_changed"
        | "digest_sent"
      exclusivity: "exclusive" | "early_access"
      geo_scope: "global" | "all_africa" | "partner_countries" | "specific"
      need_type:
        | "compute"
        | "training"
        | "funding"
        | "accelerator"
        | "partners"
        | "data"
        | "challenges"
        | "community"
      partner_tier:
        | "strategic"
        | "government"
        | "development_partner"
        | "academic"
        | "network"
      partnership_stage:
        | "prospecting"
        | "in_discussion"
        | "active"
        | "delivered"
      resource_status: "live" | "pipeline" | "reference"
      submission_status: "pending" | "approved" | "rejected"
      submission_type: "new_resource" | "update_suggestion"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      audit_action: [
        "published",
        "edited",
        "created",
        "deleted",
        "approved",
        "rejected",
        "role_changed",
        "digest_sent",
      ],
      exclusivity: ["exclusive", "early_access"],
      geo_scope: ["global", "all_africa", "partner_countries", "specific"],
      need_type: [
        "compute",
        "training",
        "funding",
        "accelerator",
        "partners",
        "data",
        "challenges",
        "community",
      ],
      partner_tier: [
        "strategic",
        "government",
        "development_partner",
        "academic",
        "network",
      ],
      partnership_stage: [
        "prospecting",
        "in_discussion",
        "active",
        "delivered",
      ],
      resource_status: ["live", "pipeline", "reference"],
      submission_status: ["pending", "approved", "rejected"],
      submission_type: ["new_resource", "update_suggestion"],
    },
  },
} as const

