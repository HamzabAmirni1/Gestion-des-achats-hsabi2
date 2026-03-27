import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vgqrasazquaoqskrsryv.supabase.co'
const supabaseKey = 'sb_publishable_ug91i0ItCpe0ord5YKAaAg_wY4dMrQM'

export const supabase = createClient(supabaseUrl, supabaseKey)
