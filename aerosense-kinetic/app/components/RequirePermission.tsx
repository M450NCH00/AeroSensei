"use client";

import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode; // Optional: what to show if they are blocked
}

export default function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = useAuth();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}