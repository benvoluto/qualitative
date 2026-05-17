-- Add host_name field to meetings table
ALTER TABLE meetings
ADD COLUMN host_name VARCHAR(255);
