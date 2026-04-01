import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Estas variables SOLO se ejecutan en el servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request) {
  try {
    const { action, data } = await request.json()
    
    // Crear cliente admin solo en el servidor
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Crear nuevo usuario
    if (action === 'createUser') {
      const { email, password, userData } = data
      
      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userData
      })
      
      if (error) throw error
      
      return NextResponse.json({ success: true, user: authData.user })
    }
    
    // Cambiar contraseña
    if (action === 'updatePassword') {
      const { userId, password } = data
      
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password
      })
      
      if (error) throw error
      
      return NextResponse.json({ success: true })
    }
    
    // Eliminar usuario
    if (action === 'deleteUser') {
      const { userId } = data
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      
      if (error) throw error
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    
  } catch (error) {
    console.error('Error en API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}