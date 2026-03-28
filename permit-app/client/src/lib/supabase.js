import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://reowtzedjflwmlptupbk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
