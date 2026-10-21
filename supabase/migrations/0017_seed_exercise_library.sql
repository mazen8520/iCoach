-- iCoach 0017: the built-in exercise library (204 exercises).
-- Global rows (is_global, no owning coach) that every coach can browse and add to programs.
-- Idempotent: an exercise is only inserted when no global exercise with the same name exists,
-- so running this twice never creates duplicates. Coaches' own exercises are never touched.
-- Generated from a data list; one instruction step per line.

insert into public.exercises (
  name, body_region, primary_muscles, secondary_muscles, equipment_list, instructions,
  exercise_type, default_sets, default_reps, default_rest_seconds, default_duration_seconds,
  is_global, is_library, coach_id
)
select v.name, v.body_region, v.primary_muscles, v.secondary_muscles, v.equipment_list,
       v.instructions, v.exercise_type, v.default_sets, v.default_reps, v.default_rest_seconds,
       v.default_duration_seconds, true, true, null
from (values
  ('Barbell Bench Press', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['barbell', 'bench']::text[], 'Lie on the bench, eyes under the bar, feet planted
Lower the bar under control to mid-chest
Press up and slightly back to lockout', 'strength', 4, '6-10', 120, null),
  ('Incline Barbell Bench Press', 'upper_body', array['chest']::text[], array['shoulders', 'triceps']::text[], array['barbell', 'bench']::text[], 'Set the bench to 30–45°
Lower the bar to the upper chest
Press up over the shoulders', 'strength', 4, '6-10', 120, null),
  ('Decline Barbell Bench Press', 'upper_body', array['chest']::text[], array['triceps']::text[], array['barbell', 'bench']::text[], 'Secure your legs on the decline bench
Lower the bar to the lower chest
Press back to lockout', 'strength', 3, '8-10', 120, null),
  ('Dumbbell Bench Press', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['dumbbell', 'bench']::text[], 'Start with dumbbells over the chest
Lower with elbows about 45° from the body
Press up until the arms are straight', 'hypertrophy', 3, '8-12', 90, null),
  ('Incline Dumbbell Press', 'upper_body', array['chest']::text[], array['shoulders', 'triceps']::text[], array['dumbbell', 'bench']::text[], 'Set the bench to 30–45°
Lower the dumbbells beside the upper chest
Press up and slightly together', 'hypertrophy', 3, '8-12', 90, null),
  ('Decline Dumbbell Press', 'upper_body', array['chest']::text[], array['triceps']::text[], array['dumbbell', 'bench']::text[], 'Lie on a decline bench with legs secured
Lower the dumbbells to the lower chest
Press back up', 'hypertrophy', 3, '8-12', 90, null),
  ('Dumbbell Fly', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['dumbbell', 'bench']::text[], 'Hold dumbbells over the chest, elbows softly bent
Open the arms wide until you feel a stretch
Bring them back together in an arc', 'hypertrophy', 3, '10-15', 60, null),
  ('Incline Dumbbell Fly', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['dumbbell', 'bench']::text[], 'Set the bench to 30°
Open the arms in a wide arc with soft elbows
Squeeze the dumbbells back together', 'hypertrophy', 3, '10-15', 60, null),
  ('High Cable Crossover', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['cable']::text[], 'Set pulleys high and step forward
Sweep the handles down and together in front of the hips
Return slowly to the stretch', 'hypertrophy', 3, '12-15', 60, null),
  ('Mid Cable Crossover', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['cable']::text[], 'Set pulleys at chest height
Bring the handles together in front of the chest
Return slowly to the stretch', 'hypertrophy', 3, '12-15', 60, null),
  ('Low Cable Crossover', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['cable']::text[], 'Set pulleys low
Sweep the handles up and together to upper-chest height
Lower under control', 'hypertrophy', 3, '12-15', 60, null),
  ('Pec Deck / Machine Fly', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['machine']::text[], 'Adjust the seat so the handles are at chest height
Bring the arms together and squeeze
Return slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Machine Chest Press', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['machine']::text[], 'Set the seat so the handles line up with mid-chest
Press forward to full extension
Return under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Smith Machine Bench Press', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['smith_machine', 'bench']::text[], 'Line the bar up with mid-chest
Unhook and lower under control
Press to lockout', 'hypertrophy', 3, '8-12', 90, null),
  ('Smith Machine Incline Press', 'upper_body', array['chest']::text[], array['shoulders', 'triceps']::text[], array['smith_machine', 'bench']::text[], 'Set the bench to 30–45° under the bar
Lower to the upper chest
Press to lockout', 'hypertrophy', 3, '8-12', 90, null),
  ('Push-Up', 'upper_body', array['chest']::text[], array['triceps', 'shoulders', 'abs']::text[], array['bodyweight']::text[], 'Hands slightly wider than shoulders, body in a straight line
Lower until the chest nearly touches the floor
Push back up', 'strength', 3, '10-20', 60, null),
  ('Incline Push-Up', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['bodyweight', 'bench']::text[], 'Hands on a bench or box
Keep the body straight and lower the chest to the edge
Push back up', 'strength', 3, '10-20', 60, null),
  ('Decline Push-Up', 'upper_body', array['chest']::text[], array['shoulders', 'triceps']::text[], array['bodyweight', 'bench']::text[], 'Feet on a bench, hands on the floor
Lower the chest toward the floor
Push back up', 'strength', 3, '8-15', 60, null),
  ('Diamond Push-Up', 'upper_body', array['chest']::text[], array['triceps']::text[], array['bodyweight']::text[], 'Hands together under the chest forming a diamond
Lower with elbows close to the body
Push back up', 'strength', 3, '8-15', 60, null),
  ('Wide Push-Up', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['bodyweight']::text[], 'Hands wider than shoulder width
Lower the chest to the floor
Push back up', 'strength', 3, '10-20', 60, null),
  ('Chest Dips', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['bodyweight']::text[], 'Support yourself on dip bars and lean forward
Lower until the shoulders are just below the elbows
Press back up', 'strength', 3, '8-12', 90, null),
  ('Landmine Press', 'upper_body', array['chest']::text[], array['shoulders', 'triceps']::text[], array['barbell']::text[], 'Hold the end of a landmine bar at the shoulder
Press up and forward to full extension
Lower under control', 'strength', 3, '8-12', 90, null),
  ('Svend Press', 'upper_body', array['chest']::text[], array['shoulders']::text[], array['other']::text[], 'Squeeze a plate between the palms at the chest
Press it straight out while squeezing
Bring it back to the chest', 'hypertrophy', 3, '12-15', 60, null),
  ('Cable Chest Press', 'upper_body', array['chest']::text[], array['triceps', 'shoulders']::text[], array['cable']::text[], 'Stand between the pulleys in a split stance
Press both handles forward
Return under control', 'hypertrophy', 3, '10-12', 60, null),
  ('Deadlift', 'upper_body', array['back']::text[], array['hamstrings', 'glutes', 'traps', 'forearms']::text[], array['barbell']::text[], 'Bar over mid-foot, hips hinged, back flat
Drive through the floor and stand tall
Lower by pushing the hips back', 'strength', 4, '3-6', 180, null),
  ('Pull-Up', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['pull_up_bar']::text[], 'Hang with an overhand grip, slightly wider than shoulders
Pull until the chin clears the bar
Lower to a full hang', 'strength', 4, '6-10', 120, null),
  ('Chin-Up', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['pull_up_bar']::text[], 'Hang with an underhand, shoulder-width grip
Pull the chest toward the bar
Lower to a full hang', 'strength', 4, '6-10', 120, null),
  ('Assisted Pull-Up', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['machine']::text[], 'Set the assistance on the machine
Pull until the chin clears the bar
Lower under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Wide-Grip Lat Pulldown', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['cable', 'machine']::text[], 'Grip the bar wider than shoulders
Pull it to the upper chest, chest up
Let it rise under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Close-Grip Lat Pulldown', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['cable', 'machine']::text[], 'Use a close-grip handle
Pull to the upper chest, elbows down
Return under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Neutral-Grip Lat Pulldown', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['cable', 'machine']::text[], 'Use a neutral (palms-facing) grip
Pull to the upper chest
Return under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Barbell Row', 'upper_body', array['back']::text[], array['lats', 'biceps', 'lower_back']::text[], array['barbell']::text[], 'Hinge forward with a flat back
Row the bar to the lower ribs
Lower under control', 'strength', 4, '6-10', 120, null),
  ('Pendlay Row', 'upper_body', array['back']::text[], array['lats', 'lower_back']::text[], array['barbell']::text[], 'Torso parallel to the floor, bar on the ground
Row explosively to the lower chest
Return the bar to the floor each rep', 'strength', 4, '5-8', 120, null),
  ('Dumbbell Single-Arm Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['dumbbell', 'bench']::text[], 'One hand and knee on the bench
Row the dumbbell to the hip
Lower to a full stretch', 'hypertrophy', 3, '8-12', 60, null),
  ('Seated Cable Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['cable']::text[], 'Sit tall with a slight knee bend
Row the handle to the stomach, squeezing the shoulder blades
Return under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Single-Arm Cable Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['cable']::text[], 'Set the pulley at chest height
Row one handle to the hip
Return with a stretch', 'hypertrophy', 3, '10-12', 60, null),
  ('T-Bar Row', 'upper_body', array['back']::text[], array['lats', 'biceps', 'lower_back']::text[], array['barbell']::text[], 'Straddle the bar with a flat back
Row the handle to the chest
Lower under control', 'strength', 4, '8-10', 120, null),
  ('Chest-Supported Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['dumbbell', 'bench']::text[], 'Lie face down on an incline bench
Row the dumbbells to the ribs
Lower to a full stretch', 'hypertrophy', 3, '8-12', 90, null),
  ('Machine Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['machine']::text[], 'Set the chest pad so you reach the handles
Row and squeeze the shoulder blades
Return under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Straight-Arm Pulldown', 'upper_body', array['back']::text[], array['lats']::text[], array['cable']::text[], 'Arms straight, slight hip hinge
Sweep the bar down to the thighs
Return under control', 'hypertrophy', 3, '12-15', 60, null),
  ('Inverted Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['bodyweight', 'smith_machine']::text[], 'Hang under a bar with a straight body
Pull the chest to the bar
Lower under control', 'strength', 3, '8-15', 60, null),
  ('Rack Pull', 'upper_body', array['back']::text[], array['traps', 'glutes', 'hamstrings']::text[], array['barbell']::text[], 'Set the bar at knee height in a rack
Drive the hips forward to stand tall
Lower under control', 'strength', 4, '4-6', 150, null),
  ('Meadows Row', 'upper_body', array['back']::text[], array['lats', 'biceps']::text[], array['barbell']::text[], 'Stand side-on to a landmine bar, staggered stance
Row the end of the bar toward the hip
Lower to a stretch', 'hypertrophy', 3, '8-12', 90, null),
  ('Overhead Barbell Press', 'upper_body', array['shoulders']::text[], array['triceps', 'traps']::text[], array['barbell']::text[], 'Bar on the front shoulders, glutes tight
Press overhead, moving the head through
Lower to the shoulders', 'strength', 4, '5-8', 120, null),
  ('Seated Dumbbell Shoulder Press', 'upper_body', array['shoulders']::text[], array['triceps']::text[], array['dumbbell', 'bench']::text[], 'Sit upright with dumbbells at shoulder height
Press overhead
Lower under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Arnold Press', 'upper_body', array['shoulders']::text[], array['triceps']::text[], array['dumbbell']::text[], 'Start with palms facing you at shoulder height
Rotate the palms out as you press overhead
Reverse on the way down', 'hypertrophy', 3, '8-12', 90, null),
  ('Machine Shoulder Press', 'upper_body', array['shoulders']::text[], array['triceps']::text[], array['machine']::text[], 'Set the seat so the handles are at shoulder height
Press overhead
Return under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Dumbbell Lateral Raise', 'upper_body', array['shoulders']::text[], array['traps']::text[], array['dumbbell']::text[], 'Dumbbells at the sides, slight elbow bend
Raise out to shoulder height
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Cable Lateral Raise', 'upper_body', array['shoulders']::text[], '{}'::text[], array['cable']::text[], 'Pulley low, handle in the far hand
Raise the arm out to shoulder height
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Dumbbell Front Raise', 'upper_body', array['shoulders']::text[], '{}'::text[], array['dumbbell']::text[], 'Dumbbells in front of the thighs
Raise to shoulder height with straight arms
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Plate Front Raise', 'upper_body', array['shoulders']::text[], '{}'::text[], array['other']::text[], 'Hold a plate at the edges
Raise to eye level
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Cable Front Raise', 'upper_body', array['shoulders']::text[], '{}'::text[], array['cable']::text[], 'Face away from a low pulley
Raise the handle to shoulder height
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Rear Delt Fly', 'upper_body', array['shoulders']::text[], array['traps', 'back']::text[], array['dumbbell']::text[], 'Hinge forward with a flat back
Raise the dumbbells out to the sides
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Reverse Pec Deck', 'upper_body', array['shoulders']::text[], array['traps', 'back']::text[], array['machine']::text[], 'Face the pec deck with the handles at shoulder height
Sweep the arms back
Return slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Face Pull', 'upper_body', array['shoulders']::text[], array['traps', 'back']::text[], array['cable']::text[], 'Rope at face height
Pull toward the face, elbows high and hands apart
Return under control', 'hypertrophy', 3, '12-15', 60, null),
  ('Upright Row', 'upper_body', array['shoulders']::text[], array['traps']::text[], array['barbell']::text[], 'Hold the bar with a shoulder-width grip
Pull up to chest height, elbows leading
Lower under control', 'hypertrophy', 3, '10-12', 60, null),
  ('Push Press', 'upper_body', array['shoulders']::text[], array['triceps', 'quads']::text[], array['barbell']::text[], 'Bar on the front shoulders
Dip the knees, then drive the bar overhead
Lower to the shoulders', 'strength', 4, '4-6', 120, null),
  ('Landmine Shoulder Press', 'upper_body', array['shoulders']::text[], array['triceps', 'chest']::text[], array['barbell']::text[], 'Hold the landmine bar at the shoulder
Press up and forward with one arm
Lower under control', 'hypertrophy', 3, '8-12', 90, null),
  ('Cable Y-Raise', 'upper_body', array['shoulders']::text[], array['traps']::text[], array['cable']::text[], 'Cross the cables from low pulleys
Raise the arms up and out into a Y
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Barbell Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['barbell']::text[], 'Stand tall, elbows at the sides
Curl the bar to the shoulders
Lower slowly', 'hypertrophy', 3, '8-12', 60, null),
  ('EZ Bar Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['ez_bar']::text[], 'Grip the angled part of the bar
Curl without swinging
Lower slowly', 'hypertrophy', 3, '8-12', 60, null),
  ('Dumbbell Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['dumbbell']::text[], 'Palms forward, elbows at the sides
Curl to the shoulders
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Hammer Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['dumbbell']::text[], 'Palms facing each other
Curl keeping the neutral grip
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Incline Dumbbell Curl', 'upper_body', array['biceps']::text[], '{}'::text[], array['dumbbell', 'bench']::text[], 'Lie back on a 45° bench, arms hanging
Curl without moving the elbows
Lower to a full stretch', 'hypertrophy', 3, '10-12', 60, null),
  ('Preacher Curl', 'upper_body', array['biceps']::text[], '{}'::text[], array['ez_bar', 'bench']::text[], 'Rest the upper arms on the preacher pad
Curl up
Lower to almost straight', 'hypertrophy', 3, '10-12', 60, null),
  ('Concentration Curl', 'upper_body', array['biceps']::text[], '{}'::text[], array['dumbbell']::text[], 'Sit with the elbow braced on the inner thigh
Curl to the shoulder
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Cable Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['cable']::text[], 'Face a low pulley with a bar handle
Curl to the shoulders
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Spider Curl', 'upper_body', array['biceps']::text[], '{}'::text[], array['dumbbell', 'bench']::text[], 'Lie chest-down on an incline bench, arms hanging
Curl up
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Bayesian Cable Curl', 'upper_body', array['biceps']::text[], '{}'::text[], array['cable']::text[], 'Face away from a low pulley, arm behind the body
Curl forward without moving the elbow
Lower to a full stretch', 'hypertrophy', 3, '10-12', 60, null),
  ('Reverse Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['barbell']::text[], 'Overhand grip on the bar
Curl to the shoulders
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Zottman Curl', 'upper_body', array['biceps']::text[], array['forearms']::text[], array['dumbbell']::text[], 'Curl up with palms facing up
Rotate the palms down at the top
Lower slowly with palms down', 'hypertrophy', 3, '10-12', 60, null),
  ('Close-Grip Bench Press', 'upper_body', array['triceps']::text[], array['chest', 'shoulders']::text[], array['barbell', 'bench']::text[], 'Grip the bar about shoulder width
Lower to the lower chest, elbows tucked
Press to lockout', 'strength', 4, '6-10', 120, null),
  ('Skull Crusher', 'upper_body', array['triceps']::text[], '{}'::text[], array['ez_bar', 'bench']::text[], 'Lie on the bench, bar over the forehead
Bend the elbows to lower the bar behind the head
Extend back up', 'hypertrophy', 3, '8-12', 60, null),
  ('Overhead Dumbbell Extension', 'upper_body', array['triceps']::text[], '{}'::text[], array['dumbbell']::text[], 'Hold one dumbbell overhead with both hands
Lower behind the head
Extend back up', 'hypertrophy', 3, '10-12', 60, null),
  ('Overhead Cable Extension', 'upper_body', array['triceps']::text[], '{}'::text[], array['cable']::text[], 'Face away from the pulley, rope overhead
Extend the arms forward and up
Return to a stretch', 'hypertrophy', 3, '10-15', 60, null),
  ('Rope Cable Pushdown', 'upper_body', array['triceps']::text[], '{}'::text[], array['cable']::text[], 'Elbows pinned at the sides
Push the rope down and spread the ends
Return under control', 'hypertrophy', 3, '10-15', 60, null),
  ('Bar Cable Pushdown', 'upper_body', array['triceps']::text[], '{}'::text[], array['cable']::text[], 'Elbows pinned at the sides
Push the bar down to full extension
Return under control', 'hypertrophy', 3, '10-15', 60, null),
  ('V-Bar Cable Pushdown', 'upper_body', array['triceps']::text[], '{}'::text[], array['cable']::text[], 'Elbows pinned at the sides
Push the V-bar down to lockout
Return under control', 'hypertrophy', 3, '10-15', 60, null),
  ('Single-Arm Cable Pushdown', 'upper_body', array['triceps']::text[], '{}'::text[], array['cable']::text[], 'One handle, elbow at the side
Push down to lockout
Return under control', 'hypertrophy', 3, '12-15', 45, null),
  ('Tricep Dips', 'upper_body', array['triceps']::text[], array['chest', 'shoulders']::text[], array['bodyweight']::text[], 'Support yourself on dip bars, torso upright
Lower until the elbows reach 90°
Press back up', 'strength', 3, '8-12', 90, null),
  ('Bench Dips', 'upper_body', array['triceps']::text[], array['shoulders']::text[], array['bodyweight', 'bench']::text[], 'Hands on a bench behind you, legs out front
Lower by bending the elbows
Press back up', 'strength', 3, '10-15', 60, null),
  ('Dumbbell Kickback', 'upper_body', array['triceps']::text[], '{}'::text[], array['dumbbell']::text[], 'Hinge forward, upper arm parallel to the floor
Extend the arm back
Return under control', 'hypertrophy', 3, '12-15', 45, null),
  ('JM Press', 'upper_body', array['triceps']::text[], array['chest']::text[], array['barbell', 'bench']::text[], 'Close grip, bar over the chest
Lower toward the chin by bending the elbows forward
Press back up', 'strength', 3, '8-10', 90, null),
  ('Wrist Curl', 'upper_body', array['forearms']::text[], '{}'::text[], array['barbell']::text[], 'Forearms on the thighs, palms up
Curl the bar up with the wrists
Lower slowly', 'hypertrophy', 3, '12-20', 45, null),
  ('Reverse Wrist Curl', 'upper_body', array['forearms']::text[], '{}'::text[], array['barbell']::text[], 'Forearms on the thighs, palms down
Raise the bar with the wrists
Lower slowly', 'hypertrophy', 3, '12-20', 45, null),
  ('Farmer''s Walk', 'upper_body', array['forearms']::text[], array['traps', 'abs']::text[], array['dumbbell', 'kettlebell']::text[], 'Pick up heavy weights in each hand
Walk tall with the shoulders back
Set the weights down under control', 'strength', 3, null, 90, 40),
  ('Plate Pinch', 'upper_body', array['forearms']::text[], '{}'::text[], array['other']::text[], 'Pinch two plates together, smooth sides out
Hold at your side', 'strength', 3, null, 60, 30),
  ('Dead Hang', 'upper_body', array['forearms']::text[], array['lats']::text[], array['pull_up_bar']::text[], 'Grip the bar shoulder width
Hang with relaxed shoulders', 'strength', 3, null, 60, 30),
  ('Barbell Shrug', 'upper_body', array['traps']::text[], array['forearms']::text[], array['barbell']::text[], 'Hold the bar at arm''s length
Shrug the shoulders straight up
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Dumbbell Shrug', 'upper_body', array['traps']::text[], array['forearms']::text[], array['dumbbell']::text[], 'Dumbbells at the sides
Shrug straight up and hold briefly
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Trap Bar Shrug', 'upper_body', array['traps']::text[], array['forearms']::text[], array['trap_bar']::text[], 'Stand inside the trap bar
Shrug straight up
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Cable Shrug', 'upper_body', array['traps']::text[], '{}'::text[], array['cable']::text[], 'Hold a bar from a low pulley
Shrug straight up
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Back Squat', 'lower_body', array['quads']::text[], array['glutes', 'hamstrings', 'lower_back']::text[], array['barbell']::text[], 'Bar on the upper back, feet shoulder width
Sit down between the hips to depth
Drive up through the whole foot', 'strength', 4, '5-8', 150, null),
  ('Front Squat', 'lower_body', array['quads']::text[], array['glutes', 'abs']::text[], array['barbell']::text[], 'Bar on the front shoulders, elbows high
Squat down with an upright torso
Drive up', 'strength', 4, '5-8', 150, null),
  ('Goblet Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['dumbbell', 'kettlebell']::text[], 'Hold a weight at the chest
Squat between the knees
Stand back up', 'strength', 3, '8-12', 90, null),
  ('Hack Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['machine']::text[], 'Shoulders under the pads, feet mid-platform
Lower to a deep squat
Press back up', 'hypertrophy', 3, '8-12', 120, null),
  ('Leg Press', 'lower_body', array['quads']::text[], array['glutes', 'hamstrings']::text[], array['machine']::text[], 'Feet shoulder width on the platform
Lower until the knees reach about 90°
Press back up without locking out', 'hypertrophy', 3, '10-12', 120, null),
  ('Single-Leg Leg Press', 'lower_body', array['quads']::text[], array['glutes']::text[], array['machine']::text[], 'One foot centred on the platform
Lower under control
Press back up', 'hypertrophy', 3, '10-12', 90, null),
  ('Leg Extension', 'lower_body', array['quads']::text[], '{}'::text[], array['machine']::text[], 'Pad on the lower shins
Extend the legs fully and squeeze
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Bulgarian Split Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['dumbbell', 'bench']::text[], 'Rear foot on a bench
Lower the back knee toward the floor
Drive up through the front foot', 'hypertrophy', 3, '8-12', 90, null),
  ('Walking Lunge', 'lower_body', array['quads']::text[], array['glutes', 'hamstrings']::text[], array['dumbbell']::text[], 'Step forward into a lunge
Lower the back knee toward the floor
Step through into the next rep', 'hypertrophy', 3, '10-12', 90, null),
  ('Reverse Lunge', 'lower_body', array['quads']::text[], array['glutes']::text[], array['dumbbell']::text[], 'Step back into a lunge
Lower the back knee
Drive back to standing', 'hypertrophy', 3, '10-12', 90, null),
  ('Step-Up', 'lower_body', array['quads']::text[], array['glutes']::text[], array['dumbbell', 'bench']::text[], 'Place one foot on a box or bench
Drive up to stand tall
Step down under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Smith Machine Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['smith_machine']::text[], 'Bar on the upper back, feet slightly forward
Squat to depth
Drive up', 'hypertrophy', 3, '8-12', 120, null),
  ('Sissy Squat', 'lower_body', array['quads']::text[], '{}'::text[], array['bodyweight']::text[], 'Hold support, rise onto the toes
Lean back as the knees travel forward
Return to standing', 'hypertrophy', 3, '10-15', 60, null),
  ('Pendulum Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['machine']::text[], 'Shoulders under the pads
Lower into a deep squat
Drive back up', 'hypertrophy', 3, '8-12', 120, null),
  ('Box Squat', 'lower_body', array['quads']::text[], array['glutes', 'hamstrings']::text[], array['barbell']::text[], 'Squat back to a box behind you
Pause briefly on the box
Drive up', 'strength', 4, '5-8', 150, null),
  ('Split Squat', 'lower_body', array['quads']::text[], array['glutes']::text[], array['dumbbell']::text[], 'Staggered stance
Lower the back knee straight down
Drive back up', 'hypertrophy', 3, '8-12', 90, null),
  ('Romanian Deadlift', 'lower_body', array['hamstrings']::text[], array['glutes', 'lower_back']::text[], array['barbell']::text[], 'Soft knees, bar against the thighs
Push the hips back until you feel a stretch
Drive the hips forward to stand', 'strength', 4, '6-10', 120, null),
  ('Dumbbell Romanian Deadlift', 'lower_body', array['hamstrings']::text[], array['glutes', 'lower_back']::text[], array['dumbbell']::text[], 'Dumbbells in front of the thighs
Hinge at the hips with a flat back
Stand tall', 'hypertrophy', 3, '8-12', 90, null),
  ('Stiff-Leg Deadlift', 'lower_body', array['hamstrings']::text[], array['glutes', 'lower_back']::text[], array['barbell']::text[], 'Legs nearly straight
Hinge forward, lowering the bar along the legs
Return to standing', 'strength', 3, '8-10', 120, null),
  ('Single-Leg Romanian Deadlift', 'lower_body', array['hamstrings']::text[], array['glutes']::text[], array['dumbbell']::text[], 'Balance on one leg
Hinge forward as the other leg goes back
Return to standing', 'hypertrophy', 3, '8-12', 90, null),
  ('Lying Leg Curl', 'lower_body', array['hamstrings']::text[], array['calves']::text[], array['machine']::text[], 'Lie face down, pad above the heels
Curl the heels toward the glutes
Lower slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Seated Leg Curl', 'lower_body', array['hamstrings']::text[], '{}'::text[], array['machine']::text[], 'Thigh pad snug, pad behind the heels
Curl down and back
Return slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Nordic Curl', 'lower_body', array['hamstrings']::text[], '{}'::text[], array['bodyweight']::text[], 'Kneel with the ankles anchored
Lower the body forward as slowly as possible
Use the hands to catch and push back', 'strength', 3, '4-8', 120, null),
  ('Good Morning', 'lower_body', array['hamstrings']::text[], array['lower_back', 'glutes']::text[], array['barbell']::text[], 'Bar on the upper back, soft knees
Hinge forward with a flat back
Return to standing', 'strength', 3, '8-10', 90, null),
  ('Stability Ball Leg Curl', 'lower_body', array['hamstrings']::text[], array['glutes']::text[], array['other']::text[], 'Lie on your back, heels on the ball, hips up
Curl the ball toward you
Roll back out', 'hypertrophy', 3, '10-15', 60, null),
  ('Barbell Hip Thrust', 'lower_body', array['glutes']::text[], array['hamstrings']::text[], array['barbell', 'bench']::text[], 'Upper back on the bench, bar over the hips
Drive the hips up until the body is flat
Lower under control', 'hypertrophy', 4, '8-12', 90, null),
  ('Hip Thrust Machine', 'lower_body', array['glutes']::text[], array['hamstrings']::text[], array['machine']::text[], 'Back against the pad, belt over the hips
Drive the hips up and squeeze
Lower under control', 'hypertrophy', 3, '10-12', 90, null),
  ('Glute Bridge', 'lower_body', array['glutes']::text[], array['hamstrings']::text[], array['bodyweight']::text[], 'Lie on your back, feet flat
Drive the hips up and squeeze
Lower slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Single-Leg Hip Thrust', 'lower_body', array['glutes']::text[], array['hamstrings']::text[], array['bodyweight', 'bench']::text[], 'Upper back on a bench, one foot planted
Drive the hips up
Lower under control', 'hypertrophy', 3, '10-12', 60, null),
  ('Cable Kickback', 'lower_body', array['glutes']::text[], '{}'::text[], array['cable']::text[], 'Ankle strap on a low pulley
Kick the leg back and squeeze the glute
Return slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Glute Kickback Machine', 'lower_body', array['glutes']::text[], '{}'::text[], array['machine']::text[], 'Set the pad against the foot
Press the leg back and up
Return slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Sumo Deadlift', 'lower_body', array['glutes']::text[], array['quads', 'hamstrings', 'adductors', 'back']::text[], array['barbell']::text[], 'Wide stance, hands inside the knees
Push the floor apart and stand tall
Lower under control', 'strength', 4, '3-6', 180, null),
  ('Cable Pull-Through', 'lower_body', array['glutes']::text[], array['hamstrings']::text[], array['cable']::text[], 'Face away from a low pulley, rope between the legs
Hinge back
Drive the hips forward to stand', 'hypertrophy', 3, '12-15', 60, null),
  ('Frog Pump', 'lower_body', array['glutes']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie on your back, soles of the feet together
Drive the hips up
Lower slowly', 'hypertrophy', 3, '15-25', 45, null),
  ('Curtsy Lunge', 'lower_body', array['glutes']::text[], array['quads', 'adductors']::text[], array['dumbbell']::text[], 'Step one leg behind and across
Lower into a lunge
Return to standing', 'hypertrophy', 3, '10-12', 60, null),
  ('Standing Calf Raise', 'lower_body', array['calves']::text[], '{}'::text[], array['machine']::text[], 'Balls of the feet on the edge
Rise as high as possible
Lower to a full stretch', 'hypertrophy', 4, '10-15', 60, null),
  ('Seated Calf Raise', 'lower_body', array['calves']::text[], '{}'::text[], array['machine']::text[], 'Pad on the thighs, balls of the feet on the edge
Raise the heels
Lower to a full stretch', 'hypertrophy', 4, '12-15', 60, null),
  ('Leg Press Calf Raise', 'lower_body', array['calves']::text[], '{}'::text[], array['machine']::text[], 'Balls of the feet on the bottom edge of the platform
Push through the toes
Return to a stretch', 'hypertrophy', 3, '12-15', 60, null),
  ('Single-Leg Calf Raise', 'lower_body', array['calves']::text[], '{}'::text[], array['bodyweight', 'dumbbell']::text[], 'Stand on one foot on a step
Rise up high
Lower to a full stretch', 'hypertrophy', 3, '12-15', 45, null),
  ('Donkey Calf Raise', 'lower_body', array['calves']::text[], '{}'::text[], array['machine']::text[], 'Hinge forward with the hips under the pad
Rise onto the toes
Lower to a stretch', 'hypertrophy', 3, '12-15', 60, null),
  ('Hip Adduction Machine', 'lower_body', array['adductors']::text[], '{}'::text[], array['machine']::text[], 'Pads on the inner knees
Squeeze the legs together
Return slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Hip Abduction Machine', 'lower_body', array['abductors']::text[], array['glutes']::text[], array['machine']::text[], 'Pads on the outer knees
Push the legs apart
Return slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Cable Hip Adduction', 'lower_body', array['adductors']::text[], '{}'::text[], array['cable']::text[], 'Ankle strap on a low pulley, inside leg
Sweep the leg across the body
Return slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Cable Hip Abduction', 'lower_body', array['abductors']::text[], array['glutes']::text[], array['cable']::text[], 'Ankle strap on a low pulley, outside leg
Sweep the leg out to the side
Return slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Banded Lateral Walk', 'lower_body', array['abductors']::text[], array['glutes']::text[], array['resistance_band']::text[], 'Band above the knees, half squat
Step sideways keeping tension
Repeat in both directions', 'hypertrophy', 3, '12-20', 45, null),
  ('Copenhagen Plank', 'lower_body', array['adductors']::text[], array['obliques']::text[], array['bodyweight', 'bench']::text[], 'Side plank with the top leg on a bench
Lift the hips and hold', 'strength', 3, null, 60, 20),
  ('Crunch', 'core', array['abs']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie on your back, knees bent
Curl the shoulders off the floor
Lower slowly', 'hypertrophy', 3, '15-20', 45, null),
  ('Cable Crunch', 'core', array['abs']::text[], '{}'::text[], array['cable']::text[], 'Kneel facing a high pulley, rope at the head
Crunch down by flexing the spine
Return slowly', 'hypertrophy', 3, '12-15', 60, null),
  ('Hanging Leg Raise', 'core', array['abs']::text[], array['obliques']::text[], array['pull_up_bar']::text[], 'Hang from the bar
Raise straight legs to hip height or higher
Lower without swinging', 'strength', 3, '8-12', 60, null),
  ('Hanging Knee Raise', 'core', array['abs']::text[], '{}'::text[], array['pull_up_bar']::text[], 'Hang from the bar
Pull the knees to the chest
Lower under control', 'strength', 3, '10-15', 60, null),
  ('Lying Leg Raise', 'core', array['abs']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie flat, lower back pressed down
Raise straight legs to vertical
Lower slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Plank', 'core', array['abs']::text[], array['obliques', 'shoulders']::text[], array['bodyweight']::text[], 'Forearms under the shoulders
Hold a straight line from head to heels', 'strength', 3, null, 45, 45),
  ('Ab Wheel Rollout', 'core', array['abs']::text[], array['lats']::text[], array['other']::text[], 'Kneel holding the wheel
Roll forward keeping the core tight
Pull back to the start', 'strength', 3, '8-12', 60, null),
  ('Decline Sit-Up', 'core', array['abs']::text[], '{}'::text[], array['bench']::text[], 'Secure the feet on a decline bench
Sit all the way up
Lower slowly', 'hypertrophy', 3, '10-15', 60, null),
  ('Reverse Crunch', 'core', array['abs']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie on your back, knees bent
Curl the hips off the floor toward the chest
Lower slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Dead Bug', 'core', array['abs']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie on your back, arms and knees up
Extend the opposite arm and leg
Return and switch sides', 'strength', 3, '10-12', 45, null),
  ('Hollow Body Hold', 'core', array['abs']::text[], '{}'::text[], array['bodyweight']::text[], 'Lie on your back, lower back pressed down
Lift the arms and legs and hold', 'strength', 3, null, 45, 30),
  ('Mountain Climbers', 'core', array['abs']::text[], array['shoulders']::text[], array['bodyweight']::text[], 'Start in a high plank
Drive the knees toward the chest alternately', 'hiit', 3, null, 45, 30),
  ('Russian Twist', 'core', array['obliques']::text[], array['abs']::text[], array['bodyweight', 'medicine_ball']::text[], 'Sit leaning back, feet up
Rotate side to side', 'hypertrophy', 3, '16-20', 45, null),
  ('Side Plank', 'core', array['obliques']::text[], array['abs']::text[], array['bodyweight']::text[], 'Forearm under the shoulder, body straight
Lift the hips and hold', 'strength', 3, null, 45, 30),
  ('Cable Woodchopper', 'core', array['obliques']::text[], array['abs']::text[], array['cable']::text[], 'Pulley high, both hands on the handle
Rotate and pull diagonally across the body
Return slowly', 'hypertrophy', 3, '10-12', 60, null),
  ('Pallof Press', 'core', array['obliques']::text[], array['abs']::text[], array['cable']::text[], 'Stand side-on to the pulley at chest height
Press the handle straight out and resist rotation
Return to the chest', 'strength', 3, '10-12', 60, null),
  ('Bicycle Crunch', 'core', array['obliques']::text[], array['abs']::text[], array['bodyweight']::text[], 'Lie on your back, hands by the head
Bring the elbow toward the opposite knee
Alternate sides', 'hypertrophy', 3, '16-20', 45, null),
  ('Suitcase Carry', 'core', array['obliques']::text[], array['forearms', 'traps']::text[], array['dumbbell', 'kettlebell']::text[], 'Hold a heavy weight in one hand
Walk tall without leaning', 'strength', 3, null, 60, 40),
  ('Back Extension / Hyperextension', 'core', array['lower_back']::text[], array['glutes', 'hamstrings']::text[], array['machine']::text[], 'Hips on the pad, feet secured
Lower the torso
Raise until the body is straight', 'hypertrophy', 3, '12-15', 60, null),
  ('Superman', 'core', array['lower_back']::text[], array['glutes']::text[], array['bodyweight']::text[], 'Lie face down, arms overhead
Lift the arms and legs together
Lower slowly', 'hypertrophy', 3, '12-15', 45, null),
  ('Bird Dog', 'core', array['lower_back']::text[], array['abs', 'glutes']::text[], array['bodyweight']::text[], 'On hands and knees
Extend the opposite arm and leg
Return and switch sides', 'strength', 3, '10-12', 45, null),
  ('Reverse Hyperextension', 'core', array['lower_back']::text[], array['glutes', 'hamstrings']::text[], array['machine']::text[], 'Lie face down on the machine, legs hanging
Raise the legs to hip height
Lower under control', 'hypertrophy', 3, '12-15', 60, null),
  ('Clean', 'full_body', array['full_body']::text[], array['quads', 'glutes', 'traps']::text[], array['barbell']::text[], 'Start like a deadlift
Extend explosively and pull under the bar
Catch it on the front shoulders', 'olympic_lifting', 5, '2-3', 120, null),
  ('Power Clean', 'full_body', array['full_body']::text[], array['quads', 'glutes', 'traps']::text[], array['barbell']::text[], 'Start like a deadlift
Extend explosively
Catch the bar in a quarter squat', 'olympic_lifting', 5, '2-3', 120, null),
  ('Clean and Press', 'full_body', array['full_body']::text[], array['shoulders', 'quads']::text[], array['barbell']::text[], 'Clean the bar to the shoulders
Press it overhead
Lower to the floor under control', 'olympic_lifting', 4, '3-5', 120, null),
  ('Snatch', 'full_body', array['full_body']::text[], array['shoulders', 'quads', 'traps']::text[], array['barbell']::text[], 'Wide grip, start like a deadlift
Extend explosively
Catch the bar overhead in a squat', 'olympic_lifting', 5, '1-3', 150, null),
  ('Hang Clean', 'full_body', array['full_body']::text[], array['traps', 'quads']::text[], array['barbell']::text[], 'Start standing with the bar at the thighs
Dip and extend explosively
Catch on the front shoulders', 'olympic_lifting', 4, '3-5', 120, null),
  ('Thruster', 'full_body', array['full_body']::text[], array['quads', 'shoulders']::text[], array['barbell', 'dumbbell']::text[], 'Front squat with the weight at the shoulders
Drive up and press overhead in one motion
Lower back to the shoulders', 'hiit', 4, '8-10', 90, null),
  ('Kettlebell Swing', 'full_body', array['full_body']::text[], array['glutes', 'hamstrings']::text[], array['kettlebell']::text[], 'Hinge and hike the kettlebell back
Snap the hips forward to swing to chest height
Let it fall back into the hinge', 'hiit', 4, '15-20', 60, null),
  ('Burpee', 'full_body', array['full_body']::text[], array['chest', 'quads']::text[], array['bodyweight']::text[], 'Drop to a push-up position
Jump the feet back in
Jump up with the arms overhead', 'hiit', 3, '10-15', 60, null),
  ('Turkish Get-Up', 'full_body', array['full_body']::text[], array['shoulders', 'abs']::text[], array['kettlebell']::text[], 'Lie down holding the weight overhead
Rise to standing step by step, arm locked
Reverse back to the floor', 'strength', 3, '2-3', 90, null),
  ('Man Maker', 'full_body', array['full_body']::text[], array['chest', 'shoulders', 'back']::text[], array['dumbbell']::text[], 'Push-up with hands on the dumbbells
Row each side, jump in and clean
Press overhead', 'hiit', 3, '6-10', 90, null),
  ('Sled Push', 'full_body', array['full_body']::text[], array['quads', 'glutes']::text[], array['other']::text[], 'Lean into the sled with the arms extended
Drive with short powerful steps', 'hiit', 4, null, 90, 30),
  ('Sled Pull', 'full_body', array['full_body']::text[], array['hamstrings', 'back']::text[], array['other']::text[], 'Hold the straps facing the sled
Walk backwards pulling the sled', 'hiit', 4, null, 90, 30),
  ('Medicine Ball Slam', 'full_body', array['full_body']::text[], array['abs', 'shoulders']::text[], array['medicine_ball']::text[], 'Lift the ball overhead
Slam it to the floor with force
Catch and repeat', 'hiit', 3, '10-15', 60, null),
  ('Treadmill Run', 'cardio', array['cardio']::text[], '{}'::text[], array['cardio_machine']::text[], 'Warm up for a few minutes
Run at the target pace', 'cardio', 1, null, 0, 1200),
  ('Treadmill Incline Walk', 'cardio', array['cardio']::text[], array['glutes', 'calves']::text[], array['cardio_machine']::text[], 'Set a steep incline
Walk briskly without holding the rails', 'cardio', 1, null, 0, 1200),
  ('Stationary Bike', 'cardio', array['cardio']::text[], array['quads']::text[], array['cardio_machine']::text[], 'Set the seat to hip height
Ride at the target effort', 'cardio', 1, null, 0, 1200),
  ('Rowing Machine', 'cardio', array['cardio']::text[], array['back', 'quads']::text[], array['cardio_machine']::text[], 'Drive with the legs, then lean back and pull
Return arms, body, then legs', 'cardio', 1, null, 0, 900),
  ('Elliptical', 'cardio', array['cardio']::text[], '{}'::text[], array['cardio_machine']::text[], 'Stand tall on the pedals
Move at a steady target effort', 'cardio', 1, null, 0, 1200),
  ('Stair Climber', 'cardio', array['cardio']::text[], array['glutes', 'quads']::text[], array['cardio_machine']::text[], 'Stand tall, light hands on the rails
Climb at a steady pace', 'cardio', 1, null, 0, 900),
  ('Jump Rope', 'cardio', array['cardio']::text[], array['calves']::text[], array['other']::text[], 'Small jumps on the balls of the feet
Turn the rope with the wrists', 'cardio', 5, null, 45, 60),
  ('Assault Bike', 'cardio', array['cardio']::text[], array['full_body']::text[], array['cardio_machine']::text[], 'Push and pull the handles while pedalling
Go hard for the interval', 'hiit', 6, null, 60, 30),
  ('Battle Ropes', 'cardio', array['cardio']::text[], array['shoulders']::text[], array['other']::text[], 'Half squat holding the rope ends
Make fast alternating waves', 'hiit', 5, null, 45, 30),
  ('Jumping Jacks', 'cardio', array['cardio']::text[], '{}'::text[], array['bodyweight']::text[], 'Jump the feet out while raising the arms
Jump back in', 'cardio', 3, null, 30, 45),
  ('Box Jumps', 'cardio', array['cardio']::text[], array['quads', 'glutes']::text[], array['other']::text[], 'Stand facing the box
Swing the arms and jump onto it
Step back down', 'plyometric', 4, '5-8', 90, null),
  ('HIIT Intervals', 'cardio', array['cardio']::text[], array['full_body']::text[], array['cardio_machine']::text[], 'Work at near-max effort for the interval
Recover during the rest', 'hiit', 8, null, 60, 30),
  ('Outdoor Run', 'cardio', array['cardio']::text[], '{}'::text[], array['bodyweight']::text[], 'Warm up with easy jogging
Run at the target pace', 'cardio', 1, null, 0, 1800),
  ('Hip Flexor Stretch', 'mobility', array['full_body']::text[], '{}'::text[], array['bodyweight']::text[], 'Half-kneeling, back knee down
Squeeze the glute and shift the hips forward
Hold, then switch sides', 'stretching', 2, null, 15, 45),
  ('Hamstring Stretch', 'mobility', array['hamstrings']::text[], '{}'::text[], array['bodyweight']::text[], 'Heel on a low surface, leg straight
Hinge forward from the hips
Hold, then switch sides', 'stretching', 2, null, 15, 45),
  ('Quad Stretch', 'mobility', array['quads']::text[], '{}'::text[], array['bodyweight']::text[], 'Stand tall and hold one ankle behind you
Pull the heel toward the glute
Hold, then switch sides', 'stretching', 2, null, 15, 45),
  ('Pigeon Stretch', 'mobility', array['glutes']::text[], '{}'::text[], array['bodyweight']::text[], 'Front shin across the body, back leg long
Fold forward over the front leg
Hold, then switch sides', 'stretching', 2, null, 15, 60),
  ('Cat-Cow', 'mobility', array['lower_back']::text[], '{}'::text[], array['bodyweight']::text[], 'On hands and knees
Round the back up, then let it sag
Move slowly with the breath', 'mobility', 2, '8-10', 15, null),
  ('World''s Greatest Stretch', 'mobility', array['full_body']::text[], '{}'::text[], array['bodyweight']::text[], 'Step into a deep lunge, hand inside the front foot
Rotate the other arm to the ceiling
Switch sides', 'mobility', 2, '5-6', 15, null),
  ('Chest Doorway Stretch', 'mobility', array['chest']::text[], '{}'::text[], array['bodyweight']::text[], 'Forearm on a door frame
Step through until you feel a stretch
Hold, then switch sides', 'stretching', 2, null, 15, 45),
  ('Shoulder Dislocates', 'mobility', array['shoulders']::text[], '{}'::text[], array['resistance_band']::text[], 'Hold a band or stick wide
Raise it over the head and behind the body
Return to the front', 'mobility', 2, '10-12', 15, null),
  ('Thoracic Rotation', 'mobility', array['back']::text[], '{}'::text[], array['bodyweight']::text[], 'Side-lying, knees bent, arms together
Open the top arm across to the other side
Return slowly', 'mobility', 2, '8-10', 15, null),
  ('Child''s Pose', 'mobility', array['lower_back']::text[], array['lats']::text[], array['bodyweight']::text[], 'Kneel and sit back on the heels
Reach the arms forward and breathe', 'stretching', 2, null, 15, 60),
  ('90/90 Hip Switch', 'mobility', array['glutes']::text[], '{}'::text[], array['bodyweight']::text[], 'Sit with both knees bent at 90°
Rotate both knees to the other side
Keep the chest tall', 'mobility', 2, '8-10', 15, null),
  ('Foam Rolling – Quads', 'mobility', array['quads']::text[], '{}'::text[], array['foam_roller']::text[], 'Lie face down on the roller
Roll slowly from hip to knee', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – Hamstrings', 'mobility', array['hamstrings']::text[], '{}'::text[], array['foam_roller']::text[], 'Sit with the roller under the thighs
Roll slowly from glutes to knees', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – Glutes', 'mobility', array['glutes']::text[], '{}'::text[], array['foam_roller']::text[], 'Sit on the roller, ankle crossed over the knee
Roll slowly over the glute', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – Calves', 'mobility', array['calves']::text[], '{}'::text[], array['foam_roller']::text[], 'Roller under the calves
Roll slowly from ankle to knee', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – Upper Back', 'mobility', array['back']::text[], '{}'::text[], array['foam_roller']::text[], 'Roller across the upper back, hands behind the head
Roll slowly between the shoulder blades', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – Lats', 'mobility', array['lats']::text[], '{}'::text[], array['foam_roller']::text[], 'Lie on your side, roller under the armpit
Roll slowly down the side of the back', 'mobility', 1, null, 0, 60),
  ('Foam Rolling – IT Band / Outer Thigh', 'mobility', array['abductors']::text[], '{}'::text[], array['foam_roller']::text[], 'Lie on your side, roller under the outer thigh
Roll slowly from hip to knee', 'mobility', 1, null, 0, 60)
) as v(name, body_region, primary_muscles, secondary_muscles, equipment_list, instructions,
       exercise_type, default_sets, default_reps, default_rest_seconds, default_duration_seconds)
where not exists (
  select 1 from public.exercises e where e.is_global and lower(e.name) = lower(v.name)
);
