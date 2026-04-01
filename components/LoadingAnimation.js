'use client';
import Image from 'next/image';

export default function LoadingAnimation() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <div className="relative">
        {/* Imagen estática sin animación bounce */}
        <div>
          <Image
            src="/logo-walk.gif"
            alt="Cargando..."
            width={200}
            height={200}
            className="mx-auto"
            unoptimized
          />
        </div>
        
        {/* Texto animado */}
        <div className="mt-8 text-center">
          <div className="flex gap-2 justify-center">
            <div className="w-3 h-3 bg-[#116EBF] rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-[#3BD9D9] rounded-full animate-pulse delay-100"></div>
            <div className="w-3 h-3 bg-[#025373] rounded-full animate-pulse delay-200"></div>
          </div>
          <p className="mt-4 text-[#595959] font-medium">Cargando información...</p>
          <p className="text-sm text-[#595959] mt-1">Por favor espera</p>
        </div>
      </div>
    </div>
  );
}