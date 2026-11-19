# Exercise IDs are readable text, not UUIDs

`exercises.id` is a `text` primary key. Seeded exercises keep their free-exercise-db ID (for example `Barbell_Bench_Press_-_Medium_Grip`), and custom exercises use `custom:<slug>`. Claude picks exercises by ID when it generates splits, and it gets readable IDs wrong far less often than UUIDs. Code still checks that every ID exists. Changing the key type later would mean changing every table that references an exercise, so this is recorded.
