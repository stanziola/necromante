"use client"

// AnimatedShaderBackground — the 21st.dev "AnoAI" aurora shader, ported from
// three.js to plain WebGL2 (no dependencies) and recoloured to white comets
// on black. One canvas that fills its parent, drawn at the screen's full
// resolution.

import { useEffect, useRef } from "react"

const VERT = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
out vec4 fragColor;

#define NUM_OCTAVES 3

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u*u*(3.0-2.0*u);

  float res = mix(
    mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
  return res * res;
}

float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.3;
  vec2 shift = vec2(100);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(x);
    x = rot * x * 2.0 + shift;
    a *= 0.4;
  }
  return v;
}

void main() {
  vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
  vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
  vec2 v;
  float o = 0.0;

  float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

  for (float i = 0.0; i < 35.0; i++) {
    v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
    // Only the first octave of fbm() for the tails: the other two changed
    // the image by at most 4/255 and doubled the GPU time.
    float tailNoise = 0.3 * noise(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
    // White comets: a single brightness instead of the original RGB aurora
    // colour (this is its dominant, blue channel).
    float brightness = 0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3);
    float currentContribution = brightness * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
    float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
    o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
  }

  // max() keeps pow() away from negative bases, which are NaN on some GPUs.
  o = tanh(pow(max(o / 100.0, 0.0), 1.6));
  fragColor = vec4(vec3(o * 1.5), 1.0);
}`

// Drawn at device pixels, capped at 2×: beyond that a soft effect gains
// nothing visible and phones would pay up to 2.25× the GPU work.
const MAX_PIXEL_RATIO = 2

export function AnimatedShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    })
    if (!gl) return

    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let timeUniform: WebGLUniformLocation | null = null
    let resolutionUniform: WebGLUniformLocation | null = null

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        console.error("AnimatedShaderBackground:", gl.getShaderInfoLog(shader))
      return shader
    }

    // Creates the GL resources; runs again when a lost context is restored.
    const setup = () => {
      const vertexShader = compile(gl.VERTEX_SHADER, VERT)
      const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG)
      program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.useProgram(program)

      // One triangle that covers the whole viewport.
      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      )
      const position = gl.getAttribLocation(program, "a_position")
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

      timeUniform = gl.getUniformLocation(program, "iTime")
      resolutionUniform = gl.getUniformLocation(program, "iResolution")
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const rect = canvas.getBoundingClientRect()
    let cssWidth = rect.width
    let cssHeight = rect.height

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      const width = Math.max(1, Math.round(cssWidth * ratio))
      const height = Math.max(1, Math.round(cssHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    // Endless loop on real elapsed time: same speed at 60 or 240 Hz, and each
    // step is capped so coming back to the tab doesn't jump ahead.
    let time = 0
    let last: number | null = null
    let frame = 0

    const render = (now: number) => {
      frame = requestAnimationFrame(render)
      if (last !== null) time += Math.min((now - last) / 1000, 0.1)
      last = now
      // Every frame, so zoom or a move to another monitor is picked up too.
      resize()
      gl.uniform1f(timeUniform, time)
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      cssWidth = entry.contentRect.width
      cssHeight = entry.contentRect.height
    })

    // If the GPU drops the context (driver reset, too many contexts…), wait
    // for it to come back and carry on where the animation left off.
    const onContextLost = (event: Event) => {
      event.preventDefault()
      cancelAnimationFrame(frame)
    }
    const onContextRestored = () => {
      setup()
      last = null
      frame = requestAnimationFrame(render)
    }

    resize()
    setup()
    resizeObserver.observe(canvas)
    canvas.addEventListener("webglcontextlost", onContextLost)
    canvas.addEventListener("webglcontextrestored", onContextRestored)
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener("webglcontextlost", onContextLost)
      canvas.removeEventListener("webglcontextrestored", onContextRestored)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />
  )
}
