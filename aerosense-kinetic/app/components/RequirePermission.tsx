"use client";

import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  // Grab the raw 'user' object too so we can inspect it
  const { hasPermission, user } = useAuth();

  // 🕵️ THE X-RAY: Open your F12 Console to see this!
  console.log(`Checking if user has: "${permission}"`);
  console.log("Actual User Data from Context:", user);
  console.log("Did they pass the check?", hasPermission(permission));

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}