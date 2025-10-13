-- opustrack_admin_setup.sql

-- 1. Create the admin role
CREATE ROLE opustrack_admin
  WITH LOGIN
       PASSWORD 'YourStrongP@ssw0rd'
       CREATEDB
       NOINHERIT;

-- 2. Change ownership of the database
ALTER DATABASE opustrack
  OWNER TO opustrack_admin;

-- 3. Connect into the opustrack database
\connect opustrack

-- 4. Grant ALL on all existing tables & sequences in public schema
GRANT ALL PRIVILEGES
  ON ALL TABLES IN SCHEMA public
  TO opustrack_admin;

GRANT ALL PRIVILEGES
  ON ALL SEQUENCES IN SCHEMA public
  TO opustrack_admin;

-- 5. Ensure future tables & sequences also grant to opustrack_admin
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO opustrack_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO opustrack_admin;