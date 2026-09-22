-- Fix: workout_exercises.exercise_id was "on delete restrict", which blocks deleting a coach
-- account entirely (deleting auth.users cascades to both profiles->exercises and
-- profiles->workouts->workout_exercises; the restrict constraint on the latter can fire before
-- the former's cascade completes, producing an unresolvable FK conflict). Cascade is correct:
-- removing an exercise from the library should also remove it from any workout that used it.
alter table public.workout_exercises
  drop constraint workout_exercises_exercise_id_fkey,
  add constraint workout_exercises_exercise_id_fkey
    foreign key (exercise_id) references public.exercises(id) on delete cascade;
