/**
 * Types for the tables in supabase/schema.sql. Keep the two in sync when the schema changes.
 *
 * Written by hand instead of `supabase gen types` so the `check (... in (...))` columns
 * become literal unions rather than plain `string`.
 */

export type EmployeeStatus = "idle" | "working" | "needs_you" | "error";
export type RunStatus = "running" | "done" | "needs_you" | "error";
export type RunTrigger = "schedule" | "manual";
export type JobStatus = "saved" | "applied" | "interview" | "offer" | "closed";
export type ReminderRepeat = "daily" | "weekdays" | "weekly";
export type InboxCategory = "reply" | "fyi" | "ignore" | "interview";
export type ReminderSource = "hq" | "iphone";

export const JOB_STATUSES = ["saved", "applied", "interview", "offer", "closed"] as const satisfies readonly JobStatus[];
export const REMINDER_REPEATS = ["daily", "weekdays", "weekly"] as const satisfies readonly ReminderRepeat[];
export const INBOX_CATEGORIES = ["reply", "fyi", "ignore", "interview"] as const satisfies readonly InboxCategory[];

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          enabled: boolean;
          status: EmployeeStatus;
          summary: string | null;
          last_run_at: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          enabled?: boolean;
          status?: EmployeeStatus;
          summary?: string | null;
          last_run_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      runs: {
        Row: {
          id: string;
          employee_id: string;
          trigger: RunTrigger;
          status: RunStatus;
          output: string | null;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          trigger?: RunTrigger;
          status?: RunStatus;
          output?: string | null;
          error?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["runs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "runs_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          role: string;
          company: string;
          link: string | null;
          source: string | null;
          salary_text: string | null;
          salary_min_php: number | null;
          fit_score: number | null;
          fit_reason: string | null;
          status: JobStatus;
          date_found: string;
          date_applied: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          company: string;
          link?: string | null;
          source?: string | null;
          salary_text?: string | null;
          salary_min_php?: number | null;
          fit_score?: number | null;
          fit_reason?: string | null;
          status?: JobStatus;
          date_found?: string;
          date_applied?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          job_id: string | null;
          company: string | null;
          starts_at: string;
          meeting_link: string | null;
          calendar_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          company?: string | null;
          starts_at: string;
          meeting_link?: string | null;
          calendar_event_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interviews"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "interviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          title: string;
          due_at: string;
          repeat: ReminderRepeat | null;
          sent_at: string | null;
          source: ReminderSource;
          pushed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          due_at: string;
          repeat?: ReminderRepeat | null;
          sent_at?: string | null;
          source?: ReminderSource;
          pushed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminders"]["Insert"]>;
        Relationships: [];
      };
      inbox_items: {
        Row: {
          message_id: string;
          thread_id: string | null;
          sender: string | null;
          subject: string | null;
          category: InboxCategory | null;
          summary: string | null;
          draft_id: string | null;
          handled: boolean;
          received_at: string | null;
          created_at: string;
        };
        Insert: {
          message_id: string;
          thread_id?: string | null;
          sender?: string | null;
          subject?: string | null;
          category?: InboxCategory | null;
          summary?: string | null;
          draft_id?: string | null;
          handled?: boolean;
          received_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_items"]["Insert"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"];
