import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseProjectUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseProjectUrl || !supabaseServiceKey) {
  throw new Error("Supabase Project URL/ Service Key not found in .env");
}

export const supabase = createClient(supabaseProjectUrl, supabaseServiceKey);