export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      disliked_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      disliked_recipes: {
        Row: {
          created_at: string | null
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disliked_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      liked_recipes: {
        Row: {
          created_at: string | null
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          ingredient_name: string
          quantity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          ingredient_name: string
          quantity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          ingredient_name?: string
          quantity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          budget: string | null
          can_comment: boolean | null
          cooking_time: string | null
          created_at: string
          cuisine_preferences: string[] | null
          dietary_restrictions: string[] | null
          display_name: string | null
          generations_remaining: number | null
          health_goals: string | null
          id: string
          kitchen_equipment: string[] | null
          meal_types: string[] | null
          plan_addons: string[] | null
          plan_generation_day: string | null
          protein_preferences: string[] | null
          serving_size: string | null
          skill_level: string | null
          subscription_status: string | null
          subscription_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: string | null
          can_comment?: boolean | null
          cooking_time?: string | null
          created_at?: string
          cuisine_preferences?: string[] | null
          dietary_restrictions?: string[] | null
          display_name?: string | null
          generations_remaining?: number | null
          health_goals?: string | null
          id?: string
          kitchen_equipment?: string[] | null
          meal_types?: string[] | null
          plan_addons?: string[] | null
          plan_generation_day?: string | null
          protein_preferences?: string[] | null
          serving_size?: string | null
          skill_level?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: string | null
          can_comment?: boolean | null
          cooking_time?: string | null
          created_at?: string
          cuisine_preferences?: string[] | null
          dietary_restrictions?: string[] | null
          display_name?: string | null
          generations_remaining?: number | null
          health_goals?: string | null
          id?: string
          kitchen_equipment?: string[] | null
          meal_types?: string[] | null
          plan_addons?: string[] | null
          plan_generation_day?: string | null
          protein_preferences?: string[] | null
          serving_size?: string | null
          skill_level?: string | null
          subscription_status?: string | null
          subscription_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          calories: number | null
          created_at: string
          created_by_user: string | null
          description: string | null
          embedding: string | null
          id: string
          ingredients: string
          recipe: string
          servings: number | null
          title: string
        }
        Insert: {
          calories?: number | null
          created_at?: string
          created_by_user?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          ingredients: string
          recipe: string
          servings?: number | null
          title: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          created_by_user?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          ingredients?: string
          recipe?: string
          servings?: number | null
          title?: string
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          ai_processed_ingredients: Json | null
          budget: string | null
          created_at: string
          id: string
          shopping_list: Json | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          ai_processed_ingredients?: Json | null
          budget?: string | null
          created_at?: string
          id?: string
          shopping_list?: Json | null
          user_id: string
          week_start_date: string
        }
        Update: {
          ai_processed_ingredients?: Json | null
          budget?: string | null
          created_at?: string
          id?: string
          shopping_list?: Json | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      user_meal_history: {
        Row: {
          cooking_tips: string | null
          created_at: string
          id: string
          main_dish_recipe_id: string
          meal_date: string
          rating: number | null
          side_dish_recipe_id: string | null
          total_time_to_cook: string | null
          user_id: string
        }
        Insert: {
          cooking_tips?: string | null
          created_at?: string
          id?: string
          main_dish_recipe_id: string
          meal_date: string
          rating?: number | null
          side_dish_recipe_id?: string | null
          total_time_to_cook?: string | null
          user_id: string
        }
        Update: {
          cooking_tips?: string | null
          created_at?: string
          id?: string
          main_dish_recipe_id?: string
          meal_date?: string
          rating?: number | null
          side_dish_recipe_id?: string | null
          total_time_to_cook?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_meal_history_main_dish_recipe_id_fkey"
            columns: ["main_dish_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_history_side_dish_recipe_id_fkey"
            columns: ["side_dish_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      invoke_send_weekly_plan: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_recipe: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          title: string
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
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
