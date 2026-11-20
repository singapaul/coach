export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      block_days: {
        Row: {
          block_id: string
          created_at: string
          day_template_id: string
          id: string
          position: number
          user_id: string
          weekday: number
        }
        Insert: {
          block_id: string
          created_at?: string
          day_template_id: string
          id?: string
          position: number
          user_id?: string
          weekday: number
        }
        Update: {
          block_id?: string
          created_at?: string
          day_template_id?: string
          id?: string
          position?: number
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_days_block_id_user_id_fkey"
            columns: ["block_id", "user_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "block_days_day_template_id_user_id_fkey"
            columns: ["day_template_id", "user_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      blocks: {
        Row: {
          created_at: string
          created_by: string
          goal_id: string | null
          id: string
          length_weeks: number
          rationale: string | null
          split_name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          goal_id?: string | null
          id?: string
          length_weeks?: number
          rationale?: string | null
          split_name: string
          start_date: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          goal_id?: string | null
          id?: string
          length_weeks?: number
          rationale?: string | null
          split_name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_template_exercises: {
        Row: {
          created_at: string
          day_template_id: string
          exercise_id: string
          id: string
          max_reps: number
          min_reps: number
          position: number
          rest_s: number
          sets: number
          updated_at: string
          user_id: string
          user_pinned: boolean
        }
        Insert: {
          created_at?: string
          day_template_id: string
          exercise_id: string
          id?: string
          max_reps: number
          min_reps: number
          position: number
          rest_s: number
          sets: number
          updated_at?: string
          user_id?: string
          user_pinned?: boolean
        }
        Update: {
          created_at?: string
          day_template_id?: string
          exercise_id?: string
          id?: string
          max_reps?: number
          min_reps?: number
          position?: number
          rest_s?: number
          sets?: number
          updated_at?: string
          user_id?: string
          user_pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "day_template_exercises_day_template_id_user_id_fkey"
            columns: ["day_template_id", "user_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "day_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      day_templates: {
        Row: {
          created_at: string
          focus: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          focus?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_similar: {
        Row: {
          carryover_factor: number
          created_at: string
          exercise_id: string
          similar_exercise_id: string
          user_id: string
        }
        Insert: {
          carryover_factor: number
          created_at?: string
          exercise_id: string
          similar_exercise_id: string
          user_id?: string
        }
        Update: {
          carryover_factor?: number
          created_at?: string
          exercise_id?: string
          similar_exercise_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_similar_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_similar_similar_exercise_id_fkey"
            columns: ["similar_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_region: string | null
          category: string | null
          created_at: string
          equipment: string | null
          force: string | null
          id: string
          instructions: string[]
          level: string | null
          mechanic: string | null
          movement_pattern: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[]
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body_region?: string | null
          category?: string | null
          created_at?: string
          equipment?: string | null
          force?: string | null
          id: string
          instructions?: string[]
          level?: string | null
          mechanic?: string | null
          movement_pattern?: string | null
          name: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body_region?: string | null
          category?: string | null
          created_at?: string
          equipment?: string | null
          force?: string | null
          id?: string
          instructions?: string[]
          level?: string | null
          mechanic?: string | null
          movement_pattern?: string | null
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prescribed_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          max_reps: number
          min_reps: number
          position: number
          session_id: string
          set_index: number
          target_kg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          max_reps: number
          min_reps: number
          position: number
          session_id: string
          set_index: number
          target_kg?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          max_reps?: number
          min_reps?: number
          position?: number
          session_id?: string
          set_index?: number
          target_kg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescribed_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescribed_sets_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          height_cm: number | null
          sex: string | null
          timezone: string
          training_days_per_week: number | null
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          height_cm?: number | null
          sex?: string | null
          timezone?: string
          training_days_per_week?: number | null
          units?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          height_cm?: number | null
          sex?: string | null
          timezone?: string
          training_days_per_week?: number | null
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          block_id: string
          created_at: string
          day_template_id: string
          id: string
          performed_date: string | null
          scheduled_date: string
          status: string
          training_week_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          day_template_id: string
          id?: string
          performed_date?: string | null
          scheduled_date: string
          status?: string
          training_week_start: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          day_template_id?: string
          id?: string
          performed_date?: string | null
          scheduled_date?: string
          status?: string
          training_week_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_block_id_user_id_fkey"
            columns: ["block_id", "user_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "sessions_day_template_id_user_id_fkey"
            columns: ["day_template_id", "user_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_exercise_prefs: {
        Row: {
          available: boolean
          avoid: boolean
          created_at: string
          exercise_id: string
          favourite: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available?: boolean
          avoid?: boolean
          created_at?: string
          exercise_id: string
          favourite?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          available?: boolean
          avoid?: boolean
          created_at?: string
          exercise_id?: string
          favourite?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_prefs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      coach_eligible_exercises: {
        Args: { p_user_id?: string }
        Returns: {
          body_region: string | null
          category: string | null
          created_at: string
          equipment: string | null
          force: string | null
          id: string
          instructions: string[]
          level: string | null
          mechanic: string | null
          movement_pattern: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[]
          source: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "exercises"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_iana_timezone: { Args: { tz: string }; Returns: boolean }
      lifter_local_date: {
        Args: { p_at: string; p_user_id?: string }
        Returns: string
      }
      today_plan: { Args: never; Returns: Json }
      today_plan_at: { Args: { p_at: string }; Returns: Json }
      today_plan_logged_sets: {
        Args: { p_prescribed_set_id: string }
        Returns: Json
      }
      training_week_start: { Args: { d: string }; Returns: string }
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

