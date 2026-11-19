# AI Strength Coach

A personal coach for one lifter: it prescribes what to lift, sets what to eat, and reports progress, from logged sets, scale readings and Garmin recovery data.

## Programming

**Day template**:
A reusable, named list of exercises with a focus, such as Push A or Legs.
_Avoid_: Day group, workout template

**Split**:
The weekly order of day templates within a block, such as Push · Pull · Legs. It belongs to a block and doesn't exist on its own.
_Avoid_: Routine, program

**Block**:
A split run for a fixed number of weeks (12 by default) towards one goal, ending with a lighter week.
_Avoid_: Mesocycle, program, cycle

**Session**:
One day template due in a training week, scheduled for a date. You can move it to another day in the same week. It's the unit that today's plan and attendance are counted in.
_Avoid_: Workout, training day

**Skipped session**:
A session still not done when its training week's review runs.
_Avoid_: Missed workout

**Prescribed set**:
A set the coach tells you to do in a session: the exercise, a target rep range and a target load.
_Avoid_: Planned set, target set

**Logged set**:
A set you actually did, with the reps and load you performed, usually ticked off against a prescribed set.
_Avoid_: Completed set, performed set

**Calibration week**:
The first week an exercise is prescribed, with no target load. What you lift sets the starting load for the following week.
_Avoid_: Test week, baseline week

## Exercise library

**Exercise library**:
Every exercise the coach knows about: the shared public seed plus your own custom exercises. The coach may only prescribe exercises from it.
_Avoid_: Exercise database, catalogue

**Custom exercise**:
An exercise you added yourself, such as a machine only your gym has.
_Avoid_: User exercise

**Movement pattern**:
The kind of movement an exercise trains: horizontal push, vertical push, horizontal pull, vertical pull, squat, hinge, carry or core.
_Avoid_: Movement type, category

**Body region**:
Whether an exercise mainly loads the upper body or the lower body. It decides how big a load jump progression makes.
_Avoid_: Body part

## Time

**Training week**:
Monday to Sunday in the lifter's own time zone. Blocks, nutrition targets and weekly reviews all line up with it.
_Avoid_: Calendar week, ISO week

## Surfaces

**Published object**:
A finished, versioned answer that clients read as-is (today's plan, the week summary, progress, the latest briefing, the active block, the goal). Clients never work these figures out themselves.
_Avoid_: Endpoint, DTO, view model
