import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
