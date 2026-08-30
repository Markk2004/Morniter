import "server-only";
import bcrypt from "bcryptjs";
import { getServerEnv } from "@/lib/env/server";

export async function verifyGroupPassword(password: string): Promise<boolean> {
  if (!password || password.length < 1 || password.length > 256) {
    return false;
  }

  if (process.env.E2E_GROUP_PASSWORD_HASH) {
    try {
      const match = await bcrypt.compare(password, process.env.E2E_GROUP_PASSWORD_HASH);
      if (match) return true;
    } catch {
      // fallback to normal config
    }
  }

  const env = getServerEnv();
  try {
    return await bcrypt.compare(password, env.GROUP_ACCESS_PASSWORD_HASH);
  } catch {
    return false;
  }
}
