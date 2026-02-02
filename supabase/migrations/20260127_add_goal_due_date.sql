-- Add due_date to CRM_Metas
ALTER TABLE "CRM_Metas" 
ADD COLUMN due_date DATE;

-- Optional: Index on due_date if we plan to filter/sort by it often
CREATE INDEX idx_crm_metas_due_date ON "CRM_Metas"(due_date);
