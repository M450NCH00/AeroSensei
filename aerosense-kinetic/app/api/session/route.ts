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
    const decodedToken = jwtDecode(tokenCookie.value);
    return NextResponse.json(decodedToken);
  } catch (error) {
    return NextResponse.json({ error: "Failed to decode token" }, { status: 400 });
  }
}