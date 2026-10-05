export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      assistants_status: {
        Row: {
          assistant_id: string;
          available: boolean;
          campus: string | null;
          id: string;
          queue: string[];
          updated_at: string;
        };
        Insert: {
          assistant_id: string;
          available?: boolean;
          campus?: string | null;
          id?: string;
          queue?: string[];
          updated_at?: string;
        };
        Update: {
          assistant_id?: string;
          available?: boolean;
          campus?: string | null;
          id?: string;
          queue?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assistants_status_assistant_id_fkey";
            columns: ["assistant_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deadlines: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          status: Database["public"]["Enums"]["deadline_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          status?: Database["public"]["Enums"]["deadline_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          status?: Database["public"]["Enums"]["deadline_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deadlines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deadlines_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      defense_swaps: {
        Row: {
          created_at: string;
          id: string;
          matched_with: string | null;
          offered_slot: string;
          project_id: string | null;
          status: Database["public"]["Enums"]["swap_status"];
          user_id: string;
          wanted_slot: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          matched_with?: string | null;
          offered_slot: string;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["swap_status"];
          user_id?: string;
          wanted_slot: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          matched_with?: string | null;
          offered_slot?: string;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["swap_status"];
          user_id?: string;
          wanted_slot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defense_swaps_matched_with_fkey";
            columns: ["matched_with"];
            isOneToOne: false;
            referencedRelation: "defense_swaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defense_swaps_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defense_swaps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_requests: {
        Row: {
          created_at: string;
          creator_id: string;
          criteria: NonNullable<Json>;
          id: string;
          project_id: string;
          size: number;
          status: Database["public"]["Enums"]["request_status"];
        };
        Insert: {
          created_at?: string;
          creator_id?: string;
          criteria?: NonNullable<Json>;
          id?: string;
          project_id: string;
          size: number;
          status?: Database["public"]["Enums"]["request_status"];
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          criteria?: NonNullable<Json>;
          id?: string;
          project_id?: string;
          size?: number;
          status?: Database["public"]["Enums"]["request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "group_requests_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          members: string[];
          project_id: string;
        };
        Insert: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          members: string[];
          project_id: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          members?: string[];
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string;
          group_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          group_id: string;
          id?: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moulinette_reports: {
        Row: {
          comment: string | null;
          created_at: string;
          hours_spent: number | null;
          id: string;
          pitfalls: string[];
          project_hash: string;
          score: number;
          submission_hash: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          hours_spent?: number | null;
          id?: string;
          pitfalls?: string[];
          project_hash: string;
          score: number;
          submission_hash: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          hours_spent?: number | null;
          id?: string;
          pitfalls?: string[];
          project_hash?: string;
          score?: number;
          submission_hash?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          availability: NonNullable<Json>;
          city: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          karma: number;
          languages: NonNullable<Json>;
          locale: string;
          matchmaking_opt_in: boolean;
          onboarded_at: string | null;
          promo: Database["public"]["Enums"]["promo"] | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          availability?: NonNullable<Json>;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          karma?: number;
          languages?: NonNullable<Json>;
          locale?: string;
          matchmaking_opt_in?: boolean;
          onboarded_at?: string | null;
          promo?: Database["public"]["Enums"]["promo"] | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          availability?: NonNullable<Json>;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          karma?: number;
          languages?: NonNullable<Json>;
          locale?: string;
          matchmaking_opt_in?: boolean;
          onboarded_at?: string | null;
          promo?: Database["public"]["Enums"]["promo"] | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          deadline: string | null;
          id: string;
          intra_key: string | null;
          module_code: string;
          name: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          intra_key?: string | null;
          module_code: string;
          name: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          intra_key?: string | null;
          module_code?: string;
          name?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_reports: {
        Row: {
          campus: string;
          created_at: string;
          expires_at: string;
          id: string;
          reported_by: string;
          room: string;
          seats_free: number;
        };
        Insert: {
          campus: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          reported_by?: string;
          room: string;
          seats_free: number;
        };
        Update: {
          campus?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          reported_by?: string;
          room?: string;
          seats_free?: number;
        };
        Relationships: [
          {
            foreignKeyName: "room_reports_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_matchmaking_opt_in: { Args: { uid: string }; Returns: boolean };
      is_allowed_email: { Args: { email: string }; Returns: boolean };
      is_assistant: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_group_member: { Args: { gid: string }; Returns: boolean };
      purge_expired_room_reports: { Args: Record<PropertyKey, never>; Returns: number };
    };
    Enums: {
      deadline_status: "todo" | "in_progress" | "done" | "missed";
      promo: "tek1" | "tek2" | "tek3" | "tek4" | "tek5";
      request_status: "open" | "matched" | "closed";
      swap_status: "open" | "matched" | "cancelled";
      user_role: "student" | "assistant" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      deadline_status: ["todo", "in_progress", "done", "missed"],
      promo: ["tek1", "tek2", "tek3", "tek4", "tek5"],
      request_status: ["open", "matched", "closed"],
      swap_status: ["open", "matched", "cancelled"],
      user_role: ["student", "assistant", "admin"],
    },
  },
} as const;
