-- Task 11b's G13 (a heuristic scan for columns named like PII/internal
-- data -- %email%, %note%, etc., see supabase/seed.sql relation_columns())
-- fires on two existing columns that predate this task and carry no
-- @sensitive/@public-ok marker at all. Neither migration that defines them
-- (0003_profiles.sql, 0006_site.sql) may be edited by this task, so the
-- annotation is added here instead -- the same "new migration, not an edit
-- to the original file" pattern 0010_function_grants.sql already uses.
--
-- public.profiles.email: a staff account's own email address, readable by
-- all three authenticated roles (profiles_select_authenticated has no role
-- restriction) and never reachable by anon -- profiles has no public view
-- and never will. Marked @sensitive rather than left uncommented so a
-- later session cannot add a "profiles_public" view for some future
-- innovator-profile feature and carry this column into it by habit,
-- reasoning "it has no comment, so it must be fine."
comment on column public.profiles.email is
  '@sensitive Staff account email address; never surfaced on the public site.';

-- public.compute_metrics.sub_note: the opposite case. It IS deliberately
-- public -- 0009_public_views.sql's compute_metrics_public view projects it
-- as-is, for the home page compute rail's footnote text (PRD 4.10).
-- Marking it @sensitive would be actively wrong: G7 (no *_public view may
-- depend on an @sensitive column) would then flag the one view that is
-- supposed to show it. @public-ok records that the omission was noticed
-- and is intentional, not an oversight the heuristic should keep flagging.
comment on column public.compute_metrics.sub_note is
  '@public-ok Editorial footnote text for a home page compute-rail stat; deliberately shown on compute_metrics_public (PRD 4.10).';
