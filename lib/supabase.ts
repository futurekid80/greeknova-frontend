import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ovadytserwakjdiefehn.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92YWR5dHNlcndha2pkaWVmZWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTExOTUsImV4cCI6MjA5MzM2NzE5NX0.c398tzJBXcu-p2Z-mngyu0-kcjZqxMkXZyGYxbOGY9Y'

export const supabase = createClient(supabaseUrl, supabaseKey)
