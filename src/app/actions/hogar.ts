'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// generarCodigoInvitacion
//
// Generates a 6-character uppercase alphanumeric code on the server using
// Node's crypto module (cryptographically secure), persists it to the hogares
// table with a 24-hour expiry, and returns it to the caller.
// The client never generates or mutates this code.
// ─────────────────────────────────────────────────────────────────────────────
export async function generarCodigoInvitacion(
  hogarId: string
): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const supabase = await createClient()

  // Verify the caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado' }

  // Verify the caller is an active admin of this hogar
  const { data: membership } = await supabase
    .from('hogar_miembros')
    .select('rol, estado')
    .eq('hogar_id', hogarId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.estado !== 'activo' || membership.rol !== 'admin') {
    return { error: 'No tienes permisos para generar un código de invitación' }
  }

  // Generate a 6-character uppercase alphanumeric code using crypto.randomBytes
  // randomBytes(4) gives 8 hex chars; we take the first 6 and uppercase them.
  const code = randomBytes(4).toString('hex').substring(0, 6).toUpperCase()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('hogares')
    .update({ codigo_invitacion: code, codigo_expira_at: expiresAt })
    .eq('id', hogarId)

  if (error) return { error: 'Error al guardar el código en la base de datos' }

  return { code, expiresAt }
}

// ─────────────────────────────────────────────────────────────────────────────
// unirseAlHogar
//
// All validation happens server-side:
//   1. User must be authenticated.
//   2. User must not already belong to a hogar (hogar_id in profiles).
//   3. The invite code must match an existing hogar.
//   4. The code must not be expired.
//   5. The user must not already be a member of that hogar.
//   6. On success, inserts into hogar_miembros and updates profiles.hogar_id.
// ─────────────────────────────────────────────────────────────────────────────
export async function unirseAlHogar(
  codigo: string
): Promise<{ hogarNombre: string } | { error: string }> {
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado' }

  const normalizedCode = codigo.trim().toUpperCase()

  if (normalizedCode.length !== 6) {
    return { error: 'El código debe tener exactamente 6 caracteres' }
  }

  // 2. Check user does not already have a hogar
  const { data: profile } = await supabase
    .from('profiles')
    .select('hogar_id')
    .eq('id', user.id)
    .single()

  if (profile?.hogar_id) {
    return { error: 'Ya perteneces a un hogar. Debes salir de él primero.' }
  }

  // 3. Look up the hogar by invite code
  const { data: hogares, error: fetchError } = await supabase
    .from('hogares')
    .select('id, nombre, codigo_expira_at')
    .eq('codigo_invitacion', normalizedCode)

  if (fetchError || !hogares || hogares.length === 0) {
    return { error: 'Código de invitación no válido' }
  }

  const hogar = hogares[0]

  // 4. Verify the code has not expired
  const isExpired =
    !hogar.codigo_expira_at ||
    new Date(hogar.codigo_expira_at).getTime() < Date.now()

  if (isExpired) {
    return { error: 'El código de invitación ha expirado. Pide al administrador que genere uno nuevo.' }
  }

  // 5. Check user is not already a member
  const { data: existingMember } = await supabase
    .from('hogar_miembros')
    .select('id')
    .eq('hogar_id', hogar.id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    return { error: 'Ya eres miembro de este hogar' }
  }

  // 6. Insert membership
  const { error: insertError } = await supabase
    .from('hogar_miembros')
    .insert({
      hogar_id: hogar.id,
      user_id: user.id,
      rol: 'miembro',
      estado: 'activo',
    })

  if (insertError) {
    return { error: 'Error al unirse al hogar. Intenta de nuevo.' }
  }

  // 7. Update user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ hogar_id: hogar.id })
    .eq('id', user.id)

  if (profileError) {
    return { error: 'Error al actualizar tu perfil.' }
  }

  return { hogarNombre: hogar.nombre }
}
