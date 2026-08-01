-- pgTAP test: verify SECURITY DEFINER functions have proper settings
BEGIN;
SELECT plan(8);

-- All critical RPC functions should be SECURITY DEFINER
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'start_new_cycle' AND pronamespace = 'public'::regnamespace),
  true,
  'start_new_cycle is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'archive_cycle' AND pronamespace = 'public'::regnamespace),
  true,
  'archive_cycle is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'copy_cycle_routines' AND pronamespace = 'public'::regnamespace),
  true,
  'copy_cycle_routines is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'ensure_task_occurrences' AND pronamespace = 'public'::regnamespace),
  true,
  'ensure_task_occurrences is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'reorder_task_occurrences' AND pronamespace = 'public'::regnamespace),
  true,
  'reorder_task_occurrences is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'move_task_occurrence' AND pronamespace = 'public'::regnamespace),
  true,
  'move_task_occurrence is SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'delete_task_occurrence_for_day' AND pronamespace = 'public'::regnamespace),
  true,
  'delete_task_occurrence_for_day is SECURITY DEFINER'
);

-- handle_updated_at should be SECURITY INVOKER (it runs in user context via trigger)
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'handle_updated_at' AND pronamespace = 'public'::regnamespace),
  false,
  'handle_updated_at is SECURITY INVOKER'
);

SELECT * FROM finish();
ROLLBACK;
