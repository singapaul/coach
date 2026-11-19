# Every owned row carries its own `user_id`, including child tables

Each table you own, including child tables like `day_template_exercises` and `prescribed_sets`, has `user_id uuid not null default auth.uid()` and one RLS policy, `user_id = auth.uid()`. It doesn't inherit ownership by joining to its parent. Storing the user ID more than once is deliberate: it keeps every policy identical, simple and fast to check. Don't "normalise" it away. The global `exercises` table is the exception: any logged-in user can read it, and only the owner of a custom exercise can write it.
