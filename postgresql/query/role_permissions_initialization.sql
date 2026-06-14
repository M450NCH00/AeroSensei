-- Create the Role Permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_name VARCHAR(50) PRIMARY KEY,       -- E.g., 'Admin', 'Viewer', 'Technician'
    
    -- Viewing Permissions
    can_view_graph BOOLEAN DEFAULT FALSE,
    can_view_registry BOOLEAN DEFAULT FALSE,
    
    -- Editing Permissions
    can_edit_sensor BOOLEAN DEFAULT FALSE,
    can_edit_metadata BOOLEAN DEFAULT FALSE,
    
    -- Administrative Permissions
    can_manage_users BOOLEAN DEFAULT FALSE,  -- "can give permission to other user"
    can_delete_records BOOLEAN DEFAULT FALSE,
    
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
    can_delete_records
) 
VALUES 
    -- Admins can do everything
    ('Government', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    
    -- Company can view data and edit their own sensors
    ('Company', TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
    
ON CONFLICT (role_name) DO NOTHING;