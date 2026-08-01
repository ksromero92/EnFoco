-- pgTAP test: verify RPC execute permissions
BEGIN;
SELECT plan(14);

-- anon should NOT have EXECUTE on protected RPCs
SELECT ok(
  NOT has_function_privilege('anon', 'public.start_new_cycle(text, date, integer)', 'EXECUTE'),
  'anon cannot execute start_new_cycle'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.archive_cycle(uuid)', 'EXECUTE'),
  'anon cannot execute archive_cycle'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.copy_cycle_routines(uuid, uuid)', 'EXECUTE'),
  'anon cannot execute copy_cycle_routines'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.ensure_task_occurrences(date, date)', 'EXECUTE'),
  'anon cannot execute ensure_task_occurrences'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.reorder_task_occurrences(date, uuid[])', 'EXECUTE'),
  'anon cannot execute reorder_task_occurrences'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.move_task_occurrence(uuid, date)', 'EXECUTE'),
  'anon cannot execute move_task_occurrence'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.delete_task_occurrence_for_day(uuid)', 'EXECUTE'),
  'anon cannot execute delete_task_occurrence_for_day'
);

-- authenticated SHOULD have EXECUTE
SELECT ok(
  has_function_privilege('authenticated', 'public.start_new_cycle(text, date, integer)', 'EXECUTE'),
  'authenticated can execute start_new_cycle'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.archive_cycle(uuid)', 'EXECUTE'),
  'authenticated can execute archive_cycle'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.copy_cycle_routines(uuid, uuid)', 'EXECUTE'),
  'authenticated can execute copy_cycle_routines'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.ensure_task_occurrences(date, date)', 'EXECUTE'),
  'authenticated can execute ensure_task_occurrences'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.reorder_task_occurrences(date, uuid[])', 'EXECUTE'),
  'authenticated can execute reorder_task_occurrences'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.move_task_occurrence(uuid, date)', 'EXECUTE'),
  'authenticated can execute move_task_occurrence'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.delete_task_occurrence_for_day(uuid)', 'EXECUTE'),
  'authenticated can execute delete_task_occurrence_for_day'
);

SELECT * FROM finish();
ROLLBACK;
