INSERT INTO settings (key, value) VALUES ('mp_refresh_token', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_user_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_token_expires_at', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_oauth_state', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_oauth_state_expires_at', '') ON CONFLICT (key) DO NOTHING;
