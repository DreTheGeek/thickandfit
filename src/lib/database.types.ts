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
      admin_settings: {
        Row: {
          company_id: string
          maintenance_note: string | null
          signup_enabled: boolean
          support_email: string | null
          support_hours: string | null
          support_phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          maintenance_note?: string | null
          signup_enabled?: boolean
          support_email?: string | null
          support_hours?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          maintenance_note?: string | null
          signup_enabled?: boolean
          support_email?: string | null
          support_hours?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_eval_cases: {
        Row: {
          ai_eval_id: string
          company_id: string
          created_at: string
          expected: Json
          id: string
          input: Json
        }
        Insert: {
          ai_eval_id: string
          company_id: string
          created_at?: string
          expected: Json
          id?: string
          input: Json
        }
        Update: {
          ai_eval_id?: string
          company_id?: string
          created_at?: string
          expected?: Json
          id?: string
          input?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_eval_cases_ai_eval_id_fkey"
            columns: ["ai_eval_id"]
            isOneToOne: false
            referencedRelation: "ai_evals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_eval_cases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_eval_runs: {
        Row: {
          actual: Json | null
          ai_eval_case_id: string | null
          ai_eval_id: string
          company_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          passed: boolean
          prompt_version: string | null
          run_id: string | null
          score: number | null
        }
        Insert: {
          actual?: Json | null
          ai_eval_case_id?: string | null
          ai_eval_id: string
          company_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          passed: boolean
          prompt_version?: string | null
          run_id?: string | null
          score?: number | null
        }
        Update: {
          actual?: Json | null
          ai_eval_case_id?: string | null
          ai_eval_id?: string
          company_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          passed?: boolean
          prompt_version?: string | null
          run_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_eval_runs_ai_eval_case_id_fkey"
            columns: ["ai_eval_case_id"]
            isOneToOne: false
            referencedRelation: "ai_eval_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_eval_runs_ai_eval_id_fkey"
            columns: ["ai_eval_id"]
            isOneToOne: false
            referencedRelation: "ai_evals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_eval_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evals: {
        Row: {
          company_id: string
          created_at: string
          feature: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          feature: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          feature?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_evals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inferences: {
        Row: {
          company_id: string
          confidence: number | null
          corrected_at: string | null
          correction: Json | null
          created_at: string
          feature: string
          id: string
          input_hash: string | null
          item_count: number | null
          latency_ms: number | null
          model: string
          profile_id: string | null
          prompt_version: string | null
          raw_output: Json | null
          status: string | null
          user_marked_correct: boolean | null
        }
        Insert: {
          company_id: string
          confidence?: number | null
          corrected_at?: string | null
          correction?: Json | null
          created_at?: string
          feature: string
          id?: string
          input_hash?: string | null
          item_count?: number | null
          latency_ms?: number | null
          model: string
          profile_id?: string | null
          prompt_version?: string | null
          raw_output?: Json | null
          status?: string | null
          user_marked_correct?: boolean | null
        }
        Update: {
          company_id?: string
          confidence?: number | null
          corrected_at?: string | null
          correction?: Json | null
          created_at?: string
          feature?: string
          id?: string
          input_hash?: string | null
          item_count?: number | null
          latency_ms?: number | null
          model?: string
          profile_id?: string | null
          prompt_version?: string | null
          raw_output?: Json | null
          status?: string | null
          user_marked_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_inferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_trace: {
        Row: {
          company_id: string
          completion_tokens: number | null
          correlation_id: string | null
          cost_cents: number | null
          error: string | null
          feature: string
          id: number
          input_preview: string | null
          latency_ms: number | null
          model: string | null
          operation: string
          output_preview: string | null
          profile_id: string | null
          prompt_tokens: number | null
          retrieval_count: number | null
          status: string
          ts: string
        }
        Insert: {
          company_id?: string
          completion_tokens?: number | null
          correlation_id?: string | null
          cost_cents?: number | null
          error?: string | null
          feature: string
          id?: never
          input_preview?: string | null
          latency_ms?: number | null
          model?: string | null
          operation: string
          output_preview?: string | null
          profile_id?: string | null
          prompt_tokens?: number | null
          retrieval_count?: number | null
          status: string
          ts?: string
        }
        Update: {
          company_id?: string
          completion_tokens?: number | null
          correlation_id?: string | null
          cost_cents?: number | null
          error?: string | null
          feature?: string
          id?: never
          input_preview?: string | null
          latency_ms?: number | null
          model?: string | null
          operation?: string
          output_preview?: string | null
          profile_id?: string | null
          prompt_tokens?: number | null
          retrieval_count?: number | null
          status?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_trace_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          company_id: string
          completion_tokens: number
          cost_cents: number
          created_at: string
          feature: string
          id: string
          model: string
          prompt_tokens: number
          user_id: string
        }
        Insert: {
          company_id: string
          completion_tokens?: number
          cost_cents?: number
          created_at?: string
          feature: string
          id?: string
          model: string
          prompt_tokens?: number
          user_id: string
        }
        Update: {
          company_id?: string
          completion_tokens?: number
          cost_cents?: number
          created_at?: string
          feature?: string
          id?: string
          model?: string
          prompt_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          company_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_log: {
        Row: {
          company_id: string | null
          duration_ms: number | null
          error: string | null
          id: number
          ip: string | null
          method: string
          path: string
          raw_path: string | null
          status: number
          ts: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          ip?: string | null
          method: string
          path: string
          raw_path?: string | null
          status: number
          ts?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          ip?: string | null
          method?: string
          path?: string
          raw_path?: string | null
          status?: number
          ts?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_usage_log: {
        Row: {
          api_key_id: string | null
          company_id: string | null
          created_at: string
          id: string
          latency_ms: number | null
          method: string
          route: string
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          method: string
          route: string
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          method?: string
          route?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string
          company_id: string
          created_at: string
          decision_note: string | null
          drafted_by: string
          id: string
          item_ref: string | null
          item_type: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          company_id: string
          created_at?: string
          decision_note?: string | null
          drafted_by: string
          id?: string
          item_ref?: string | null
          item_type: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          decision_note?: string | null
          drafted_by?: string
          id?: string
          item_ref?: string | null
          item_type?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_queue_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_queue_drafted_by_fkey"
            columns: ["drafted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_state: Json | null
          previous_state: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          description_en: string
          description_es: string
          icon: string
          id: string
          key: string
          kind: string
          name_en: string
          name_es: string
          sort_order: number
          threshold: number
        }
        Insert: {
          created_at?: string
          description_en: string
          description_es: string
          icon: string
          id?: string
          key: string
          kind: string
          name_en: string
          name_es: string
          sort_order?: number
          threshold: number
        }
        Update: {
          created_at?: string
          description_en?: string
          description_es?: string
          icon?: string
          id?: string
          key?: string
          kind?: string
          name_en?: string
          name_es?: string
          sort_order?: number
          threshold?: number
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arms_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          company_id: string
          contact_id: string | null
          created_at: string
          hips_cm: number | null
          id: string
          profile_id: string | null
          recorded_on: string
          source: string
          thighs_cm: number | null
          waist_cm: number | null
        }
        Insert: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          profile_id?: string | null
          recorded_on?: string
          source?: string
          thighs_cm?: number | null
          waist_cm?: number | null
        }
        Update: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          profile_id?: string | null
          recorded_on?: string
          source?: string
          thighs_cm?: number | null
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_measurements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_measurements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_reasons: {
        Row: {
          company_id: string
          created_at: string
          id: string
          profile_id: string
          reason_code: string | null
          reason_text: string | null
          subscription_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          reason_code?: string | null
          reason_text?: string | null
          subscription_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          reason_code?: string | null
          reason_text?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_reasons_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_reasons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          company_id: string
          id: string
          joined_at: string
          profile_id: string
          progress: number
          updated_at: string
        }
        Insert: {
          challenge_id: string
          company_id: string
          id?: string
          joined_at?: string
          profile_id: string
          progress?: number
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          company_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
          progress?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          finalized_at: string | null
          goal: number | null
          id: string
          metric: string
          metric_unit: string | null
          start_notified_at: string | null
          starts_on: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          finalized_at?: string | null
          goal?: number | null
          id?: string
          metric?: string
          metric_unit?: string | null
          start_notified_at?: string | null
          starts_on: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          finalized_at?: string | null
          goal?: number | null
          id?: string
          metric?: string
          metric_unit?: string | null
          start_notified_at?: string | null
          starts_on?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_intake: {
        Row: {
          activity_level: string | null
          allergies: string | null
          bad_habits: string | null
          birth_date: string | null
          bmr: number | null
          calorie_goal_kcal: number | null
          company_id: string
          contact_id: string
          created_at: string
          custom_fields: Json | null
          dietary_exclusions: string[] | null
          eating_disorder_screening: Json | null
          goal_intensity: number | null
          goal_type: string | null
          height_cm: number | null
          id: string
          injuries: string[] | null
          injuries_description: string | null
          intake_extraction: Json | null
          intake_notes: string | null
          medical_conditions: string | null
          needs_coach_review: boolean
          profile_id: string | null
          questionnaire_filled_at: string | null
          raw: Json | null
          sex: string | null
          sleep_assessment: Json | null
          source: string
          starting_weight_kg: number | null
          target_weight_kg: number | null
          training_experience: string | null
          updated_at: string
        }
        Insert: {
          activity_level?: string | null
          allergies?: string | null
          bad_habits?: string | null
          birth_date?: string | null
          bmr?: number | null
          calorie_goal_kcal?: number | null
          company_id: string
          contact_id: string
          created_at?: string
          custom_fields?: Json | null
          dietary_exclusions?: string[] | null
          eating_disorder_screening?: Json | null
          goal_intensity?: number | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string[] | null
          injuries_description?: string | null
          intake_extraction?: Json | null
          intake_notes?: string | null
          medical_conditions?: string | null
          needs_coach_review?: boolean
          profile_id?: string | null
          questionnaire_filled_at?: string | null
          raw?: Json | null
          sex?: string | null
          sleep_assessment?: Json | null
          source?: string
          starting_weight_kg?: number | null
          target_weight_kg?: number | null
          training_experience?: string | null
          updated_at?: string
        }
        Update: {
          activity_level?: string | null
          allergies?: string | null
          bad_habits?: string | null
          birth_date?: string | null
          bmr?: number | null
          calorie_goal_kcal?: number | null
          company_id?: string
          contact_id?: string
          created_at?: string
          custom_fields?: Json | null
          dietary_exclusions?: string[] | null
          eating_disorder_screening?: Json | null
          goal_intensity?: number | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string[] | null
          injuries_description?: string | null
          intake_extraction?: Json | null
          intake_notes?: string | null
          medical_conditions?: string | null
          needs_coach_review?: boolean
          profile_id?: string | null
          questionnaire_filled_at?: string | null
          raw?: Json | null
          sex?: string | null
          sleep_assessment?: Json | null
          source?: string
          starting_weight_kg?: number | null
          target_weight_kg?: number | null
          training_experience?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_intake_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intake_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intake_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          attachments: Json | null
          body: string | null
          company_id: string
          contact_id: string
          created_at: string
          external_id: string | null
          has_attachments: boolean
          id: string
          is_from_coach: boolean
          msg_type: string | null
          profile_id: string | null
          read_at: string | null
          sender_name: string | null
          sent_at: string
          source: string
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          external_id?: string | null
          has_attachments?: boolean
          id?: string
          is_from_coach: boolean
          msg_type?: string | null
          profile_id?: string | null
          read_at?: string | null
          sender_name?: string | null
          sent_at: string
          source?: string
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          external_id?: string | null
          has_attachments?: boolean
          id?: string
          is_from_coach?: boolean
          msg_type?: string | null
          profile_id?: string | null
          read_at?: string | null
          sender_name?: string | null
          sent_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          billing_health: string | null
          company_id: string
          contact_id: string
          created_at: string
          currency: string
          days_since_last_charge: number | null
          ended_at: string | null
          grandfathered_price_cents: number | null
          id: string
          is_auto_renew: boolean | null
          is_legacy: boolean
          last_charge_date: string | null
          lifetime_paid_cents: number | null
          meal_plan_sent_at: string | null
          next_amount_cents: number | null
          next_billing_date: string | null
          num_charges: number | null
          product_type: string | null
          source: string
          started_at: string | null
          status: string
          updated_at: string
          workout_plan_sent_at: string | null
        }
        Insert: {
          billing_health?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          currency?: string
          days_since_last_charge?: number | null
          ended_at?: string | null
          grandfathered_price_cents?: number | null
          id?: string
          is_auto_renew?: boolean | null
          is_legacy?: boolean
          last_charge_date?: string | null
          lifetime_paid_cents?: number | null
          meal_plan_sent_at?: string | null
          next_amount_cents?: number | null
          next_billing_date?: string | null
          num_charges?: number | null
          product_type?: string | null
          source?: string
          started_at?: string | null
          status: string
          updated_at?: string
          workout_plan_sent_at?: string | null
        }
        Update: {
          billing_health?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          currency?: string
          days_since_last_charge?: number | null
          ended_at?: string | null
          grandfathered_price_cents?: number | null
          id?: string
          is_auto_renew?: boolean | null
          is_legacy?: boolean
          last_charge_date?: string | null
          lifetime_paid_cents?: number | null
          meal_plan_sent_at?: string | null
          next_amount_cents?: number | null
          next_billing_date?: string | null
          num_charges?: number | null
          product_type?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          workout_plan_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workout_history: {
        Row: {
          company_id: string
          completion_pct: number | null
          contact_id: string
          created_at: string
          enjoyment: number | null
          exhaustion: number | null
          external_id: string | null
          id: string
          is_client_created: boolean | null
          performed_at: string
          plan_name: string | null
          profile_id: string | null
          session_name: string | null
          source: string
        }
        Insert: {
          company_id: string
          completion_pct?: number | null
          contact_id: string
          created_at?: string
          enjoyment?: number | null
          exhaustion?: number | null
          external_id?: string | null
          id?: string
          is_client_created?: boolean | null
          performed_at: string
          plan_name?: string | null
          profile_id?: string | null
          session_name?: string | null
          source?: string
        }
        Update: {
          company_id?: string
          completion_pct?: number | null
          contact_id?: string
          created_at?: string
          enjoyment?: number | null
          exhaustion?: number | null
          external_id?: string | null
          id?: string
          is_client_created?: boolean | null
          performed_at?: string
          plan_name?: string | null
          profile_id?: string | null
          session_name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_workout_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workout_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workout_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_interview_answers: {
        Row: {
          answer: string | null
          answered_by: string | null
          company_id: string
          created_at: string
          id: string
          question_key: string
          section: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          question_key: string
          section: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          question_key?: string
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_interview_answers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_knowledge: {
        Row: {
          chunk_index: number
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          embedding: string | null
          id: string
          source_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          company_id: string
          content: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          source_id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          source_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          author_id: string | null
          body: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          author_id?: string | null
          body: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          author_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_assignments: {
        Row: {
          assigned_by: string | null
          assistant_id: string
          client_id: string
          company_id: string
          created_at: string
          id: string
          monthly_rate_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assistant_id: string
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          monthly_rate_cents?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assistant_id?: string
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          monthly_rate_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_assignments_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      community_blocks: {
        Row: {
          blocked_profile_id: string
          blocker_profile_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_profile_id: string
          blocker_profile_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_profile_id?: string
          blocker_profile_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_blocks_blocked_profile_id_fkey"
            columns: ["blocked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_blocks_blocker_profile_id_fkey"
            columns: ["blocker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_profile_id: string
          body: string
          company_id: string
          created_at: string
          id: string
          is_broadcast: boolean
          media_url: string | null
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          body: string
          company_id: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          media_url?: string | null
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          media_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          company_id: string
          created_at: string
          id: string
          note: string | null
          post_id: string
          reason: string
          reported_profile_id: string | null
          reporter_profile_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
          reason: string
          reported_profile_id?: string | null
          reporter_profile_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
          reason?: string
          reported_profile_id?: string | null
          reporter_profile_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_captures: {
        Row: {
          accepted: boolean
          company_id: string
          consent_type: string
          consent_version: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted: boolean
          company_id: string
          consent_type: string
          consent_version: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          company_id?: string
          consent_type?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_captures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_files: {
        Row: {
          bytes: number | null
          category: string | null
          company_id: string
          contact_id: string
          created_at: string
          id: string
          url: string
        }
        Insert: {
          bytes?: number | null
          category?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          url: string
        }
        Update: {
          bytes?: number | null
          category?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_files_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_transactions: {
        Row: {
          category: string | null
          coach_cents: number | null
          company_id: string
          contact_id: string | null
          created_at: string
          currency: string
          gross_cents: number | null
          id: string
          is_independent: boolean | null
          is_pt_client: boolean | null
          lenus_customer_id: string | null
          lenus_txn_id: string | null
          occurred_at: string | null
          source: string
        }
        Insert: {
          category?: string | null
          coach_cents?: number | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          gross_cents?: number | null
          id?: string
          is_independent?: boolean | null
          is_pt_client?: boolean | null
          lenus_customer_id?: string | null
          lenus_txn_id?: string | null
          occurred_at?: string | null
          source?: string
        }
        Update: {
          category?: string | null
          coach_cents?: number | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          gross_cents?: number | null
          id?: string
          is_independent?: boolean | null
          is_pt_client?: boolean | null
          lenus_customer_id?: string | null
          lenus_txn_id?: string | null
          occurred_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          first_name: string | null
          ghl_contact_id: string | null
          id: string
          is_duplicate: boolean
          is_legacy: boolean
          is_referred: boolean
          language: string | null
          last_name: string | null
          lead_stage: string | null
          lead_type: string | null
          legacy_source: string | null
          lenus_id: string | null
          lifecycle_stage: string
          lost_reason: string | null
          owner: string | null
          phone: string | null
          product_type: string | null
          profile_id: string | null
          source: string
          type: string
          updated_at: string
          was_lead: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          ghl_contact_id?: string | null
          id?: string
          is_duplicate?: boolean
          is_legacy?: boolean
          is_referred?: boolean
          language?: string | null
          last_name?: string | null
          lead_stage?: string | null
          lead_type?: string | null
          legacy_source?: string | null
          lenus_id?: string | null
          lifecycle_stage?: string
          lost_reason?: string | null
          owner?: string | null
          phone?: string | null
          product_type?: string | null
          profile_id?: string | null
          source?: string
          type: string
          updated_at?: string
          was_lead?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          ghl_contact_id?: string | null
          id?: string
          is_duplicate?: boolean
          is_legacy?: boolean
          is_referred?: boolean
          language?: string | null
          last_name?: string | null
          lead_stage?: string | null
          lead_type?: string | null
          legacy_source?: string | null
          lenus_id?: string | null
          lifecycle_stage?: string
          lost_reason?: string | null
          owner?: string | null
          phone?: string | null
          product_type?: string | null
          profile_id?: string | null
          source?: string
          type?: string
          updated_at?: string
          was_lead?: boolean
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
            foreignKeyName: "contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cooked_uncooked_ratios: {
        Row: {
          category: string | null
          created_at: string
          factor: number
          food_id: string | null
          id: string
          state_from: string
          state_to: string
          usda_source: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          factor: number
          food_id?: string | null
          id?: string
          state_from?: string
          state_to?: string
          usda_source?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          factor?: number
          food_id?: string | null
          id?: string
          state_from?: string
          state_to?: string
          usda_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cooked_uncooked_ratios_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_log: {
        Row: {
          detail: Json | null
          id: string
          job_name: string
          ran_at: string
          status: string
        }
        Insert: {
          detail?: Json | null
          id?: string
          job_name: string
          ran_at?: string
          status: string
        }
        Update: {
          detail?: Json | null
          id?: string
          job_name?: string
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
      cycle_logs: {
        Row: {
          company_id: string
          created_at: string
          ended_on: string | null
          flow: string | null
          id: string
          notes: string | null
          profile_id: string
          started_on: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ended_on?: string | null
          flow?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          started_on: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ended_on?: string | null
          flow?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          started_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          company_id: string
          created_at: string
          id: string
          on_date: string
          profile_id: string
          sleep_minutes: number | null
          source: string
          steps: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          on_date?: string
          profile_id: string
          sleep_minutes?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          on_date?: string
          profile_id?: string
          sleep_minutes?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          company_id: string
          correlation_id: string | null
          created_at: string
          device_type: string | null
          event_type: string
          event_version: number
          id: string
          idempotency_key: string
          locale: string | null
          payload: Json
          profile_id: string | null
          source: string
          timezone_offset_minutes: number | null
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          company_id: string
          correlation_id?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          event_version?: number
          id?: string
          idempotency_key: string
          locale?: string | null
          payload?: Json
          profile_id?: string | null
          source?: string
          timezone_offset_minutes?: number | null
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          company_id?: string
          correlation_id?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          event_version?: number
          id?: string
          idempotency_key?: string
          locale?: string | null
          payload?: Json
          profile_id?: string | null
          source?: string
          timezone_offset_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          company_id: string
          created_at: string
          id: string
          provider_message_id: string | null
          status: string
          template: string
          to_email: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          provider_message_id?: string | null
          status?: string
          template: string
          to_email: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          provider_message_id?: string | null
          status?: string
          template?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppression_list: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          external_txn_id: string
          id: string
          product_key: string
          profile_id: string
          raw_payload: Json | null
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          external_txn_id: string
          id?: string
          product_key?: string
          profile_id: string
          raw_payload?: Json | null
          source: string
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          external_txn_id?: string
          id?: string
          product_key?: string
          profile_id?: string
          raw_payload?: Json | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_run: {
        Row: {
          cases: number
          commit_sha: string | null
          company_id: string
          created_at: string
          id: string
          metrics: Json
          passed: number
          score: number | null
          status: string
          suite: string
        }
        Insert: {
          cases?: number
          commit_sha?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          passed?: number
          score?: number | null
          status?: string
          suite: string
        }
        Update: {
          cases?: number
          commit_sha?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          passed?: number
          score?: number | null
          status?: string
          suite?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_run_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_equipment_types: {
        Row: {
          key: string
          label_en: string
          label_es: string | null
        }
        Insert: {
          key: string
          label_en: string
          label_es?: string | null
        }
        Update: {
          key?: string
          label_en?: string
          label_es?: string | null
        }
        Relationships: []
      }
      exercise_substitutions: {
        Row: {
          company_id: string
          context: Database["public"]["Enums"]["substitution_context"]
          created_at: string
          exercise_id: string
          id: string
          reason_tag: string | null
          sort_order: number
          substitute_exercise_id: string
        }
        Insert: {
          company_id: string
          context: Database["public"]["Enums"]["substitution_context"]
          created_at?: string
          exercise_id: string
          id?: string
          reason_tag?: string | null
          sort_order?: number
          substitute_exercise_id: string
        }
        Update: {
          company_id?: string
          context?: Database["public"]["Enums"]["substitution_context"]
          created_at?: string
          exercise_id?: string
          id?: string
          reason_tag?: string | null
          sort_order?: number
          substitute_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_substitutions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_substitutions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_substitutions_reason_tag_fkey"
            columns: ["reason_tag"]
            isOneToOne: false
            referencedRelation: "substitution_reason_tags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "exercise_substitutions_substitute_exercise_id_fkey"
            columns: ["substitute_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          category: string | null
          company_id: string | null
          created_at: string
          cues_en: string | null
          cues_es: string | null
          difficulty: string | null
          equipment: string | null
          id: string
          is_core: boolean
          is_own_demo: boolean
          muscle_group: string | null
          name_en: string
          name_es: string | null
          secondary_muscles: string[]
          video_mux_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          cues_en?: string | null
          cues_es?: string | null
          difficulty?: string | null
          equipment?: string | null
          id?: string
          is_core?: boolean
          is_own_demo?: boolean
          muscle_group?: string | null
          name_en: string
          name_es?: string | null
          secondary_muscles?: string[]
          video_mux_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          cues_en?: string | null
          cues_es?: string | null
          difficulty?: string | null
          equipment?: string | null
          id?: string
          is_core?: boolean
          is_own_demo?: boolean
          muscle_group?: string | null
          name_en?: string
          name_es?: string | null
          secondary_muscles?: string[]
          video_mux_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      food_log: {
        Row: {
          ai_inference_id: string | null
          amount: number | null
          carb_g: number
          company_id: string
          confidence_score: number | null
          contact_id: string | null
          corrected_at: string | null
          created_at: string
          embedding: string | null
          fat_g: number
          food_id: string | null
          grams: number | null
          id: string
          kcal: number
          log_date: string
          log_summary: string | null
          logged_at: string
          meal_slot: string | null
          name: string | null
          note: string | null
          portion_id: string | null
          predicted_grams: number | null
          profile_id: string | null
          protein_g: number
          recipe_id: string | null
          source: string
        }
        Insert: {
          ai_inference_id?: string | null
          amount?: number | null
          carb_g?: number
          company_id: string
          confidence_score?: number | null
          contact_id?: string | null
          corrected_at?: string | null
          created_at?: string
          embedding?: string | null
          fat_g?: number
          food_id?: string | null
          grams?: number | null
          id?: string
          kcal?: number
          log_date?: string
          log_summary?: string | null
          logged_at?: string
          meal_slot?: string | null
          name?: string | null
          note?: string | null
          portion_id?: string | null
          predicted_grams?: number | null
          profile_id?: string | null
          protein_g?: number
          recipe_id?: string | null
          source?: string
        }
        Update: {
          ai_inference_id?: string | null
          amount?: number | null
          carb_g?: number
          company_id?: string
          confidence_score?: number | null
          contact_id?: string | null
          corrected_at?: string | null
          created_at?: string
          embedding?: string | null
          fat_g?: number
          food_id?: string | null
          grams?: number | null
          id?: string
          kcal?: number
          log_date?: string
          log_summary?: string | null
          logged_at?: string
          meal_slot?: string | null
          name?: string | null
          note?: string | null
          portion_id?: string | null
          predicted_grams?: number | null
          profile_id?: string | null
          protein_g?: number
          recipe_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_log_ai_inference_id_fkey"
            columns: ["ai_inference_id"]
            isOneToOne: false
            referencedRelation: "ai_inferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_portion_id_fkey"
            columns: ["portion_id"]
            isOneToOne: false
            referencedRelation: "food_portions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      food_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          id: string
          meal_slot: string | null
          profile_id: string
          storage_path: string
          taken_on: string
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          meal_slot?: string | null
          profile_id: string
          storage_path: string
          taken_on?: string
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          meal_slot?: string | null
          profile_id?: string
          storage_path?: string
          taken_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_portions: {
        Row: {
          created_at: string
          food_id: string
          grams: number
          id: string
          is_cooked: boolean
          is_default: boolean
          label_en: string
          label_es: string | null
        }
        Insert: {
          created_at?: string
          food_id: string
          grams: number
          id?: string
          is_cooked?: boolean
          is_default?: boolean
          label_en: string
          label_es?: string | null
        }
        Update: {
          created_at?: string
          food_id?: string
          grams?: number
          id?: string
          is_cooked?: boolean
          is_default?: boolean
          label_en?: string
          label_es?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_portions_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          calcium_mg: number | null
          carb_g: number
          category: string | null
          cholesterol_mg: number | null
          company_id: string | null
          confidence: number | null
          created_at: string
          density_g_per_ml: number | null
          embedding: string | null
          fat_g: number
          fiber_g: number | null
          folate_mcg: number | null
          id: string
          iron_mg: number | null
          is_verified: boolean
          kcal: number
          magnesium_mg: number | null
          mono_fat_g: number | null
          name_en: string
          name_es: string | null
          poly_fat_g: number | null
          potassium_mg: number | null
          protein_g: number
          sat_fat_g: number | null
          search_text: string | null
          sodium_mg: number | null
          source: string
          source_id: string | null
          source_url: string | null
          sugar_g: number | null
          trans_fat_g: number | null
          updated_at: string
          vitamin_a_mcg_rae: number | null
          vitamin_b12_mcg: number | null
          vitamin_c_mg: number | null
          vitamin_d_mcg: number | null
          zinc_mg: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          carb_g?: number
          category?: string | null
          cholesterol_mg?: number | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string
          density_g_per_ml?: number | null
          embedding?: string | null
          fat_g?: number
          fiber_g?: number | null
          folate_mcg?: number | null
          id?: string
          iron_mg?: number | null
          is_verified?: boolean
          kcal?: number
          magnesium_mg?: number | null
          mono_fat_g?: number | null
          name_en: string
          name_es?: string | null
          poly_fat_g?: number | null
          potassium_mg?: number | null
          protein_g?: number
          sat_fat_g?: number | null
          search_text?: string | null
          sodium_mg?: number | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          vitamin_a_mcg_rae?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
          zinc_mg?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          carb_g?: number
          category?: string | null
          cholesterol_mg?: number | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string
          density_g_per_ml?: number | null
          embedding?: string | null
          fat_g?: number
          fiber_g?: number | null
          folate_mcg?: number | null
          id?: string
          iron_mg?: number | null
          is_verified?: boolean
          kcal?: number
          magnesium_mg?: number | null
          mono_fat_g?: number | null
          name_en?: string
          name_es?: string | null
          poly_fat_g?: number | null
          potassium_mg?: number | null
          protein_g?: number
          sat_fat_g?: number | null
          search_text?: string | null
          sodium_mg?: number | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          vitamin_a_mcg_rae?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
          zinc_mg?: number | null
        }
        Relationships: []
      }
      form_assignments: {
        Row: {
          assigned_at: string
          company_id: string
          form_id: string
          id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          company_id: string
          form_id: string
          id?: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          company_id?: string
          form_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          form_id: string
          id: string
          label_en: string
          label_es: string | null
          required: boolean
          sort_order: number
          type: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          form_id: string
          id?: string
          label_en: string
          label_es?: string | null
          required?: boolean
          sort_order?: number
          type: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          form_id?: string
          id?: string
          label_en?: string
          label_es?: string | null
          required?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          answers: Json
          company_id: string
          form_id: string
          form_version: number
          id: string
          profile_id: string
          submitted_at: string
        }
        Insert: {
          answers?: Json
          company_id: string
          form_id: string
          form_version?: number
          id?: string
          profile_id: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          company_id?: string
          form_id?: string
          form_version?: number
          id?: string
          profile_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          title_en: string
          title_es: string | null
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title_en: string
          title_es?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title_en?: string
          title_es?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "forms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          company_id: string
          created_at: string
          done: boolean
          habit_id: string
          id: string
          logged_date: string
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          done?: boolean
          habit_id: string
          id?: string
          logged_date: string
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          done?: boolean
          habit_id?: string
          id?: string
          logged_date?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          cadence: string
          company_id: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          profile_id: string
          sort_order: number
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          company_id: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          profile_id: string
          sort_order?: number
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          company_id?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          profile_id?: string
          sort_order?: number
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kg_edge: {
        Row: {
          company_id: string
          dst_id: string
          id: string
          props: Json
          rel: string
          src_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          company_id: string
          dst_id: string
          id?: string
          props?: Json
          rel: string
          src_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          company_id?: string
          dst_id?: string
          id?: string
          props?: Json
          rel?: string
          src_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kg_edge_dst_id_fkey"
            columns: ["dst_id"]
            isOneToOne: false
            referencedRelation: "kg_node"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kg_edge_src_id_fkey"
            columns: ["src_id"]
            isOneToOne: false
            referencedRelation: "kg_node"
            referencedColumns: ["id"]
          },
        ]
      }
      kg_node: {
        Row: {
          company_id: string
          id: string
          key: string
          label: string
          props: Json
          ref_id: string | null
          type: string
          updated_at: string
          weight: number
        }
        Insert: {
          company_id: string
          id?: string
          key: string
          label: string
          props?: Json
          ref_id?: string | null
          type: string
          updated_at?: string
          weight?: number
        }
        Update: {
          company_id?: string
          id?: string
          key?: string
          label?: string
          props?: Json
          ref_id?: string | null
          type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      legacy_client_snapshot: {
        Row: {
          checkins: number | null
          company_id: string
          contact_id: string
          created_at: string
          goal_intensity: string | null
          health_assessment: number | null
          meal_plans: number | null
          measurements_logged: number | null
          messages_in_window: number | null
          source: string
          weight_goal: string | null
          workouts_completed: number | null
        }
        Insert: {
          checkins?: number | null
          company_id: string
          contact_id: string
          created_at?: string
          goal_intensity?: string | null
          health_assessment?: number | null
          meal_plans?: number | null
          measurements_logged?: number | null
          messages_in_window?: number | null
          source?: string
          weight_goal?: string | null
          workouts_completed?: number | null
        }
        Update: {
          checkins?: number | null
          company_id?: string
          contact_id?: string
          created_at?: string
          goal_intensity?: string | null
          health_assessment?: number | null
          meal_plans?: number | null
          measurements_logged?: number | null
          messages_in_window?: number | null
          source?: string
          weight_goal?: string | null
          workouts_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_client_snapshot_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_client_snapshot_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          calorie_goal: number | null
          carb_g: number | null
          company_id: string
          contact_id: string | null
          created_at: string
          fat_g: number | null
          id: string
          is_template: boolean
          lenus_id: string | null
          macro_timing_name: string | null
          name: string
          notes: string | null
          num_meal_groups: number | null
          plan_jsonb: Json | null
          protein_g: number | null
          split_carb_pct: number | null
          split_fat_pct: number | null
          split_protein_pct: number | null
          structured: Json | null
          updated_at: string
        }
        Insert: {
          calorie_goal?: number | null
          carb_g?: number | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          fat_g?: number | null
          id?: string
          is_template?: boolean
          lenus_id?: string | null
          macro_timing_name?: string | null
          name: string
          notes?: string | null
          num_meal_groups?: number | null
          plan_jsonb?: Json | null
          protein_g?: number | null
          split_carb_pct?: number | null
          split_fat_pct?: number | null
          split_protein_pct?: number | null
          structured?: Json | null
          updated_at?: string
        }
        Update: {
          calorie_goal?: number | null
          carb_g?: number | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          fat_g?: number | null
          id?: string
          is_template?: boolean
          lenus_id?: string | null
          macro_timing_name?: string | null
          name?: string
          notes?: string | null
          num_meal_groups?: number | null
          plan_jsonb?: Json | null
          protein_g?: number | null
          split_carb_pct?: number | null
          split_fat_pct?: number | null
          split_protein_pct?: number | null
          structured?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      member_memory: {
        Row: {
          company_id: string
          contact_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          kind: string
          occurred_at: string
          profile_id: string | null
          source: string
          source_id: string
          superseded_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          profile_id?: string | null
          source: string
          source_id: string
          superseded_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          profile_id?: string | null
          source?: string
          source_id?: string
          superseded_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          client_id: string
          company_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_log: {
        Row: {
          company_id: string
          created_at: string
          dataset: string
          error: string | null
          id: string
          lenus_id: string
          records_imported: number
          status: string
          target_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          dataset: string
          error?: string | null
          id?: string
          lenus_id: string
          records_imported?: number
          status?: string
          target_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          dataset?: string
          error?: string | null
          id?: string
          lenus_id?: string
          records_imported?: number
          status?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          key: string
          label_en: string
          label_es: string | null
        }
        Insert: {
          key: string
          label_en: string
          label_es?: string | null
        }
        Update: {
          key?: string
          label_en?: string
          label_es?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          channel: string
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          link: string | null
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          answers: Json
          company_id: string
          completed_at: string | null
          computed_targets: Json | null
          created_at: string
          goal_target_date: string | null
          goal_type: string | null
          id: string
          predicted_goal: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          company_id: string
          completed_at?: string | null
          computed_targets?: Json | null
          created_at?: string
          goal_target_date?: string | null
          goal_type?: string | null
          id?: string
          predicted_goal?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          company_id?: string
          completed_at?: string | null
          computed_targets?: Json | null
          created_at?: string
          goal_target_date?: string | null
          goal_type?: string | null
          id?: string
          predicted_goal?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_responses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          forecast_probability: number | null
          ghl_contact_id: string | null
          ghl_created_at: string | null
          ghl_opportunity_id: string
          ghl_source: string | null
          ghl_updated_at: string | null
          id: string
          last_stage_change_at: string | null
          last_status_change_at: string | null
          lost_reason: string | null
          lost_reason_id: string | null
          monetary_value_cents: number | null
          name: string | null
          pipeline_id: string | null
          raw: Json | null
          source: string | null
          stage_id: string | null
          status: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          forecast_probability?: number | null
          ghl_contact_id?: string | null
          ghl_created_at?: string | null
          ghl_opportunity_id: string
          ghl_source?: string | null
          ghl_updated_at?: string | null
          id?: string
          last_stage_change_at?: string | null
          last_status_change_at?: string | null
          lost_reason?: string | null
          lost_reason_id?: string | null
          monetary_value_cents?: number | null
          name?: string | null
          pipeline_id?: string | null
          raw?: Json | null
          source?: string | null
          stage_id?: string | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          forecast_probability?: number | null
          ghl_contact_id?: string | null
          ghl_created_at?: string | null
          ghl_opportunity_id?: string
          ghl_source?: string | null
          ghl_updated_at?: string | null
          id?: string
          last_stage_change_at?: string | null
          last_status_change_at?: string | null
          lost_reason?: string | null
          lost_reason_id?: string | null
          monetary_value_cents?: number | null
          name?: string | null
          pipeline_id?: string | null
          raw?: Json | null
          source?: string | null
          stage_id?: string | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          opportunity_id: string
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id: string
          source?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_audit_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          amount_refunded_cents: number
          company_id: string
          created_at: string
          currency: string
          description: string | null
          failure_reason: string | null
          id: string
          paid_at: string | null
          profile_id: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount_cents?: number
          amount_refunded_cents?: number
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          profile_id?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          amount_refunded_cents?: number
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          profile_id?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      physique_analyses: {
        Row: {
          assessment: Json
          bf_high: number | null
          bf_low: number | null
          company_id: string
          created_at: string
          deleted_at: string | null
          flagged: boolean
          goals: Json
          id: string
          locale: string
          model: string | null
          narrative: string
          profile_id: string
          progress_photo_id: string | null
          weight_lb: number | null
        }
        Insert: {
          assessment?: Json
          bf_high?: number | null
          bf_low?: number | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          goals?: Json
          id?: string
          locale?: string
          model?: string | null
          narrative?: string
          profile_id: string
          progress_photo_id?: string | null
          weight_lb?: number | null
        }
        Update: {
          assessment?: Json
          bf_high?: number | null
          bf_low?: number | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          flagged?: boolean
          goals?: Json
          id?: string
          locale?: string
          model?: string | null
          narrative?: string
          profile_id?: string
          progress_photo_id?: string | null
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physique_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physique_analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physique_analyses_progress_photo_id_fkey"
            columns: ["progress_photo_id"]
            isOneToOne: false
            referencedRelation: "progress_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          company_id: string
          created_at: string
          ghl_stage_id: string
          id: string
          name: string
          pipeline_id: string
          position: number
          source: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ghl_stage_id: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
          source?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ghl_stage_id?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          company_id: string
          created_at: string
          ghl_pipeline_id: string
          id: string
          is_active: boolean
          name: string
          raw: Json | null
          source: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ghl_pipeline_id: string
          id?: string
          is_active?: boolean
          name: string
          raw?: Json | null
          source?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ghl_pipeline_id?: string
          id?: string
          is_active?: boolean
          name?: string
          raw?: Json | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assignments: {
        Row: {
          assigned_at: string
          company_id: string
          id: string
          plan_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          company_id: string
          id?: string
          plan_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          company_id?: string
          id?: string
          plan_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean
          name_en: string
          name_es: string | null
          updated_at: string
          weeks: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name_en: string
          name_es?: string | null
          updated_at?: string
          weeks?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name_en?: string
          name_es?: string | null
          updated_at?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          post_id: string
          profile_id: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          post_id: string
          profile_id: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          company_id: string
          created_at: string
          emoji: string
          id: string
          post_id: string
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          community_muted_until: string | null
          comp_access_until: string | null
          company_id: string
          content_locale: string
          created_at: string
          email: string
          full_name: string | null
          health_ack_at: string | null
          id: string
          is_legacy_client: boolean
          legacy_source: string | null
          lenus_profile_id: string | null
          reminder_hour: number
          role: string
          timezone: string
          ui_locale: string
          updated_at: string
        }
        Insert: {
          community_muted_until?: string | null
          comp_access_until?: string | null
          company_id: string
          content_locale?: string
          created_at?: string
          email: string
          full_name?: string | null
          health_ack_at?: string | null
          id: string
          is_legacy_client?: boolean
          legacy_source?: string | null
          lenus_profile_id?: string | null
          reminder_hour?: number
          role?: string
          timezone?: string
          ui_locale?: string
          updated_at?: string
        }
        Update: {
          community_muted_until?: string | null
          comp_access_until?: string | null
          company_id?: string
          content_locale?: string
          created_at?: string
          email?: string
          full_name?: string | null
          health_ack_at?: string | null
          id?: string
          is_legacy_client?: boolean
          legacy_source?: string | null
          lenus_profile_id?: string | null
          reminder_hour?: number
          role?: string
          timezone?: string
          ui_locale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          pose: string | null
          pose_source: string | null
          profile_id: string | null
          storage_path: string
          taken_on: string
          weight_kg: number | null
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          pose?: string | null
          pose_source?: string | null
          profile_id?: string | null
          storage_path: string
          taken_on?: string
          weight_kg?: number | null
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          pose?: string | null
          pose_source?: string | null
          profile_id?: string | null
          storage_path?: string
          taken_on?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          company_id: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          company_id: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          company_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_checklist: {
        Row: {
          area: string | null
          assigned_tester: string | null
          category: string
          checked_at: string | null
          checked_by: string | null
          company_id: string
          created_at: string
          detail: string | null
          expected_result: string | null
          how_to_trigger: string | null
          id: string
          involves_ghl: boolean
          notes: string | null
          phase: string | null
          phase_order: number
          priority: string | null
          should_do: string | null
          sort: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assigned_tester?: string | null
          category: string
          checked_at?: string | null
          checked_by?: string | null
          company_id: string
          created_at?: string
          detail?: string | null
          expected_result?: string | null
          how_to_trigger?: string | null
          id?: string
          involves_ghl?: boolean
          notes?: string | null
          phase?: string | null
          phase_order?: number
          priority?: string | null
          should_do?: string | null
          sort?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assigned_tester?: string | null
          category?: string
          checked_at?: string | null
          checked_by?: string | null
          company_id?: string
          created_at?: string
          detail?: string | null
          expected_result?: string | null
          how_to_trigger?: string | null
          id?: string
          involves_ghl?: boolean
          notes?: string | null
          phase?: string | null
          phase_order?: number
          priority?: string | null
          should_do?: string | null
          sort?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_checklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          bucket: string
          hit_at: string
          id: string
          identifier: string
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: string
          identifier: string
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      recipe_books: {
        Row: {
          company_id: string
          cover_image_url: string | null
          created_at: string
          id: string
          lenus_id: string | null
          name: string
          recipe_count: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          lenus_id?: string | null
          name: string
          recipe_count?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          lenus_id?: string | null
          name?: string
          recipe_count?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_books_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_favorites: {
        Row: {
          company_id: string
          created_at: string
          id: string
          profile_id: string
          recipe_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          profile_id: string
          recipe_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_favorites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          amount_grams: number | null
          amount_print: string | null
          carb_g: number
          company_id: string
          confidence: number
          fat_g: number
          id: string
          ingredient_name: string
          is_verified: boolean
          kcal: number
          lenus_food_id: string | null
          protein_g: number
          recipe_id: string
          sequence: number
          unit_label: string | null
        }
        Insert: {
          amount_grams?: number | null
          amount_print?: string | null
          carb_g?: number
          company_id: string
          confidence?: number
          fat_g?: number
          id?: string
          ingredient_name: string
          is_verified?: boolean
          kcal?: number
          lenus_food_id?: string | null
          protein_g?: number
          recipe_id: string
          sequence?: number
          unit_label?: string | null
        }
        Update: {
          amount_grams?: number | null
          amount_print?: string | null
          carb_g?: number
          company_id?: string
          confidence?: number
          fat_g?: number
          id?: string
          ingredient_name?: string
          is_verified?: boolean
          kcal?: number
          lenus_food_id?: string | null
          protein_g?: number
          recipe_id?: string
          sequence?: number
          unit_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          carb_g: number
          category: string | null
          company_id: string
          cooking_time_minutes: number | null
          created_at: string
          creator_handle: string | null
          fat_g: number
          has_video: boolean
          id: string
          image_url: string | null
          ingredient_count: number
          kcal: number
          lenus_id: string | null
          name_en: string
          name_es: string | null
          prep_time_minutes: number | null
          procedure_en: string | null
          procedure_es: string | null
          protein_g: number
          quality_score: number
          recipe_book_id: string | null
          recipe_book_name: string | null
          search_text: string | null
          servings: number
          source_url: string | null
          spices: Json | null
          total_time_minutes: number | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          carb_g?: number
          category?: string | null
          company_id: string
          cooking_time_minutes?: number | null
          created_at?: string
          creator_handle?: string | null
          fat_g?: number
          has_video?: boolean
          id?: string
          image_url?: string | null
          ingredient_count?: number
          kcal?: number
          lenus_id?: string | null
          name_en: string
          name_es?: string | null
          prep_time_minutes?: number | null
          procedure_en?: string | null
          procedure_es?: string | null
          protein_g?: number
          quality_score?: number
          recipe_book_id?: string | null
          recipe_book_name?: string | null
          search_text?: string | null
          servings?: number
          source_url?: string | null
          spices?: Json | null
          total_time_minutes?: number | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          carb_g?: number
          category?: string | null
          company_id?: string
          cooking_time_minutes?: number | null
          created_at?: string
          creator_handle?: string | null
          fat_g?: number
          has_video?: boolean
          id?: string
          image_url?: string | null
          ingredient_count?: number
          kcal?: number
          lenus_id?: string | null
          name_en?: string
          name_es?: string | null
          prep_time_minutes?: number | null
          procedure_en?: string | null
          procedure_es?: string | null
          protein_g?: number
          quality_score?: number
          recipe_book_id?: string | null
          recipe_book_name?: string | null
          search_text?: string | null
          servings?: number
          source_url?: string | null
          spices?: Json | null
          total_time_minutes?: number | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_recipe_book_id_fkey"
            columns: ["recipe_book_id"]
            isOneToOne: false
            referencedRelation: "recipe_books"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          key: string
          label: string
        }
        Insert: {
          description?: string | null
          key: string
          label: string
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      saved_segments: {
        Row: {
          color: string
          company_id: string
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          is_shared: boolean
          name: string
          scope: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          is_shared?: boolean
          name: string
          scope?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          is_shared?: boolean
          name?: string
          scope?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_population_bias: {
        Row: {
          company_id: string
          computed_at: string
          food_key: string
          id: string
          member_count: number
          ratio: number
          sample_count: number
        }
        Insert: {
          company_id: string
          computed_at?: string
          food_key: string
          id?: string
          member_count: number
          ratio: number
          sample_count: number
        }
        Update: {
          company_id?: string
          computed_at?: string
          food_key?: string
          id?: string
          member_count?: number
          ratio?: number
          sample_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scan_population_bias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          company_id: string | null
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detail?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          exercise_id: string
          format: Database["public"]["Enums"]["session_exercise_format"]
          id: string
          notes: string | null
          reps: number | null
          rest_sec: number | null
          rounds: number | null
          session_id: string
          sets: number | null
          sort_order: number
          time_sec: number | null
          weight: number | null
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          exercise_id: string
          format?: Database["public"]["Enums"]["session_exercise_format"]
          id?: string
          notes?: string | null
          reps?: number | null
          rest_sec?: number | null
          rounds?: number | null
          session_id: string
          sets?: number | null
          sort_order?: number
          time_sec?: number | null
          weight?: number | null
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          exercise_id?: string
          format?: Database["public"]["Enums"]["session_exercise_format"]
          id?: string
          notes?: string | null
          reps?: number | null
          rest_sec?: number | null
          rounds?: number | null
          session_id?: string
          sets?: number | null
          sort_order?: number
          time_sec?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          company_id: string | null
          country: string | null
          created_at: string
          device_fingerprint: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address: string
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          company_id: string
          created_at: string
          day_label: string
          id: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          day_label: string
          id?: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          day_label?: string
          id?: string
          plan_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          company_id: string
          completed: boolean
          created_at: string
          difficulty: string | null
          exercise_id: string
          id: string
          reps: number | null
          set_number: number
          weight: number | null
          workout_log_id: string
        }
        Insert: {
          company_id: string
          completed?: boolean
          created_at?: string
          difficulty?: string | null
          exercise_id: string
          id?: string
          reps?: number | null
          set_number: number
          weight?: number | null
          workout_log_id: string
        }
        Update: {
          company_id?: string
          completed?: boolean
          created_at?: string
          difficulty?: string | null
          exercise_id?: string
          id?: string
          reps?: number | null
          set_number?: number
          weight?: number | null
          workout_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          card_brand: string | null
          card_last4: string | null
          company_id: string
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          price_cents: number
          profile_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          company_id: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          price_cents?: number
          profile_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          card_brand?: string | null
          card_last4?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          price_cents?: number
          profile_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      substitution_reason_tags: {
        Row: {
          key: string
          label_en: string
          label_es: string | null
        }
        Insert: {
          key: string
          label_en: string
          label_es?: string | null
        }
        Update: {
          key?: string
          label_en?: string
          label_es?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          body: string | null
          category: string | null
          company_id: string
          company_name: string | null
          created_at: string
          dedupe_key: string | null
          email: string | null
          github_issue_url: string | null
          id: string
          notified_at: string | null
          pii_flagged: boolean
          pii_kinds: string[]
          priority: string
          profile_id: string | null
          redacted_body: string | null
          rep_name: string | null
          rep_phone: string | null
          resolved_at: string | null
          source: string
          status: string
          subject: string
          ticket_number: number
          triage: Json | null
          triaged_at: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          body?: string | null
          category?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          dedupe_key?: string | null
          email?: string | null
          github_issue_url?: string | null
          id?: string
          notified_at?: string | null
          pii_flagged?: boolean
          pii_kinds?: string[]
          priority?: string
          profile_id?: string | null
          redacted_body?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject: string
          ticket_number?: number
          triage?: Json | null
          triaged_at?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          body?: string | null
          category?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          dedupe_key?: string | null
          email?: string | null
          github_issue_url?: string | null
          id?: string
          notified_at?: string | null
          pii_flagged?: boolean
          pii_kinds?: string[]
          priority?: string
          profile_id?: string | null
          redacted_body?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          ticket_number?: number
          triage?: Json | null
          triaged_at?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string
          color: string
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          label: string
          slug: string
          source: string
        }
        Insert: {
          category?: string
          color?: string
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          label: string
          slug: string
          source?: string
        }
        Update: {
          category?: string
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          label?: string
          slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          company_id: string
          earned_at: string
          id: string
          profile_id: string
        }
        Insert: {
          badge_id: string
          company_id: string
          earned_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          badge_id?: string
          company_id?: string
          earned_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_food_favorites: {
        Row: {
          company_id: string
          created_at: string
          food_id: string
          id: string
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          food_id: string
          id?: string
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          food_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_favorites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_food_favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_food_favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_insights: {
        Row: {
          company_id: string
          created_at: string
          generated_at: string
          id: string
          payload: Json
          profile_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          profile_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          profile_id?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          avg_kcal_30d: number | null
          avg_protein_g_30d: number | null
          company_id: string
          computed_at: string
          created_at: string
          current_weight_kg: number | null
          favorite_foods: Json | null
          goal_type: string | null
          goal_weight_kg: number | null
          id: string
          kcal_adherence_pct: number | null
          logging_days_30d: number | null
          primary_goal: string | null
          profile_id: string
          protein_adherence_pct: number | null
          scan_quality: Json | null
          starting_weight_kg: number | null
          target_kcal: number | null
          target_protein_g: number | null
          training_days_per_week: number | null
          updated_at: string
          weight_change_kg_30d: number | null
          weight_change_kg_7d: number | null
          workout_days_30d: number | null
        }
        Insert: {
          avg_kcal_30d?: number | null
          avg_protein_g_30d?: number | null
          company_id: string
          computed_at?: string
          created_at?: string
          current_weight_kg?: number | null
          favorite_foods?: Json | null
          goal_type?: string | null
          goal_weight_kg?: number | null
          id?: string
          kcal_adherence_pct?: number | null
          logging_days_30d?: number | null
          primary_goal?: string | null
          profile_id: string
          protein_adherence_pct?: number | null
          scan_quality?: Json | null
          starting_weight_kg?: number | null
          target_kcal?: number | null
          target_protein_g?: number | null
          training_days_per_week?: number | null
          updated_at?: string
          weight_change_kg_30d?: number | null
          weight_change_kg_7d?: number | null
          workout_days_30d?: number | null
        }
        Update: {
          avg_kcal_30d?: number | null
          avg_protein_g_30d?: number | null
          company_id?: string
          computed_at?: string
          created_at?: string
          current_weight_kg?: number | null
          favorite_foods?: Json | null
          goal_type?: string | null
          goal_weight_kg?: number | null
          id?: string
          kcal_adherence_pct?: number | null
          logging_days_30d?: number | null
          primary_goal?: string | null
          profile_id?: string
          protein_adherence_pct?: number | null
          scan_quality?: Json | null
          starting_weight_kg?: number | null
          target_kcal?: number | null
          target_protein_g?: number | null
          training_days_per_week?: number | null
          updated_at?: string
          weight_change_kg_30d?: number | null
          weight_change_kg_7d?: number | null
          workout_days_30d?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_state_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          company_id: string
          current_streak: number
          freeze_tokens: number
          last_active_on: string | null
          longest_streak: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          current_streak?: number
          freeze_tokens?: number
          last_active_on?: string | null
          longest_streak?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_streak?: number
          freeze_tokens?: number
          last_active_on?: string | null
          longest_streak?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_draws: {
        Row: {
          company_id: string
          created_at: string
          drawn_at: string
          drawn_by: string | null
          entrant_count: number
          filters: Json
          id: string
          kind: string
          label: string
          pool_hash: string
          pool_snapshot: Json
          seed: string
          total_entries: number
          void_reason: string | null
          voided_at: string | null
          winner_email: string | null
          winner_lead_id: string | null
          winner_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          drawn_at?: string
          drawn_by?: string | null
          entrant_count: number
          filters?: Json
          id?: string
          kind: string
          label: string
          pool_hash: string
          pool_snapshot: Json
          seed: string
          total_entries: number
          void_reason?: string | null
          voided_at?: string | null
          winner_email?: string | null
          winner_lead_id?: string | null
          winner_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          drawn_at?: string
          drawn_by?: string | null
          entrant_count?: number
          filters?: Json
          id?: string
          kind?: string
          label?: string
          pool_hash?: string
          pool_snapshot?: Json
          seed?: string
          total_entries?: number
          void_reason?: string | null
          voided_at?: string | null
          winner_email?: string | null
          winner_lead_id?: string | null
          winner_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_draws_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_draws_drawn_by_fkey"
            columns: ["drawn_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_draws_winner_lead_id_fkey"
            columns: ["winner_lead_id"]
            isOneToOne: false
            referencedRelation: "waitlist_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entry_events: {
        Row: {
          company_id: string
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          lead_id: string
          points: number
          source_lead_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          lead_id: string
          points: number
          source_lead_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          lead_id?: string
          points?: number
          source_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entry_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entry_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "waitlist_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entry_events_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "waitlist_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          company_id: string
          confirm_token: string
          confirmed_at: string | null
          converted_at: string | null
          created_at: string
          email: string
          entry_count: number
          first_name: string | null
          ghl_contact_id: string | null
          id: string
          instagram_handle: string | null
          last_name: string | null
          locale: string
          phone: string | null
          quiz_completed_at: string | null
          referral_code: string
          referred_by_code: string | null
          source: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          company_id: string
          confirm_token?: string
          confirmed_at?: string | null
          converted_at?: string | null
          created_at?: string
          email: string
          entry_count?: number
          first_name?: string | null
          ghl_contact_id?: string | null
          id?: string
          instagram_handle?: string | null
          last_name?: string | null
          locale?: string
          phone?: string | null
          quiz_completed_at?: string | null
          referral_code?: string
          referred_by_code?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          company_id?: string
          confirm_token?: string
          confirmed_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string
          entry_count?: number
          first_name?: string | null
          ghl_contact_id?: string | null
          id?: string
          instagram_handle?: string | null
          last_name?: string | null
          locale?: string
          phone?: string | null
          quiz_completed_at?: string | null
          referral_code?: string
          referred_by_code?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_quiz_responses: {
        Row: {
          company_id: string
          created_at: string
          days_per_week: number | null
          goal: string[]
          home_or_gym: string | null
          how_they_eat: string | null
          id: string
          lead_id: string
          preferred_language: string
          tier_candidate: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          days_per_week?: number | null
          goal?: string[]
          home_or_gym?: string | null
          how_they_eat?: string | null
          id?: string
          lead_id: string
          preferred_language?: string
          tier_candidate?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          days_per_week?: number | null
          goal?: string[]
          home_or_gym?: string | null
          how_they_eat?: string | null
          id?: string
          lead_id?: string
          preferred_language?: string
          tier_candidate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_quiz_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_quiz_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "waitlist_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          profile_id: string | null
          recorded_on: string
          source: string
          weight_kg: number
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          recorded_on?: string
          source?: string
          weight_kg: number
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          recorded_on?: string
          source?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_completion_history: {
        Row: {
          changed_at: string
          company_id: string
          id: string
          profile_id: string
          status: string
          workout_log_id: string | null
        }
        Insert: {
          changed_at?: string
          company_id: string
          id?: string
          profile_id: string
          status: string
          workout_log_id?: string | null
        }
        Update: {
          changed_at?: string
          company_id?: string
          id?: string
          profile_id?: string
          status?: string
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_completion_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_completion_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_completion_history_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          company_id: string
          completion_pct: number | null
          created_at: string
          effort: number | null
          enjoyment: number | null
          id: string
          performed_at: string
          profile_id: string
          session_id: string | null
        }
        Insert: {
          company_id: string
          completion_pct?: number | null
          created_at?: string
          effort?: number | null
          enjoyment?: number | null
          id?: string
          performed_at?: string
          profile_id: string
          session_id?: string | null
        }
        Update: {
          company_id?: string
          completion_pct?: number | null
          created_at?: string
          effort?: number | null
          enjoyment?: number | null
          id?: string
          performed_at?: string
          profile_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monthly_revenue: {
        Row: {
          coach_cents: number | null
          company_id: string | null
          gross_cents: number | null
          month: string | null
          txn_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      api_analytics: { Args: { days?: number }; Returns: Json }
      auth_providers_for: { Args: { p_user: string }; Returns: string[] }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_limit: number
          p_window_sec: number
        }
        Returns: boolean
      }
      claim_legacy_contact: { Args: never; Returns: Json }
      cron_refresh_population_bias: { Args: never; Returns: undefined }
      current_company_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_approver: { Args: never; Returns: boolean }
      is_coach: { Args: never; Returns: boolean }
      kg_client_facts: {
        Args: { p_company: string; p_contact: string }
        Returns: {
          label: string
          node_type: string
          rel: string
        }[]
      }
      kg_rebuild: {
        Args: {
          p_company?: string
          p_food_limit?: number
          p_foods_per_client?: number
        }
        Returns: Json
      }
      match_coach_knowledge: {
        Args: {
          match_count?: number
          p_company_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_coach_memory: {
        Args: {
          match_count?: number
          p_profile_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          similarity: number
          source: string
        }[]
      }
      match_member_memory: {
        Args: {
          match_count: number
          p_contact_id: string
          p_profile_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          kind: string
          occurred_at: string
          similarity: number
          source: string
        }[]
      }
      profile_role: { Args: never; Returns: string }
      refresh_population_bias: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      trim_api_request_log: { Args: never; Returns: undefined }
    }
    Enums: {
      session_exercise_format: "straight" | "circuit" | "superset"
      substitution_context:
        | "gym"
        | "bodyweight"
        | "bands"
        | "freeweights"
        | "machines"
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
      session_exercise_format: ["straight", "circuit", "superset"],
      substitution_context: [
        "gym",
        "bodyweight",
        "bands",
        "freeweights",
        "machines",
      ],
    },
  },
} as const
