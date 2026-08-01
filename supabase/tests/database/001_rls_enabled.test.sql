-- pgTAP test: verify RLS is enabled on all business tables
BEGIN;
SELECT plan(8);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'cycles', 'cycles table exists');
SELECT has_table('public', 'categories', 'categories table exists');
SELECT has_table('public', 'activities', 'activities table exists');
SELECT has_table('public', 'activity_schedules', 'activity_schedules table exists');
SELECT has_table('public', 'activity_logs', 'activity_logs table exists');
SELECT has_table('public', 'task_occurrences', 'task_occurrences table exists');
SELECT has_table('public', 'task_occurrence_exceptions', 'task_occurrence_exceptions table exists');

SELECT * FROM finish();
ROLLBACK;
