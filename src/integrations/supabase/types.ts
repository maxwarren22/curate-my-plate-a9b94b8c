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
          id: string
          meal_types: string[] | null
          plan_addons: string[] | null
          plan_generation_day: string | null
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
          id?: string
          meal_types?: string[] | null
          plan_addons?: string[] | null
          plan_generation_day?: string | null
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
          id?: string
          meal_types?: string[] | null
          plan_addons?: string[] | null
          plan_generation_day?: string | null
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
          created_at: string
          id: string
          shopping_list: Json | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          shopping_list?: Json | null
          user_id: string
          week_start_date: string
        }
        Update: {
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
      [_ in never]: never
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
