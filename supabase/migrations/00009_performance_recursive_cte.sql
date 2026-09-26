-- =============================================================================
-- Migration 00009: Performance Optimizations — Recursive CTEs & Batch Helpers
-- =============================================================================
-- Replaces N+1 recursive JS loops with single-query PostgreSQL recursive CTEs.
-- =============================================================================

-- 1. get_all_descendant_folder_ids(root_id)
--    Returns ALL descendant folder IDs regardless of status.
--    Used by permanent-delete.
CREATE OR REPLACE FUNCTION get_all_descendant_folder_ids(root_id UUID)
RETURNS TABLE(id UUID)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE tree AS (
    SELECT f.id FROM folders f WHERE f.parent_id = root_id
    UNION ALL
    SELECT f.id FROM folders f INNER JOIN tree t ON f.parent_id = t.id
  )
  SELECT t.id FROM tree t;
$$;

-- 2. get_descendant_folder_ids_by_status(root_id, status_filter)
--    Returns descendant folder IDs filtered by a given status.
--    Used by trash-restore (status = 'trash') and soft-delete (status = 'active').
CREATE OR REPLACE FUNCTION get_descendant_folder_ids_by_status(
  root_id UUID,
  status_filter TEXT
)
RETURNS TABLE(id UUID)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE tree AS (
    SELECT f.id FROM folders f WHERE f.parent_id = root_id AND f.status = status_filter::content_status
    UNION ALL
    SELECT f.id FROM folders f INNER JOIN tree t ON f.parent_id = t.id WHERE f.status = status_filter::content_status
  )
  SELECT t.id FROM tree t;
$$;
