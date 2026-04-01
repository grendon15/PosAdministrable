'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function UsuariosPage() {
  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  const [vistaActiva, setVistaActiva] = useState('usuarios');
  const [usuarioActual, setUsuarioActual] = useState(null);
  
  // Permisos
  const { puedeVer, puedeCrear, puedeEditar, puedeEliminar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('usuarios');
  const puedeCrearUsuario = puedeCrear('usuarios');
  const puedeEditarUsuario = puedeEditar('usuarios');
  const puedeEliminarUsuario = puedeEliminar('usuarios');
  
  // Modales
  const [modalUsuario, setModalUsuario] = useState({ open: false, editing: null, data: { email: '', nombre: '', apellido: '', telefono: '', rol_id: '', password: '' } });
  const [modalPassword, setModalPassword] = useState({ open: false, usuario: null, nuevaPassword: '', confirmarPassword: '' });
  const [modalRol, setModalRol] = useState({ open: false, editing: null, data: { nombre: '', descripcion: '', nivel: 1, activo: true } });
  const [modalPermisos, setModalPermisos] = useState({ open: false, rol: null, permisosRol: [] });

  const modulosDisponibles = [
    { nombre: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { nombre: 'menu', label: 'Menú', icon: '📋' },
    { nombre: 'pedidos', label: 'Pedidos', icon: '📦' },
    { nombre: 'ventas', label: 'Ventas', icon: '💰' },
    { nombre: 'inventario', label: 'Inventario', icon: '📊' },
    { nombre: 'recetas', label: 'Recetas', icon: '👨‍🍳' },
    { nombre: 'pos', label: 'POS', icon: '🍽️' },
    { nombre: 'caja', label: 'Caja', icon: '💰' },
    { nombre: 'usuarios', label: 'Usuarios', icon: '👥' },
    { nombre: 'configuracion', label: 'Configuración', icon: '⚙️' }
  ];

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
      obtenerUsuarioActual();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function obtenerUsuarioActual() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*, roles(*)')
        .eq('id', user.id)
        .single();
      setUsuarioActual(usuario);
    }
  }

  async function cargarDatos() {
    setCargando(true);
    
    try {
      // Cargar todos los datos en paralelo para mejorar rendimiento
      const [usuariosRes, rolesRes, permisosRes] = await Promise.all([
        supabase.from('usuarios').select('*, roles(*)').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('nivel', { ascending: false }),
        supabase.from('permisos').select('*')
      ]);

      if (usuariosRes.error) throw usuariosRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (permisosRes.error) throw permisosRes.error;

      setUsuarios(usuariosRes.data || []);
      setRoles(rolesRes.data || []);
      setPermisos(permisosRes.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      mostrarNotificacion('Error al cargar datos', 'error');
    } finally {
      setCargando(false);
    }
  }

  async function guardarUsuario() {
    if (!puedeCrearUsuario && !modalUsuario.editing) {
      mostrarNotificacion('No tienes permisos para crear usuarios', 'error');
      return;
    }
    if (!puedeEditarUsuario && modalUsuario.editing) {
      mostrarNotificacion('No tienes permisos para editar usuarios', 'error');
      return;
    }
    
    const data = modalUsuario.data;
    
    if (!data.email.trim() || !data.rol_id) {
      mostrarNotificacion('Email y rol son requeridos', 'error');
      return;
    }
    
    try {
      if (modalUsuario.editing) {
        // Actualizar usuario existente
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            nombre: data.nombre,
            apellido: data.apellido,
            telefono: data.telefono,
            rol_id: parseInt(data.rol_id),
            updated_at: new Date().toISOString()
          })
          .eq('id', modalUsuario.editing.id);
        
        if (updateError) throw updateError;
        mostrarNotificacion('Usuario actualizado exitosamente', 'success');
        
      } else {
        // Crear nuevo usuario
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createUser',
            data: {
              email: data.email,
              password: data.password || '12345678',
              userData: {
                nombre: data.nombre || '',
                apellido: data.apellido || '',
                telefono: data.telefono || ''
              }
            }
          })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Crear perfil en tabla pública
        const { error: perfilError } = await supabase
          .from('usuarios')
          .insert({
            id: result.user.id,
            email: data.email,
            nombre: data.nombre,
            apellido: data.apellido,
            telefono: data.telefono,
            rol_id: parseInt(data.rol_id),
            activo: true
          });
        
        if (perfilError) throw perfilError;
        
        mostrarNotificacion('Usuario creado exitosamente', 'success');
      }
      
      setModalUsuario({ open: false, editing: null, data: { email: '', nombre: '', apellido: '', telefono: '', rol_id: '', password: '' } });
      cargarDatos();
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function cambiarPassword() {
    if (!puedeEditarUsuario) {
      mostrarNotificacion('No tienes permisos para cambiar contraseñas', 'error');
      return;
    }
    
    const { nuevaPassword, confirmarPassword, usuario } = modalPassword;
    
    if (!nuevaPassword || nuevaPassword.length < 6) {
      mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    
    if (nuevaPassword !== confirmarPassword) {
      mostrarNotificacion('Las contraseñas no coinciden', 'error');
      return;
    }
    
    try {
      if (usuario.id === usuarioActual?.id) {
        const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
        if (error) throw error;
        mostrarNotificacion('Contraseña actualizada exitosamente', 'success');
      } else {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updatePassword',
            data: { userId: usuario.id, password: nuevaPassword }
          })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        mostrarNotificacion(`Contraseña de ${usuario.email} actualizada`, 'success');
      }
      setModalPassword({ open: false, usuario: null, nuevaPassword: '', confirmarPassword: '' });
    } catch (error) {
      mostrarNotificacion('Error al cambiar contraseña: ' + error.message, 'error');
    }
  }

  async function toggleUsuarioActivo(id, activoActual, email) {
    if (!puedeEditarUsuario) {
      mostrarNotificacion('No tienes permisos para modificar usuarios', 'error');
      return;
    }
    
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      mostrarNotificacion(`Usuario ${email} ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  async function eliminarUsuario(id, email) {
    if (!puedeEliminarUsuario) {
      mostrarNotificacion('No tienes permisos para eliminar usuarios', 'error');
      return;
    }
    if (!confirm(`¿Eliminar al usuario "${email}"? Esta acción eliminará también su acceso al sistema.`)) return;
    
    try {
      // 1. Eliminar de la tabla pública 'usuarios'
      const { error: deleteError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
        
      if (deleteError) throw deleteError;

      // 2. Eliminar del sistema de autenticación (Auth)
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteUser', data: { userId: id } })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      mostrarNotificacion('Usuario eliminado completamente', 'success');
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
    }
  }

  async function guardarRol() {
    if (!puedeEditarUsuario) { // Unificar permiso bajo gestión de usuarios
      mostrarNotificacion('No tienes permisos para gestionar roles', 'error');
      return;
    }
    
    const data = modalRol.data;
    
    if (!data.nombre.trim()) {
      mostrarNotificacion('El nombre del rol es requerido', 'error');
      return;
    }
    
    try {
      if (modalRol.editing) {
        const { error } = await supabase
          .from('roles')
          .update({
            nombre: data.nombre,
            descripcion: data.descripcion,
            nivel: parseInt(data.nivel),
            activo: data.activo
          })
          .eq('id', modalRol.editing.id);
        if (error) throw error;
        mostrarNotificacion('Rol actualizado', 'success');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            nombre: data.nombre,
            descripcion: data.descripcion,
            nivel: parseInt(data.nivel),
            activo: data.activo
          });
        if (error) throw error;
        mostrarNotificacion('Rol creado', 'success');
      }
      setModalRol({ open: false, editing: null, data: { nombre: '', descripcion: '', nivel: 1, activo: true } });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarRol(id, nombre) {
    if (!puedeEliminarUsuario) {
      mostrarNotificacion('No tienes permisos para eliminar roles', 'error');
      return;
    }
    
    const usuariosConRol = usuarios.filter(u => u.rol_id === id);
    if (usuariosConRol.length > 0) {
      mostrarNotificacion(`No se puede eliminar "${nombre}". Hay ${usuariosConRol.length} usuarios con este rol.`, 'error');
      return;
    }
    if (!confirm(`¿Eliminar el rol "${nombre}"?`)) return;
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error al eliminar', 'error');
    } else {
      mostrarNotificacion('Rol eliminado', 'success');
      cargarDatos();
    }
  }

  async function toggleRolActivo(id, activoActual, nombre) {
    if (!puedeEditarUsuario) {
      mostrarNotificacion('No tienes permisos para modificar roles', 'error');
      return;
    }
    
    const { error } = await supabase
      .from('roles')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      mostrarNotificacion(`Rol "${nombre}" ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  async function abrirModalPermisos(rol) {
    if (!puedeEditarUsuario) {
      mostrarNotificacion('No tienes permisos para configurar permisos', 'error');
      return;
    }
    
    const permisosRol = modulosDisponibles.map(modulo => {
      const permisoExistente = permisos.find(p => p.rol_id === rol.id && p.modulo === modulo.nombre);
      return {
        modulo: modulo.nombre,
        label: modulo.label,
        icon: modulo.icon,
        ver: permisoExistente?.ver || false,
        crear: permisoExistente?.crear || false,
        editar: permisoExistente?.editar || false,
        eliminar: permisoExistente?.eliminar || false
      };
    });
    
    setModalPermisos({ open: true, rol, permisosRol });
  }

  async function guardarPermisos() {
    if (!puedeEditarUsuario) {
      mostrarNotificacion('No tienes permisos para guardar permisos', 'error');
      return;
    }
    
    const { rol, permisosRol } = modalPermisos;
    
    try {
      // Preparar datos para upsert
      const permisosToUpsert = permisosRol.map(permiso => ({
        rol_id: rol.id,
        modulo: permiso.modulo,
        ver: permiso.ver,
        crear: permiso.crear,
        editar: permiso.editar,
        eliminar: permiso.eliminar
      }));

      const { error } = await supabase
        .from('permisos')
        .upsert(permisosToUpsert, { onConflict: 'rol_id,modulo' }); // Asume restricción única
      
      if (error) throw error;
      
      mostrarNotificacion(`Permisos de "${rol.nombre}" actualizados`, 'success');
      setModalPermisos({ open: false, rol: null, permisosRol: [] });
      cargarDatos();
      
    } catch (error) {
      // Si upsert no funciona por configuración de DB, usar lógica manual
      if (error.code === '42501' || error.message.includes('constraint')) {
         // Fallback manual
         for (const permiso of permisosRol) {
            const existe = permisos.find(p => p.rol_id === rol.id && p.modulo === permiso.modulo);
            if (existe) {
              await supabase.from('permisos').update({ ver: permiso.ver, crear: permiso.crear, editar: permiso.editar, eliminar: permiso.eliminar }).eq('id', existe.id);
            } else {
              await supabase.from('permisos').insert({ rol_id: rol.id, ...permiso });
            }
         }
         mostrarNotificacion(`Permisos de "${rol.nombre}" actualizados (modo lento)`, 'success');
         setModalPermisos({ open: false, rol: null, permisosRol: [] });
         cargarDatos();
      } else {
         mostrarNotificacion('Error: ' + error.message, 'error');
      }
    }
  }

  function abrirModalUsuario(editar = null) {
    if (editar) {
      setModalUsuario({
        open: true,
        editing: editar,
        data: {
          email: editar.email,
          nombre: editar.nombre || '',
          apellido: editar.apellido || '',
          telefono: editar.telefono || '',
          rol_id: editar.rol_id?.toString() || '',
          password: ''
        }
      });
    } else {
      setModalUsuario({
        open: true,
        editing: null,
        data: { email: '', nombre: '', apellido: '', telefono: '', rol_id: '', password: '' }
      });
    }
  }

  function abrirModalRol(editar = null) {
    if (editar) {
      setModalRol({
        open: true,
        editing: editar,
        data: {
          nombre: editar.nombre,
          descripcion: editar.descripcion || '',
          nivel: editar.nivel || 1,
          activo: editar.activo
        }
      });
    } else {
      setModalRol({
        open: true,
        editing: null,
        data: { nombre: '', descripcion: '', nivel: 1, activo: true }
      });
    }
  }

  function abrirModalPassword(usuario) {
    setModalPassword({
      open: true,
      usuario: usuario,
      nuevaPassword: '',
      confirmarPassword: ''
    });
  }

  // Optimización: usar datos de la relación ya cargada
  const getRolNombre = (usuario) => {
    return usuario.roles?.nombre || 'Sin rol';
  };

  const getRolBadge = (rolNombre) => {
    switch (rolNombre) {
      case 'Administrador': return 'bg-purple-100 text-purple-700';
      case 'Cajero': return 'bg-blue-100 text-blue-700';
      case 'Cocina': return 'bg-orange-100 text-orange-700';
      case 'Mesero': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!cargandoPermisos && !tienePermiso) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#025373] mb-2">Acceso Denegado</h2>
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Usuarios.</p>
        </div>
      </div>
    );
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">👥 Gestión de Usuarios y Roles</h1>
        <p className="text-white/80 mt-1">Administra usuarios, roles y permisos del sistema</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('usuarios')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'usuarios' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          👥 Usuarios
        </button>
        <button
          onClick={() => setVistaActiva('roles')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'roles' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          🎭 Roles y Permisos
        </button>
      </div>

      {/* VISTA DE USUARIOS */}
      {vistaActiva === 'usuarios' && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[#595959]">{usuarios.length} usuarios registrados</p>
            </div>
            {puedeCrearUsuario && (
              <button
                onClick={() => abrirModalUsuario()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Usuario
              </button>
            )}
          </div>

          {/* Tabla de usuarios */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Usuario</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Email</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Rol</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Teléfono</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Último Acceso</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Estado</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(usuario => (
                    <tr key={usuario.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#116EBF]/10 flex items-center justify-center">
                            <span className="text-[#116EBF] font-semibold">
                              {usuario.nombre?.charAt(0) || usuario.email?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-[#025373]">
                              {usuario.nombre} {usuario.apellido || ''}
                            </p>
                            {usuario.id === usuarioActual?.id && (
                              <span className="text-xs text-[#3BD9D9]">(Tú)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#595959]">{usuario.email}</td>
                      <td className="py-4 px-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRolBadge(getRolNombre(usuario))}`}>
                          {getRolNombre(usuario)}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[#595959]">{usuario.telefono || '-'}</td>
                      <td className="py-4 px-5 text-[#595959] text-sm">
                        {usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          usuario.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex gap-2 justify-center">
                          {puedeEditarUsuario && (
                            <>
                              <button
                                onClick={() => abrirModalUsuario(usuario)}
                                className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg"
                                title="Editar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => abrirModalPassword(usuario)}
                                className="p-1.5 text-yellow-500 hover:bg-yellow-50 rounded-lg"
                                title="Cambiar contraseña"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => toggleUsuarioActivo(usuario.id, usuario.activo, usuario.email)}
                                className={`p-1.5 rounded-lg ${usuario.activo ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                                title={usuario.activo ? 'Desactivar' : 'Activar'}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            </>
                          )}
                          {puedeEliminarUsuario && usuario.id !== usuarioActual?.id && (
                            <button
                              onClick={() => eliminarUsuario(usuario.id, usuario.email)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-200 text-sm text-[#595959]">
              Mostrando {usuarios.length} usuarios
            </div>
          </div>
        </>
      )}

      {/* VISTA DE ROLES */}
      {vistaActiva === 'roles' && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[#595959]">{roles.length} roles configurados</p>
            </div>
            {puedeEditarUsuario && (
              <button
                onClick={() => abrirModalRol()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Rol
              </button>
            )}
          </div>

          {/* Grid de roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roles.map(rol => (
              <div key={rol.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                <div className={`p-5 ${rol.activo ? 'bg-gradient-to-r from-[#F2F2F2] to-white' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-[#025373]">{rol.nombre}</h3>
                      <p className="text-sm text-[#595959] mt-1">{rol.descripcion || 'Sin descripción'}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${rol.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {rol.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="text-xs text-[#595959] mt-2">
                    Nivel: {rol.nivel} • Usuarios: {usuarios.filter(u => u.rol_id === rol.id).length}
                  </div>
                </div>
                {puedeEditarUsuario && (
                  <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-100 flex gap-3">
                    <button onClick={() => abrirModalRol(rol)} className="text-[#116EBF] hover:text-[#025373] text-sm font-medium">Editar</button>
                    <button onClick={() => abrirModalPermisos(rol)} className="text-[#3BD9D9] hover:text-[#2bc0c0] text-sm font-medium">Permisos</button>
                    <button onClick={() => toggleRolActivo(rol.id, rol.activo, rol.nombre)} className={`text-sm font-medium ${rol.activo ? 'text-orange-500' : 'text-green-500'}`}>
                      {rol.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {puedeEliminarUsuario && (
                      <button onClick={() => eliminarRol(rol.id, rol.nombre)} className="text-red-500 text-sm font-medium">Eliminar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL USUARIO */}
      {modalUsuario.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {modalUsuario.editing ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  value={modalUsuario.data.email}
                  onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, email: e.target.value}})}
                  placeholder="usuario@ejemplo.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  disabled={modalUsuario.editing}
                />
              </div>
              
              {!modalUsuario.editing && (
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={modalUsuario.data.password}
                    onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, password: e.target.value}})}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Nombre</label>
                  <input
                    type="text"
                    value={modalUsuario.data.nombre}
                    onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, nombre: e.target.value}})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Apellido</label>
                  <input
                    type="text"
                    value={modalUsuario.data.apellido}
                    onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, apellido: e.target.value}})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={modalUsuario.data.telefono}
                  onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, telefono: e.target.value}})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Rol *</label>
                <select
                  value={modalUsuario.data.rol_id}
                  onChange={(e) => setModalUsuario({...modalUsuario, data: {...modalUsuario.data, rol_id: e.target.value}})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map(rol => (
                    <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalUsuario({ open: false, editing: null, data: { email: '', nombre: '', apellido: '', telefono: '', rol_id: '', password: '' } })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={guardarUsuario} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] shadow-md">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO CONTRASEÑA */}
      {modalPassword.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">🔐 Cambiar Contraseña</h3>
              <p className="text-white/80 text-sm mt-1">
                {modalPassword.usuario?.id === usuarioActual?.id ? 'Tu nueva contraseña' : `Usuario: ${modalPassword.usuario?.email}`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Nueva contraseña *</label>
                <input
                  type="password"
                  value={modalPassword.nuevaPassword}
                  onChange={(e) => setModalPassword({...modalPassword, nuevaPassword: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Confirmar *</label>
                <input
                  type="password"
                  value={modalPassword.confirmarPassword}
                  onChange={(e) => setModalPassword({...modalPassword, confirmarPassword: e.target.value})}
                  placeholder="Repetir contraseña"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalPassword({ open: false, usuario: null, nuevaPassword: '', confirmarPassword: '' })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button 
                onClick={cambiarPassword} 
                disabled={!modalPassword.nuevaPassword || modalPassword.nuevaPassword !== modalPassword.confirmarPassword || modalPassword.nuevaPassword.length < 6}
                className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-md disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ROL */}
      {modalRol.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{modalRol.editing ? '✏️ Editar Rol' : '➕ Nuevo Rol'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Nombre del rol *</label>
                <input
                  type="text"
                  value={modalRol.data.nombre}
                  onChange={(e) => setModalRol({...modalRol, data: {...modalRol.data, nombre: e.target.value}})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Descripción</label>
                <textarea
                  value={modalRol.data.descripcion}
                  onChange={(e) => setModalRol({...modalRol, data: {...modalRol.data, descripcion: e.target.value}})}
                  rows="2"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Nivel de jerarquía</label>
                <input
                  type="number"
                  value={modalRol.data.nivel}
                  onChange={(e) => setModalRol({...modalRol, data: {...modalRol.data, nivel: e.target.value}})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalRol.data.activo}
                  onChange={(e) => setModalRol({...modalRol, data: {...modalRol.data, activo: e.target.checked}})}
                  className="w-4 h-4 text-[#116EBF] rounded"
                />
                <span className="text-sm text-[#595959]">Activo</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalRol({ open: false, editing: null, data: { nombre: '', descripcion: '', nivel: 1, activo: true } })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={guardarRol} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] shadow-md">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERMISOS */}
      {modalPermisos.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl sticky top-0 z-10">
              <h3 className="text-xl font-bold text-white">🔐 Permisos para "{modalPermisos.rol?.nombre}"</h3>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead className="bg-[#F2F2F2]">
                  <tr>
                    <th className="text-left py-3 px-4 text-[#025373]">Módulo</th>
                    <th className="text-center py-3 px-2 text-[#025373]">Ver</th>
                    <th className="text-center py-3 px-2 text-[#025373]">Crear</th>
                    <th className="text-center py-3 px-2 text-[#025373]">Editar</th>
                    <th className="text-center py-3 px-2 text-[#025373]">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {modalPermisos.permisosRol.map((permiso, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-[#025373]">
                        <span className="mr-2">{permiso.icon}</span> {permiso.label}
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={permiso.ver}
                          onChange={(e) => {
                            const nuevos = [...modalPermisos.permisosRol];
                            nuevos[idx].ver = e.target.checked;
                            // Si no puede ver, pierde los demás permisos
                            if (!e.target.checked) {
                              nuevos[idx].crear = false;
                              nuevos[idx].editar = false;
                              nuevos[idx].eliminar = false;
                            }
                            setModalPermisos({...modalPermisos, permisosRol: nuevos});
                          }}
                          className="w-5 h-5 text-[#116EBF] cursor-pointer rounded"
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={permiso.crear}
                          onChange={(e) => {
                            const nuevos = [...modalPermisos.permisosRol];
                            nuevos[idx].crear = e.target.checked;
                            setModalPermisos({...modalPermisos, permisosRol: nuevos});
                          }}
                          className="w-5 h-5 text-[#116EBF] cursor-pointer rounded"
                          disabled={!permiso.ver}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={permiso.editar}
                          onChange={(e) => {
                            const nuevos = [...modalPermisos.permisosRol];
                            nuevos[idx].editar = e.target.checked;
                            setModalPermisos({...modalPermisos, permisosRol: nuevos});
                          }}
                          className="w-5 h-5 text-[#116EBF] cursor-pointer rounded"
                          disabled={!permiso.ver}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={permiso.eliminar}
                          onChange={(e) => {
                            const nuevos = [...modalPermisos.permisosRol];
                            nuevos[idx].eliminar = e.target.checked;
                            setModalPermisos({...modalPermisos, permisosRol: nuevos});
                          }}
                          className="w-5 h-5 text-[#116EBF] cursor-pointer rounded"
                          disabled={!permiso.ver}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl sticky bottom-0">
              <button onClick={() => setModalPermisos({ open: false, rol: null, permisosRol: [] })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={guardarPermisos} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] shadow-md">Guardar Permisos</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}