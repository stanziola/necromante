import { AnimatedShaderBackground } from "@/components/ui/animated-shader-background";

export default function Home() {
  // Black like the shader's background, so there is no white flash before
  // WebGL paints (and a sensible fallback without WebGL2).
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <AnimatedShaderBackground className="absolute inset-0" />
      <div className="relative flex h-full items-center justify-center px-4">
        <h1 className="text-5xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-7xl">
          necromante
        </h1>
      </div>
    </main>
  );
}
