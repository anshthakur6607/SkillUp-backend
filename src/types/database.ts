/**
 * Supabase database schema types.
 *
 * This file defines the TypeScript types for our database tables, matching
 * the schema created in Backend Step 2 migrations. These types let the
 * Supabase client provide autocomplete and type checking for all queries.
 *
 * When adding new tables in future steps, add their types here to keep
 * the Supabase client properly typed.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          designation: string | null;
          department_id: string | null;
          job_role: string | null;
          education: string | null;
          years_of_experience: number | null;
          role: 'employee' | 'manager' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          designation?: string | null;
          department_id?: string | null;
          job_role?: string | null;
          education?: string | null;
          years_of_experience?: number | null;
          role?: 'employee' | 'manager' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          designation?: string | null;
          department_id?: string | null;
          job_role?: string | null;
          education?: string | null;
          years_of_experience?: number | null;
          role?: 'employee' | 'manager' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      competency_domains: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      competencies: {
        Row: {
          id: string;
          domain_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          source: 'igot' | 'internal' | 'nssta_tpac' | 'other';
          external_url: string | null;
          external_id: string | null;
          duration_hours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          source?: 'igot' | 'internal' | 'nssta_tpac' | 'other';
          external_url?: string | null;
          external_id?: string | null;
          duration_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          source?: 'igot' | 'internal' | 'nssta_tpac' | 'other';
          external_url?: string | null;
          external_id?: string | null;
          duration_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'employee' | 'manager' | 'admin';
      course_source: 'igot' | 'internal' | 'nssta_tpac' | 'other';
      enrollment_status: 'not_started' | 'in_progress' | 'completed';
      difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'critical';
    };
  };
}
