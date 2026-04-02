'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function usePermissions() {
  const [permisos, setPermisos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [rolNombre, setRolNombre] = useState(null);
  const [usuarioId, setUsuarioId] = useState(null);

  useEffect(() => {
    cargarPermisos();
  }, []);

  async function cargarPermisos() {
    try {
      setCargando(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCargando(false);
        return;
      }
      
      setUsuarioId(user.id);
      
      // Obtener rol del usuario
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('rol_id, roles(nombre)')
        .eq('id', user.id)
        .single();

      if (!usuarioData) {
        setCargando(false);
        return;
      }

      const rolId = usuarioData.rol_id;
      const rol = usuarioData.roles?.nombre;
      setRolNombre(rol);

      // Obtener permisos del rol
      const { data: permisosData } = await supabase
        .from('permisos')
        .select('*')
        .eq('rol_id', rolId);

      const permisosMap = {};
      permisosData?.forEach(p => {
        permisosMap[p.modulo] = {
          ver: p.ver,
          crear: p.crear,
          editar: p.editar,
          eliminar: p.eliminar
        };
      });

      // Si es administrador, asegurar todos los permisos
      if (rol === 'Administrador') {
        const todosModulos = ['dashboard', 'menu', 'pedidos', 'ventas', 'inventario', 'recetas', 'pos', 'caja', 'usuarios', 'configuracion'];
        todosModulos.forEach(modulo => {
          if (!permisosMap[modulo]) {
            permisosMap[modulo] = { ver: true, crear: true, editar: true, eliminar: true };
          } else {
            permisosMap[modulo] = { ...permisosMap[modulo], ver: true, crear: true, editar: true, eliminar: true };
          }
        });
      }

      setPermisos(permisosMap);
      
    } catch (error) {
      console.error('Error cargando permisos:', error);
    } finally {
      setCargando(false);
    }
  }

  const puedeVer = (modulo) => {
    return permisos[modulo]?.ver || false;
  };

  const puedeCrear = (modulo) => {
    return permisos[modulo]?.crear || false;
  };

  const puedeEditar = (modulo) => {
    return permisos[modulo]?.editar || false;
  };

  const puedeEliminar = (modulo) => {
    return permisos[modulo]?.eliminar || false;
  };

  return { 
    permisos, 
    puedeVer, 
    puedeCrear, 
    puedeEditar, 
    puedeEliminar, 
    cargando, 
    rolNombre,
    usuarioId 
  };
}