-- Allow LOGIN/LOGOUT alongside the row-change actions, for the auth events
-- logged explicitly from src/app/actions/auth.ts (sign-in/out don't touch
-- any table row, so the generic audit_row() trigger never fires for them).
alter table audit_log drop constraint if exists audit_log_action_check;
alter table audit_log add constraint audit_log_action_check
    check (action in ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'));
