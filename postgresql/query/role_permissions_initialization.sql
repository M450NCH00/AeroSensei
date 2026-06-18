CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(50) PRIMARY KEY,

    -- Viewing Permissions
    can_view_graph BOOLEAN DEFAULT FALSE,
    can_view_registry BOOLEAN DEFAULT FALSE,

    -- Editing Permissions
    can_edit_sensor BOOLEAN DEFAULT FALSE,
    can_edit_metadata BOOLEAN DEFAULT FALSE,

    -- Administrative Permissions
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_delete_records BOOLEAN DEFAULT FALSE,

    -- Sensor Management Permissions
    can_add_sensors BOOLEAN DEFAULT TRUE,
    can_delete_sensors BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert standard default roles
INSERT INTO role_permissions (
    role_name,
    can_view_graph,
    can_view_registry,
    can_edit_sensor,
    can_edit_metadata,
    can_manage_users,
    can_delete_records,
    can_add_sensors,
    can_delete_sensors
)
VALUES
    ('Government', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('Company', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE)
ON CONFLICT (role_name) DO NOTHING;