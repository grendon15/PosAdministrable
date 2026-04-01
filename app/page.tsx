'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('productos').select('*');
      console.log('Datos:', data);
      setProductos(data || []);
    }
    cargar();
  }, []);

  return (
    <div>
      <h1>POS Restaurante</h1>
      {productos.map(p => (
        <div key={p.id}>{p.nombre} - ${p.precio_venta}</div>
      ))}
    </div>
  );
}