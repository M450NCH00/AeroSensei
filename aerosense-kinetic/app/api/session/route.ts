// src/app/api/session/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

export async function GET() {
  const cookieStore = await cookies();
  
  // CHANGED: Look specifically for the "accessToken" cookie
  const tokenCookie = cookieStore.get("accessToken"); 

  if (!tokenCookie || !tokenCookie.value) {
    return NextResponse.json({ error: "No secure cookie found" }, { status: 401 });
  }

  try {
    // The backend JWT carries the email in `sub` and roles in `roles` (array).
    // Normalize to the { email, role, permissions } shape the app's User type
    // and useAuth expect, tolerating either claim name for forward/back compat.
    const decodedToken = jwtDecode<{
      sub?: string;
      email?: string;
      roles?: string | string[];
      role?: string | string[];
      permissions?: string[];
    }>(tokenCookie.value);

    return NextResponse.json({
      ...decodedToken,
      email: decodedToken.email ?? decodedToken.sub,
      role: decodedToken.role ?? decodedToken.roles,
      permissions: decodedToken.permissions ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to decode token" }, { status: 400 });
  }
}