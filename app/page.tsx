import { ShaderBackground } from "@/components/ui/shader-background";

export default function Home() {
  // The background matches the shader's first colour, so there is no white
  // flash before WebGL paints (and a sensible fallback without WebGL).
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#031c26]">
      <ShaderBackground className="absolute inset-0" />
      <div className="relative flex h-full items-center justify-center px-4">
        <h1 className="text-5xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-7xl">
          Necromante
        </h1>
      </div>
    </main>
  );
}
