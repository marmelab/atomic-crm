CREATE OR REPLACE FUNCTION set_sales_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_sales_id_trigger
BEFORE INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();

CREATE TRIGGER set_contact_sales_id_trigger
BEFORE INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();

CREATE TRIGGER set_contact_notes_sales_id_trigger
BEFORE INSERT ON "contactNotes"
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();

CREATE TRIGGER set_company_sales_id_trigger
BEFORE INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();

CREATE TRIGGER set_deal_sales_id_trigger
BEFORE INSERT ON deals
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();

CREATE TRIGGER set_deal_notes_sales_id_trigger
BEFORE INSERT ON "dealNotes"
FOR EACH ROW
EXECUTE FUNCTION set_sales_id_default();