'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function usePermissions() {
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [rolNombre, setRolNombre] = useState('');

  useEffect(() => {
    obtenerPermisos();
  }, []);

  async function obtenerPermisos() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setCargando(false);
        return;
      }

      // Intentar obtener de localStorage primero
      const storedRole = localStorage.getItem('userRole');
      if (storedRole) {
        setRolNombre(storedRole);
      }

      // Obtener de la base de datos
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('*, roles(*)')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo usuario:', error);
      }

      if (usuario?.roles) {
        setRolNombre(usuario.roles.nombre);
        setRol(usuario.roles);
        
        // Obtener permisos
        const { data: permisosData } = await supabase
          .from('permisos')
          .select('*')
          .eq('rol_id', usuario.rol_id);
        
        setPermisos(permisosData || []);
      }

    } catch (error) {
      console.error('Error en usePermissions:', error);
    } finally {
      setCargando(false);
    }
  }

  function puedeVer(modulo) {
    if (rolNombre === 'Administrador') return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.ver || false;
  }

  function puedeCrear(modulo) {
    if (rolNombre === 'Administrador') return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.crear || false;
  }

  function puedeEditar(modulo) {
    if (rolNombre === 'Administrador') return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.editar || false;
  }

  function puedeEliminar(modulo) {
    if (rolNombre === 'Administrador') return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.eliminar || false;
  }

  return {
    cargando,
    rol,
    rolNombre,
    permisos,
    puedeVer,
    puedeCrear,
    puedeEditar,
    puedeEliminar
  };
}