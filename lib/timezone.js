// lib/timezone.js

/**
 * Obtiene la fecha y hora actual en la zona horaria de Colombia
 * @returns {Date} Fecha actual en Colombia
 */
export const getColombiaTime = () => {
  const ahora = new Date();
  const colombiaStr = ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' });
  return new Date(colombiaStr);
};

/**
 * Obtiene la fecha en formato YYYY-MM-DD para Colombia
 * @returns {string} Fecha en formato ISO (YYYY-MM-DD)
 */
export const getFechaColombiaStr = () => {
  const fecha = getColombiaTime();
  return fecha.toISOString().split('T')[0];
};

/**
 * Obtiene la fecha y hora en formato ISO manteniendo la hora local de Colombia
 * Esto evita que Supabase haga conversión a UTC
 * @returns {string} Fecha en formato ISO pero sin conversión UTC
 */
export const getColombiaISOString = () => {
  const fecha = getColombiaTime();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  const hours = String(fecha.getHours()).padStart(2, '0');
  const minutes = String(fecha.getMinutes()).padStart(2, '0');
  const seconds = String(fecha.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Formatea una fecha para mostrar en la UI
 * @param {string|Date} fecha - Fecha a formatear
 * @returns {string} Fecha formateada (ej: 15/04/2024 3:45 PM)
 */
export const formatFechaColombia = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  return date.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
};

/**
 * Formatea solo la fecha (sin hora)
 * @param {string|Date} fecha - Fecha a formatear
 * @returns {string} Fecha formateada (ej: 15/04/2024)
 */
export const formatFechaOnly = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};

/**
 * Formatea solo la hora
 * @param {string|Date} fecha - Fecha a formatear
 * @returns {string} Hora formateada (ej: 3:45 PM)
 */
export const formatHoraOnly = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
};