-- Function to automatically mark expired goals as 'Fracasada'
CREATE OR REPLACE FUNCTION update_expired_goals()
RETURNS void AS $$
BEGIN
  UPDATE "CRM_Metas"
  SET status = 'Fracasada',
      updated_at = NOW()
  WHERE due_date < CURRENT_DATE 
  AND status = 'En Proceso'
  AND is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;
