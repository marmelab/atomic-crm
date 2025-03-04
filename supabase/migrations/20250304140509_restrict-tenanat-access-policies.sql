-- SELECT Policies
CREATE POLICY "Tenant-based select"
ON contacts
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based select"
ON companies
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based select"
ON tags
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based select"
ON tasks
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based select"
ON sales
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based select"
ON deals
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based select"
ON "dealNotes"
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based select"
ON "contactNotes"
FOR SELECT
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

-- INSERT Policies
CREATE POLICY "Tenant-based insert"
ON contacts
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based insert"
ON companies
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based insert"
ON tags
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based insert"
ON tasks
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based insert"
ON sales
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based insert"
ON deals
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based insert"
ON "dealNotes"
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based insert"
ON "contactNotes"
FOR INSERT
WITH CHECK (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

-- UPDATE Policies
CREATE POLICY "Tenant-based update"
ON contacts
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based update"
ON companies
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based update"
ON tags
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based update"
ON tasks
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based update"
ON sales
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based update"
ON deals
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based update"
ON "dealNotes"
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based update"
ON "contactNotes"
FOR UPDATE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

-- DELETE Policies
CREATE POLICY "Tenant-based delete"
ON contacts
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based delete"
ON companies
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based delete"
ON tags
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based delete"
ON tasks
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based delete"
ON sales
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);

CREATE POLICY "Tenant-based delete"
ON deals
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based delete"
ON "dealNotes"
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);
CREATE POLICY "Tenant-based delete"
ON "contactNotes"
FOR DELETE
USING (
    tenant_id = ((auth.jwt() -> 'user_metadata')::jsonb ->> 'tenant_id')::uuid
);


