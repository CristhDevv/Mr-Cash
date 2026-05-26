/**
 * Translates Supabase Auth error messages to Spanish.
 */
export function translateSupabaseError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos. Intenta de nuevo.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.'
  }
  if (lower.includes('user already registered') || lower.includes('email already in use') || lower.includes('already registered')) {
    return 'Ya existe una cuenta con este correo electrónico.'
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (lower.includes('invalid email')) {
    return 'El correo electrónico no tiene un formato válido.'
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.'
  }
  if (lower.includes('token has expired') || lower.includes('token is invalid')) {
    return 'El enlace ha expirado. Solicita uno nuevo.'
  }
  if (lower.includes('weak password')) {
    return 'La contraseña es muy débil. Usa al menos 6 caracteres con letras y números.'
  }
  if (lower.includes('signup disabled')) {
    return 'El registro está deshabilitado temporalmente. Intenta más tarde.'
  }

  // Fallback
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}
