// Hand-written to match supabase/migrations/*.sql. If the schema changes,
// prefer regenerating with `supabase gen types typescript` and reconciling.

export type UserRole = "coach" | "client";
export type WorkoutStatus = "scheduled" | "completed" | "skipped";
export type ProgramStatus = "active" | "completed" | "paused";
export type CheckinStatus = "pending" | "reviewed";
export type MeetingStatus = "scheduled" | "completed" | "cancelled";
export type SleepQuality = "poor" | "okay" | "strong";
export type PhotoAngle = "front" | "side" | "back";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  goal: string | null;
  age: number | null;
  sex: "male" | "female" | "other" | null;
  height_cm: number | null;
  timezone: string;
  notification_prefs: Record<string, boolean>;
  daily_report_settings: { enabled?: boolean; time?: string; push?: boolean };
  created_at: string;
  updated_at: string;
}

export interface CoachClient {
  id: string;
  coach_id: string;
  client_id: string | null;
  invited_email: string | null;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
}

export interface ProgramRow {
  id: string;
  coach_id: string;
  client_id: string;
  name: string;
  start_date: string;
  status: ProgramStatus;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRow {
  id: string;
  coach_id: string;
  name: string;
  category: string | null;
  muscle_group: string | null;
  equipment: string | null;
  instructions: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface WorkoutRow {
  id: string;
  coach_id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  sets: number;
  reps: string;
  load: string | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface WorkoutAssignmentRow {
  id: string;
  workout_id: string;
  client_id: string;
  coach_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: WorkoutStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SetLogRow {
  id: string;
  assignment_id: string;
  workout_exercise_id: string;
  set_number: number;
  reps_done: number | null;
  weight_used: number | null;
  completed_at: string;
}

export interface NutritionPlanRow {
  id: string;
  coach_id: string;
  client_id: string;
  name: string;
  day_type: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface MealRow {
  id: string;
  nutrition_plan_id: string;
  name: string;
  meal_time: string | null;
  order_index: number;
  foods_summary: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealLogRow {
  id: string;
  meal_id: string;
  client_id: string;
  log_date: string;
  completed: boolean;
  completed_at: string | null;
}

export interface HabitTargetRow {
  id: string;
  coach_id: string;
  client_id: string;
  name: string;
  target_value: number;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export interface HabitLogRow {
  id: string;
  habit_target_id: string;
  log_date: string;
  value_logged: number;
  completed: boolean;
}

export interface ProgressEntryRow {
  id: string;
  client_id: string;
  entry_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhotoRow {
  id: string;
  client_id: string;
  entry_date: string;
  angle: PhotoAngle;
  storage_path: string;
  created_at: string;
}

export interface PersonalRecordRow {
  id: string;
  client_id: string;
  exercise_name: string;
  value: string;
  previous_value: string | null;
  achieved_at: string;
  created_at: string;
}

export interface CheckInRow {
  id: string;
  client_id: string;
  coach_id: string;
  week_start_date: string;
  weight_kg: number | null;
  energy: number | null;
  sleep_hours: number | null;
  sleep_quality: SleepQuality | null;
  mood: string | null;
  training_feedback: string | null;
  status: CheckinStatus;
  coach_feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface CheckInPhotoRow {
  id: string;
  check_in_id: string;
  angle: PhotoAngle;
  storage_path: string;
}

export interface ConversationRow {
  id: string;
  coach_id: string;
  client_id: string;
  created_at: string;
  last_message_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface MeetingRow {
  id: string;
  coach_id: string;
  client_id: string;
  title: string;
  notes: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: MeetingStatus;
  video_url: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  /** Structured values (actor_name, workout_title, meeting_title, event_title, ...) the UI uses
   *  to render the notification in the viewer's language; `title` is the English fallback. */
  metadata: Record<string, string | null>;
  read_at: string | null;
  created_at: string;
}

export type ScheduleEventType = "session" | "check_in" | "reminder" | "call" | "other";

export interface ScheduleEventRow {
  id: string;
  coach_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  event_type: ScheduleEventType;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string; email: string }>;
      coach_clients: TableDef<CoachClient, Partial<CoachClient> & { coach_id: string }>;
      programs: TableDef<
        ProgramRow,
        Omit<ProgramRow, "id" | "created_at" | "updated_at"> & { id?: string }
      >;
      exercises: TableDef<ExerciseRow, Omit<ExerciseRow, "id" | "created_at"> & { id?: string }>;
      workouts: TableDef<
        WorkoutRow,
        Omit<WorkoutRow, "id" | "created_at" | "updated_at"> & { id?: string }
      >;
      workout_exercises: TableDef<
        WorkoutExerciseRow,
        Omit<WorkoutExerciseRow, "id"> & { id?: string }
      >;
      workout_assignments: TableDef<
        WorkoutAssignmentRow,
        Omit<WorkoutAssignmentRow, "id" | "created_at"> & { id?: string }
      >;
      set_logs: TableDef<SetLogRow, Omit<SetLogRow, "id" | "completed_at"> & { id?: string }>;
      nutrition_plans: TableDef<
        NutritionPlanRow,
        Omit<NutritionPlanRow, "id" | "created_at"> & { id?: string }
      >;
      meals: TableDef<MealRow, Omit<MealRow, "id"> & { id?: string }>;
      meal_logs: TableDef<MealLogRow, Omit<MealLogRow, "id"> & { id?: string }>;
      habit_targets: TableDef<
        HabitTargetRow,
        Omit<HabitTargetRow, "id" | "created_at"> & { id?: string }
      >;
      habit_logs: TableDef<HabitLogRow, Omit<HabitLogRow, "id"> & { id?: string }>;
      progress_entries: TableDef<
        ProgressEntryRow,
        Omit<ProgressEntryRow, "id" | "created_at"> & { id?: string }
      >;
      progress_photos: TableDef<
        ProgressPhotoRow,
        Omit<ProgressPhotoRow, "id" | "created_at"> & { id?: string }
      >;
      personal_records: TableDef<
        PersonalRecordRow,
        Omit<PersonalRecordRow, "id" | "created_at"> & { id?: string }
      >;
      check_ins: TableDef<CheckInRow, Omit<CheckInRow, "id" | "submitted_at"> & { id?: string }>;
      check_in_photos: TableDef<CheckInPhotoRow, Omit<CheckInPhotoRow, "id"> & { id?: string }>;
      conversations: TableDef<
        ConversationRow,
        Omit<ConversationRow, "id" | "created_at" | "last_message_at"> & { id?: string }
      >;
      messages: TableDef<MessageRow, Omit<MessageRow, "id" | "created_at"> & { id?: string }>;
      meetings: TableDef<MeetingRow, Omit<MeetingRow, "id" | "created_at"> & { id?: string }>;
      notifications: TableDef<
        NotificationRow,
        Omit<NotificationRow, "id" | "created_at"> & { id?: string }
      >;
      schedule_events: TableDef<
        ScheduleEventRow,
        Omit<ScheduleEventRow, "id" | "created_at" | "updated_at"> & { id?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      add_client_by_email: {
        Args: { p_email: string };
        Returns: CoachClient;
      };
    };
    Enums: {
      user_role: UserRole;
      workout_status: WorkoutStatus;
      program_status: ProgramStatus;
      checkin_status: CheckinStatus;
      meeting_status: MeetingStatus;
      sleep_quality: SleepQuality;
      photo_angle: PhotoAngle;
    };
  };
}
