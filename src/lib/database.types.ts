// Fichier GÉNÉRÉ automatiquement (npm run db:types) — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          adherent_id: string;
          created_at: string;
          dedupe_key: string;
          id: string;
          message: string;
          payload: NonNullable<Json>;
          seen_at: string | null;
          type: Database['public']['Enums']['alert_type'];
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          message: string;
          payload?: NonNullable<Json>;
          seen_at?: string | null;
          type: Database['public']['Enums']['alert_type'];
        };
        Update: {
          adherent_id?: string;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          message?: string;
          payload?: NonNullable<Json>;
          seen_at?: string | null;
          type?: Database['public']['Enums']['alert_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          checkin_reminder_hour: number;
          default_checkin_weekday: number;
          id: number;
          inactivity_days: number;
          invitation_validity_days: number;
          session_reminder_hour: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          checkin_reminder_hour?: number;
          default_checkin_weekday?: number;
          id?: number;
          inactivity_days?: number;
          invitation_validity_days?: number;
          session_reminder_hour?: number;
          updated_at?: string;
        };
        Update: {
          checkin_reminder_hour?: number;
          default_checkin_weekday?: number;
          id?: number;
          inactivity_days?: number;
          invitation_validity_days?: number;
          session_reminder_hour?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_weights: {
        Row: {
          adherent_id: string;
          created_at: string;
          id: string;
          measured_on: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          created_at?: string;
          id: string;
          measured_on: string;
          weight_kg: number;
        };
        Update: {
          adherent_id?: string;
          created_at?: string;
          id?: string;
          measured_on?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'body_weights_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      checkins: {
        Row: {
          adherent_id: string;
          coach_replied_at: string | null;
          coach_reply: string | null;
          comment: string | null;
          energy: number | null;
          id: string;
          photo_paths: string[];
          sleep: number | null;
          soreness: number | null;
          stress: number | null;
          submitted_at: string;
          updated_at: string;
          waist_cm: number | null;
          week_start: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          coach_replied_at?: string | null;
          coach_reply?: string | null;
          comment?: string | null;
          energy?: number | null;
          id: string;
          photo_paths?: string[];
          sleep?: number | null;
          soreness?: number | null;
          stress?: number | null;
          submitted_at?: string;
          updated_at?: string;
          waist_cm?: number | null;
          week_start: string;
          weight_kg?: number | null;
        };
        Update: {
          adherent_id?: string;
          coach_replied_at?: string | null;
          coach_reply?: string | null;
          comment?: string | null;
          energy?: number | null;
          id?: string;
          photo_paths?: string[];
          sleep?: number | null;
          soreness?: number | null;
          stress?: number | null;
          submitted_at?: string;
          updated_at?: string;
          waist_cm?: number | null;
          week_start?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checkins_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coach_notes: {
        Row: {
          adherent_id: string;
          body: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          body: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          adherent_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coach_notes_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      consents: {
        Row: {
          granted_at: string;
          id: string;
          revoked_at: string | null;
          type: Database['public']['Enums']['consent_type'];
          user_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          type: Database['public']['Enums']['consent_type'];
          user_id: string;
          version: string;
        };
        Update: {
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          type?: Database['public']['Enums']['consent_type'];
          user_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          adherent_id: string;
          created_at: string;
          id: string;
          last_message_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
        };
        Update: {
          adherent_id?: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_alternatives: {
        Row: {
          alternative_id: string;
          exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          alternative_id: string;
          exercise_id: string;
        };
        Update: {
          alternative_id?: string;
          exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_alternatives_alternative_id_fkey';
            columns: ['alternative_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_alternatives_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          archived_at: string | null;
          created_at: string;
          equipment: Database['public']['Enums']['equipment'];
          id: string;
          image_path: string | null;
          instructions: string | null;
          load_increment_kg: number;
          name: string;
          primary_muscle: Database['public']['Enums']['muscle_group'];
          secondary_muscles: Database['public']['Enums']['muscle_group'][];
          type: Database['public']['Enums']['exercise_type'];
          updated_at: string;
          video_path: string | null;
          video_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          equipment: Database['public']['Enums']['equipment'];
          id?: string;
          image_path?: string | null;
          instructions?: string | null;
          load_increment_kg?: number;
          name: string;
          primary_muscle: Database['public']['Enums']['muscle_group'];
          secondary_muscles?: Database['public']['Enums']['muscle_group'][];
          type: Database['public']['Enums']['exercise_type'];
          updated_at?: string;
          video_path?: string | null;
          video_url?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          equipment?: Database['public']['Enums']['equipment'];
          id?: string;
          image_path?: string | null;
          instructions?: string | null;
          load_increment_kg?: number;
          name?: string;
          primary_muscle?: Database['public']['Enums']['muscle_group'];
          secondary_muscles?: Database['public']['Enums']['muscle_group'][];
          type?: Database['public']['Enums']['exercise_type'];
          updated_at?: string;
          video_path?: string | null;
          video_url?: string | null;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          label: string | null;
          revoked_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          label?: string | null;
          revoked_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          label?: string | null;
          revoked_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_used_by_fkey';
            columns: ['used_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          conversation_id: string;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['message_kind'];
          media_duration_seconds: number | null;
          media_path: string | null;
          read_at: string | null;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          id: string;
          kind?: Database['public']['Enums']['message_kind'];
          media_duration_seconds?: number | null;
          media_path?: string | null;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['message_kind'];
          media_duration_seconds?: number | null;
          media_path?: string | null;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          push_sent_at: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          push_sent_at?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          push_sent_at?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_records: {
        Row: {
          achieved_at: string;
          adherent_id: string;
          created_at: string;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          record_type: Database['public']['Enums']['record_type'];
          session_log_id: string | null;
          set_log_id: string | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          achieved_at: string;
          adherent_id: string;
          created_at?: string;
          exercise_id: string;
          id: string;
          load_kg?: number | null;
          record_type: Database['public']['Enums']['record_type'];
          session_log_id?: string | null;
          set_log_id?: string | null;
          value: number;
        };
        Update: {
          achieved_at?: string;
          adherent_id?: string;
          created_at?: string;
          exercise_id?: string;
          id?: string;
          load_kg?: number | null;
          record_type?: Database['public']['Enums']['record_type'];
          session_log_id?: string | null;
          set_log_id?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_session_log_id_fkey';
            columns: ['session_log_id'];
            isOneToOne: false;
            referencedRelation: 'session_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_set_log_id_fkey';
            columns: ['set_log_id'];
            isOneToOne: false;
            referencedRelation: 'set_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      prescribed_sets: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          id: string;
          load_kg: number | null;
          load_pct_1rm: number | null;
          notes: string | null;
          position: number;
          program_id: string;
          reps_max: number | null;
          reps_min: number | null;
          rest_seconds: number | null;
          set_type: Database['public']['Enums']['set_type'];
          target_rir: number | null;
          target_rpe: number | null;
          tempo: string | null;
          updated_at: string;
          workout_exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          load_kg?: number | null;
          load_pct_1rm?: number | null;
          notes?: string | null;
          position?: number;
          program_id: string;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_seconds?: number | null;
          set_type?: Database['public']['Enums']['set_type'];
          target_rir?: number | null;
          target_rpe?: number | null;
          tempo?: string | null;
          updated_at?: string;
          workout_exercise_id: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          load_kg?: number | null;
          load_pct_1rm?: number | null;
          notes?: string | null;
          position?: number;
          program_id?: string;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_seconds?: number | null;
          set_type?: Database['public']['Enums']['set_type'];
          target_rir?: number | null;
          target_rpe?: number | null;
          tempo?: string | null;
          updated_at?: string;
          workout_exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prescribed_sets_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prescribed_sets_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          birth_date: string | null;
          checkin_weekday: number | null;
          created_at: string;
          effort_scale: Database['public']['Enums']['effort_scale'];
          first_name: string | null;
          goal: Database['public']['Enums']['training_goal'] | null;
          height_cm: number | null;
          id: string;
          injuries: string | null;
          is_active: boolean;
          last_name: string | null;
          level: Database['public']['Enums']['training_level'] | null;
          nickname: string | null;
          notification_prefs: NonNullable<Json>;
          onboarded_at: string | null;
          role: Database['public']['Enums']['user_role'];
          sex: Database['public']['Enums']['sex'] | null;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          effort_scale?: Database['public']['Enums']['effort_scale'];
          first_name?: string | null;
          goal?: Database['public']['Enums']['training_goal'] | null;
          height_cm?: number | null;
          id: string;
          injuries?: string | null;
          is_active?: boolean;
          last_name?: string | null;
          level?: Database['public']['Enums']['training_level'] | null;
          nickname?: string | null;
          notification_prefs?: NonNullable<Json>;
          onboarded_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          birth_date?: string | null;
          checkin_weekday?: number | null;
          created_at?: string;
          effort_scale?: Database['public']['Enums']['effort_scale'];
          first_name?: string | null;
          goal?: Database['public']['Enums']['training_goal'] | null;
          height_cm?: number | null;
          id?: string;
          injuries?: string | null;
          is_active?: boolean;
          last_name?: string | null;
          level?: Database['public']['Enums']['training_level'] | null;
          nickname?: string | null;
          notification_prefs?: NonNullable<Json>;
          onboarded_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          sex?: Database['public']['Enums']['sex'] | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      program_week_adjustments: {
        Row: {
          created_at: string;
          id: string;
          load_factor: number;
          note: string | null;
          program_id: string;
          volume_factor: number;
          week_index: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          load_factor?: number;
          note?: string | null;
          program_id: string;
          volume_factor?: number;
          week_index: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          load_factor?: number;
          note?: string | null;
          program_id?: string;
          volume_factor?: number;
          week_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'program_week_adjustments_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
        ];
      };
      programs: {
        Row: {
          adherent_id: string | null;
          created_at: string;
          description: string | null;
          duration_weeks: number;
          id: string;
          kind: Database['public']['Enums']['program_kind'];
          name: string;
          source_template_id: string | null;
          start_date: string | null;
          status: Database['public']['Enums']['program_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adherent_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_weeks?: number;
          id?: string;
          kind: Database['public']['Enums']['program_kind'];
          name: string;
          source_template_id?: string | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['program_status'];
          updated_at?: string;
        };
        Update: {
          adherent_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_weeks?: number;
          id?: string;
          kind?: Database['public']['Enums']['program_kind'];
          name?: string;
          source_template_id?: string | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['program_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'programs_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'programs_source_template_id_fkey';
            columns: ['source_template_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
        ];
      };
      progression_rules: {
        Row: {
          adherent_id: string | null;
          auto_apply: boolean;
          enabled: boolean;
          exercise_id: string | null;
          id: string;
          params: NonNullable<Json>;
          rule_key: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adherent_id?: string | null;
          auto_apply?: boolean;
          enabled?: boolean;
          exercise_id?: string | null;
          id?: string;
          params?: NonNullable<Json>;
          rule_key: string;
          updated_at?: string;
        };
        Update: {
          adherent_id?: string | null;
          auto_apply?: boolean;
          enabled?: boolean;
          exercise_id?: string | null;
          id?: string;
          params?: NonNullable<Json>;
          rule_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'progression_rules_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'progression_rules_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reference_1rm: {
        Row: {
          adherent_id: string;
          exercise_id: string;
          measured_on: string;
          updated_at: string;
          value_kg: number;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          exercise_id: string;
          measured_on?: string;
          updated_at?: string;
          value_kg: number;
        };
        Update: {
          adherent_id?: string;
          exercise_id?: string;
          measured_on?: string;
          updated_at?: string;
          value_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'reference_1rm_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reference_1rm_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      session_logs: {
        Row: {
          adherent_id: string;
          analyzed_at: string | null;
          created_at: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          notes: string | null;
          program_id: string | null;
          rating: number | null;
          scheduled_date: string | null;
          started_at: string;
          status: Database['public']['Enums']['session_status'];
          updated_at: string;
          workout_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          analyzed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id: string;
          notes?: string | null;
          program_id?: string | null;
          rating?: number | null;
          scheduled_date?: string | null;
          started_at: string;
          status?: Database['public']['Enums']['session_status'];
          updated_at?: string;
          workout_id?: string | null;
        };
        Update: {
          adherent_id?: string;
          analyzed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          program_id?: string | null;
          rating?: number | null;
          scheduled_date?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['session_status'];
          updated_at?: string;
          workout_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'session_logs_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_logs_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_logs_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      set_logs: {
        Row: {
          adherent_id: string;
          completed: boolean;
          created_at: string;
          duration_seconds: number | null;
          exercise_id: string;
          id: string;
          load_kg: number | null;
          note: string | null;
          performed_at: string;
          position: number;
          prescribed_set_id: string | null;
          reps: number | null;
          rest_seconds_actual: number | null;
          rest_seconds_prescribed: number | null;
          rir: number | null;
          rpe: number | null;
          session_log_id: string;
          set_type: Database['public']['Enums']['set_type'];
          updated_at: string;
          workout_exercise_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          completed?: boolean;
          created_at?: string;
          duration_seconds?: number | null;
          exercise_id: string;
          id: string;
          load_kg?: number | null;
          note?: string | null;
          performed_at?: string;
          position?: number;
          prescribed_set_id?: string | null;
          reps?: number | null;
          rest_seconds_actual?: number | null;
          rest_seconds_prescribed?: number | null;
          rir?: number | null;
          rpe?: number | null;
          session_log_id: string;
          set_type?: Database['public']['Enums']['set_type'];
          updated_at?: string;
          workout_exercise_id?: string | null;
        };
        Update: {
          adherent_id?: string;
          completed?: boolean;
          created_at?: string;
          duration_seconds?: number | null;
          exercise_id?: string;
          id?: string;
          load_kg?: number | null;
          note?: string | null;
          performed_at?: string;
          position?: number;
          prescribed_set_id?: string | null;
          reps?: number | null;
          rest_seconds_actual?: number | null;
          rest_seconds_prescribed?: number | null;
          rir?: number | null;
          rpe?: number | null;
          session_log_id?: string;
          set_type?: Database['public']['Enums']['set_type'];
          updated_at?: string;
          workout_exercise_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'set_logs_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_prescribed_set_id_fkey';
            columns: ['prescribed_set_id'];
            isOneToOne: false;
            referencedRelation: 'prescribed_sets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_session_log_id_fkey';
            columns: ['session_log_id'];
            isOneToOne: false;
            referencedRelation: 'session_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'set_logs_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      suggestions: {
        Row: {
          adherent_id: string;
          applied_changes: Json | null;
          created_at: string;
          current_value: NonNullable<Json>;
          decided_at: string | null;
          dedupe_key: string;
          exercise_id: string | null;
          final_value: Json | null;
          id: string;
          justification: string;
          kind: Database['public']['Enums']['suggestion_kind'];
          program_id: string | null;
          proposed_value: NonNullable<Json>;
          reverted_at: string | null;
          rule_key: string;
          source_session_id: string | null;
          status: Database['public']['Enums']['suggestion_status'];
        };
        ComputedFields: never;
        Insert: {
          adherent_id: string;
          applied_changes?: Json | null;
          created_at?: string;
          current_value?: NonNullable<Json>;
          decided_at?: string | null;
          dedupe_key: string;
          exercise_id?: string | null;
          final_value?: Json | null;
          id?: string;
          justification: string;
          kind: Database['public']['Enums']['suggestion_kind'];
          program_id?: string | null;
          proposed_value?: NonNullable<Json>;
          reverted_at?: string | null;
          rule_key: string;
          source_session_id?: string | null;
          status?: Database['public']['Enums']['suggestion_status'];
        };
        Update: {
          adherent_id?: string;
          applied_changes?: Json | null;
          created_at?: string;
          current_value?: NonNullable<Json>;
          decided_at?: string | null;
          dedupe_key?: string;
          exercise_id?: string | null;
          final_value?: Json | null;
          id?: string;
          justification?: string;
          kind?: Database['public']['Enums']['suggestion_kind'];
          program_id?: string | null;
          proposed_value?: NonNullable<Json>;
          reverted_at?: string | null;
          rule_key?: string;
          source_session_id?: string | null;
          status?: Database['public']['Enums']['suggestion_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'suggestions_adherent_id_fkey';
            columns: ['adherent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'suggestions_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'suggestions_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'suggestions_source_session_id_fkey';
            columns: ['source_session_id'];
            isOneToOne: false;
            referencedRelation: 'session_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          alternative_exercise_ids: string[];
          coach_notes: string | null;
          created_at: string;
          exercise_id: string;
          id: string;
          next_session_hint: string | null;
          position: number;
          program_id: string;
          superset_group: string | null;
          updated_at: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          alternative_exercise_ids?: string[];
          coach_notes?: string | null;
          created_at?: string;
          exercise_id: string;
          id?: string;
          next_session_hint?: string | null;
          position?: number;
          program_id: string;
          superset_group?: string | null;
          updated_at?: string;
          workout_id: string;
        };
        Update: {
          alternative_exercise_ids?: string[];
          coach_notes?: string | null;
          created_at?: string;
          exercise_id?: string;
          id?: string;
          next_session_hint?: string | null;
          position?: number;
          program_id?: string;
          superset_group?: string | null;
          updated_at?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: {
          created_at: string;
          day_of_week: number;
          id: string;
          name: string;
          notes: string | null;
          position: number;
          program_id: string;
          updated_at: string;
          week_index: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day_of_week: number;
          id?: string;
          name: string;
          notes?: string | null;
          position?: number;
          program_id: string;
          updated_at?: string;
          week_index: number;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          position?: number;
          program_id?: string;
          updated_at?: string;
          week_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'workouts_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _copy_program: {
        Args: {
          p_adherent: string;
          p_kind: Database['public']['Enums']['program_kind'];
          p_name?: string;
          p_src: string;
          p_start: string;
          p_status: Database['public']['Enums']['program_status'];
        };
        Returns: string;
      };
      _copy_workout: {
        Args: { p_day?: number; p_src: string; p_target_program: string; p_week?: number };
        Returns: string;
      };
      _upcoming_workout_exercises: {
        Args: { p_exercise: string; p_program: string };
        Returns: {
          workout_date: string;
          workout_exercise_id: string;
          workout_id: string;
        }[];
      };
      apply_suggestion: {
        Args: { p_final?: Json; p_id: string };
        Returns: {
          adherent_id: string;
          applied_changes: Json | null;
          created_at: string;
          current_value: NonNullable<Json>;
          decided_at: string | null;
          dedupe_key: string;
          exercise_id: string | null;
          final_value: Json | null;
          id: string;
          justification: string;
          kind: Database['public']['Enums']['suggestion_kind'];
          program_id: string | null;
          proposed_value: NonNullable<Json>;
          reverted_at: string | null;
          rule_key: string;
          source_session_id: string | null;
          status: Database['public']['Enums']['suggestion_status'];
        };
        SetofOptions: {
          from: '*';
          to: 'suggestions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assign_program: {
        Args: { p_activate?: boolean; p_adherents: string[]; p_source: string; p_start: string };
        Returns: string[];
      };
      bootstrap_coach: {
        Args: { p_email: string };
        Returns: {
          avatar_path: string | null;
          birth_date: string | null;
          checkin_weekday: number | null;
          created_at: string;
          effort_scale: Database['public']['Enums']['effort_scale'];
          first_name: string | null;
          goal: Database['public']['Enums']['training_goal'] | null;
          height_cm: number | null;
          id: string;
          injuries: string | null;
          is_active: boolean;
          last_name: string | null;
          level: Database['public']['Enums']['training_level'] | null;
          nickname: string | null;
          notification_prefs: NonNullable<Json>;
          onboarded_at: string | null;
          role: Database['public']['Enums']['user_role'];
          sex: Database['public']['Enums']['sex'] | null;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_access_adherent: { Args: { p_adherent: string }; Returns: boolean };
      can_access_conversation: { Args: { p_conversation: string }; Returns: boolean };
      can_read_program: { Args: { p_program: string }; Returns: boolean };
      check_invitation: { Args: { p_code: string }; Returns: boolean };
      coach_id: { Args: Record<PropertyKey, never>; Returns: string };
      coach_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_program_name: string;
          adherent_id: string;
          avatar_path: string;
          first_name: string;
          goal: Database['public']['Enums']['training_goal'];
          is_active: boolean;
          last_checkin_week: string;
          last_name: string;
          last_session_at: string;
          nickname: string;
          onboarded: boolean;
          pending_suggestions: number;
          recent_weights: Json;
          sessions_done_28d: number;
          sessions_planned_28d: number;
          unseen_alerts: number;
        }[];
      };
      create_invitation: {
        Args: { p_label?: string };
        Returns: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          label: string | null;
          revoked_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'invitations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      display_name: { Args: { p_user: string }; Returns: string };
      duplicate_program: { Args: { p_as_template?: boolean; p_program: string }; Returns: string };
      duplicate_week: {
        Args: { p_from: number; p_program: string; p_to: number };
        Returns: number;
      };
      duplicate_workout: {
        Args: { p_day?: number; p_week?: number; p_workout: string };
        Returns: string;
      };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_coach: { Args: Record<PropertyKey, never>; Returns: boolean };
      notify: {
        Args: { p_body: string; p_data?: Json; p_title: string; p_type: string; p_user: string };
        Returns: undefined;
      };
      notify_program_change: {
        Args: { p_message?: string; p_program: string };
        Returns: undefined;
      };
      owns_session: { Args: { p_session: string }; Returns: boolean };
      redeem_invitation: {
        Args: { p_code: string };
        Returns: {
          avatar_path: string | null;
          birth_date: string | null;
          checkin_weekday: number | null;
          created_at: string;
          effort_scale: Database['public']['Enums']['effort_scale'];
          first_name: string | null;
          goal: Database['public']['Enums']['training_goal'] | null;
          height_cm: number | null;
          id: string;
          injuries: string | null;
          is_active: boolean;
          last_name: string | null;
          level: Database['public']['Enums']['training_level'] | null;
          nickname: string | null;
          notification_prefs: NonNullable<Json>;
          onboarded_at: string | null;
          role: Database['public']['Enums']['user_role'];
          sex: Database['public']['Enums']['sex'] | null;
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revert_suggestion: {
        Args: { p_id: string };
        Returns: {
          adherent_id: string;
          applied_changes: Json | null;
          created_at: string;
          current_value: NonNullable<Json>;
          decided_at: string | null;
          dedupe_key: string;
          exercise_id: string | null;
          final_value: Json | null;
          id: string;
          justification: string;
          kind: Database['public']['Enums']['suggestion_kind'];
          program_id: string | null;
          proposed_value: NonNullable<Json>;
          reverted_at: string | null;
          rule_key: string;
          source_session_id: string | null;
          status: Database['public']['Enums']['suggestion_status'];
        };
        SetofOptions: {
          from: '*';
          to: 'suggestions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      run_hourly_jobs: { Args: { p_now?: string }; Returns: Json };
      storage_owner: { Args: { p_name: string }; Returns: string };
      week_start: { Args: { p_date: string }; Returns: string };
      workout_date: { Args: { p_day: number; p_start: string; p_week: number }; Returns: string };
    };
    Enums: {
      alert_type:
        | 'missed_workout'
        | 'inactive'
        | 'stagnation'
        | 'high_fatigue'
        | 'checkin_missing'
        | 'new_record'
        | 'long_rest';
      consent_type: 'terms' | 'training_data' | 'health_data' | 'ai_photo' | 'community';
      effort_scale: 'rir' | 'rpe';
      equipment:
        | 'barbell'
        | 'dumbbell'
        | 'machine'
        | 'cable'
        | 'bodyweight'
        | 'kettlebell'
        | 'band'
        | 'smith'
        | 'ez_bar'
        | 'cardio_machine'
        | 'other';
      exercise_type: 'free_weight' | 'machine' | 'bodyweight' | 'cardio' | 'timed';
      message_kind: 'text' | 'image' | 'video';
      muscle_group:
        | 'chest'
        | 'back'
        | 'lats'
        | 'traps'
        | 'shoulders'
        | 'rear_delts'
        | 'biceps'
        | 'triceps'
        | 'forearms'
        | 'abs'
        | 'obliques'
        | 'lower_back'
        | 'glutes'
        | 'quads'
        | 'hamstrings'
        | 'adductors'
        | 'abductors'
        | 'calves'
        | 'full_body'
        | 'cardio';
      program_kind: 'template' | 'assigned';
      program_status: 'draft' | 'active' | 'completed' | 'archived';
      record_type: 'max_load' | 'estimated_1rm' | 'reps_at_load' | 'session_volume';
      session_status: 'in_progress' | 'completed' | 'abandoned';
      set_type: 'warmup' | 'working' | 'drop' | 'failure' | 'backoff' | 'amrap';
      sex: 'male' | 'female' | 'other';
      suggestion_kind: 'load' | 'reps_target' | 'deload' | 'variation' | 'rep_range' | 'info';
      suggestion_status:
        'pending' | 'accepted' | 'modified' | 'rejected' | 'auto_applied' | 'reverted';
      training_goal: 'muscle_gain' | 'fat_loss' | 'recomposition' | 'performance' | 'health';
      training_level: 'beginner' | 'intermediate' | 'advanced';
      user_role: 'coach' | 'adherent';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      alert_type: [
        'missed_workout',
        'inactive',
        'stagnation',
        'high_fatigue',
        'checkin_missing',
        'new_record',
        'long_rest',
      ],
      consent_type: ['terms', 'training_data', 'health_data', 'ai_photo', 'community'],
      effort_scale: ['rir', 'rpe'],
      equipment: [
        'barbell',
        'dumbbell',
        'machine',
        'cable',
        'bodyweight',
        'kettlebell',
        'band',
        'smith',
        'ez_bar',
        'cardio_machine',
        'other',
      ],
      exercise_type: ['free_weight', 'machine', 'bodyweight', 'cardio', 'timed'],
      message_kind: ['text', 'image', 'video'],
      muscle_group: [
        'chest',
        'back',
        'lats',
        'traps',
        'shoulders',
        'rear_delts',
        'biceps',
        'triceps',
        'forearms',
        'abs',
        'obliques',
        'lower_back',
        'glutes',
        'quads',
        'hamstrings',
        'adductors',
        'abductors',
        'calves',
        'full_body',
        'cardio',
      ],
      program_kind: ['template', 'assigned'],
      program_status: ['draft', 'active', 'completed', 'archived'],
      record_type: ['max_load', 'estimated_1rm', 'reps_at_load', 'session_volume'],
      session_status: ['in_progress', 'completed', 'abandoned'],
      set_type: ['warmup', 'working', 'drop', 'failure', 'backoff', 'amrap'],
      sex: ['male', 'female', 'other'],
      suggestion_kind: ['load', 'reps_target', 'deload', 'variation', 'rep_range', 'info'],
      suggestion_status: [
        'pending',
        'accepted',
        'modified',
        'rejected',
        'auto_applied',
        'reverted',
      ],
      training_goal: ['muscle_gain', 'fat_loss', 'recomposition', 'performance', 'health'],
      training_level: ['beginner', 'intermediate', 'advanced'],
      user_role: ['coach', 'adherent'],
    },
  },
} as const;
