package com.aerosensei.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "role_permissions")
public class RolePermission {

    @Id
    private String roleName;

    private Boolean canViewGraph;
    private Boolean canViewRegistry;
    private Boolean canEditSensor;
    private Boolean canEditMetadata;
    private Boolean canManageUsers;
    private Boolean canDeleteRecords;
    private Boolean canAddSensors;
    private Boolean canDeleteSensors;

    // Getters and Setters for all fields...
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }

    public Boolean getCanViewGraph() { return canViewGraph; }
    public void setCanViewGraph(Boolean canViewGraph) { this.canViewGraph = canViewGraph; }

    public Boolean getCanViewRegistry() { return canViewRegistry; }
    public void setCanViewRegistry(Boolean canViewRegistry) { this.canViewRegistry = canViewRegistry; }

    public Boolean getCanEditSensor() { return canEditSensor; }
    public void setCanEditSensor(Boolean canEditSensor) { this.canEditSensor = canEditSensor; }

    public Boolean getCanEditMetadata() { return canEditMetadata; }
    public void setCanEditMetadata(Boolean canEditMetadata) { this.canEditMetadata = canEditMetadata; }

    public Boolean getCanManageUsers() { return canManageUsers; }
    public void setCanManageUsers(Boolean canManageUsers) { this.canManageUsers = canManageUsers; }

    public Boolean getCanDeleteRecords() { return canDeleteRecords; }
    public void setCanDeleteRecords(Boolean canDeleteRecords) { this.canDeleteRecords = canDeleteRecords; }

    public Boolean getCanAddSensors() { return canAddSensors; }
    public void setCanAddSensors(Boolean canAddSensors) { this.canAddSensors = canAddSensors; }

    public Boolean getCanDeleteSensors() { return canDeleteSensors; }
    public void setCanDeleteSensors(Boolean canDeleteSensors) { this.canDeleteSensors = canDeleteSensors; }
}