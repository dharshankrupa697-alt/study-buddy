"use client"
import { useEffect, useRef } from "react"

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width  = W
    canvas.height = H

    // ── Particles ───────────────────────────────────────────────
    const PARTICLE_COUNT = 80
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      vx:   (Math.random() - 0.5) * 0.4,
      vy:   (Math.random() - 0.5) * 0.4,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6
        ? `rgba(0,212,255,`
        : Math.random() > 0.5
        ? `rgba(124,77,255,`
        : `rgba(0,255,136,`,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.02,
    }))

    // ── Hexagons ────────────────────────────────────────────────
    const HEXAGON_COUNT = 6
    const hexagons = Array.from({ length: HEXAGON_COUNT }, () => ({
      x:       Math.random() * W,
      y:       Math.random() * H,
      size:    80 + Math.random() * 120,
      rotation:Math.random() * Math.PI * 2,
      rotSpeed:(Math.random() - 0.5) * 0.002,
      opacity: 0.03 + Math.random() * 0.04,
      color:   Math.random() > 0.5 ? "#00d4ff" : "#7c4dff",
      vx:      (Math.random() - 0.5) * 0.15,
      vy:      (Math.random() - 0.5) * 0.15,
    }))

    // ── Data streams ────────────────────────────────────────────
    const STREAM_COUNT = 12
    const streams = Array.from({ length: STREAM_COUNT }, () => ({
      x:      Math.random() * W,
      y:      Math.random() * H,
      length: 40 + Math.random() * 80,
      speed:  0.5 + Math.random() * 1.5,
      opacity:0.1 + Math.random() * 0.2,
      width:  0.5 + Math.random(),
    }))

    // ── Draw hexagon ────────────────────────────────────────────
    const drawHex = (x:number, y:number, size:number, rotation:number, color:string, opacity:number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const px = size * Math.cos(angle)
        const py = size * Math.sin(angle)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = color
      ctx.lineWidth   = 0.5
      ctx.globalAlpha = opacity
      ctx.stroke()

      // Inner hexagon
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const px = (size * 0.6) * Math.cos(angle)
        const py = (size * 0.6) * Math.sin(angle)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.globalAlpha = opacity * 0.5
      ctx.stroke()
      ctx.restore()
    }

    // ── Animation ───────────────────────────────────────────────
    let frame = 0
    let animId: number

    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      frame++

      // Grid (subtle)
      ctx.strokeStyle = "rgba(0,212,255,0.03)"
      ctx.lineWidth   = 0.5
      const GRID = 50
      for (let x = 0; x < W; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Hexagons
      hexagons.forEach(h => {
        h.x += h.vx; h.y += h.vy; h.rotation += h.rotSpeed
        if (h.x < -h.size)   h.x = W + h.size
        if (h.x > W+h.size)  h.x = -h.size
        if (h.y < -h.size)   h.y = H + h.size
        if (h.y > H+h.size)  h.y = -h.size
        drawHex(h.x, h.y, h.size, h.rotation, h.color, h.opacity)
      })

      // Data streams (vertical falling lines)
      streams.forEach(s => {
        s.y += s.speed
        if (s.y > H + s.length) s.y = -s.length

        const grad = ctx.createLinearGradient(s.x, s.y - s.length, s.x, s.y)
        grad.addColorStop(0, "rgba(0,212,255,0)")
        grad.addColorStop(1, `rgba(0,212,255,${s.opacity})`)

        ctx.strokeStyle = grad
        ctx.lineWidth   = s.width
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.moveTo(s.x, s.y - s.length)
        ctx.lineTo(s.x, s.y)
        ctx.stroke()
      })

      // Particles + connections
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        p.pulse += p.pulseSpeed
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        const pulsedOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse))

        // Draw particle
        ctx.globalAlpha = pulsedOpacity
        ctx.fillStyle   = p.color + `${pulsedOpacity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        // Glow
        ctx.globalAlpha = pulsedOpacity * 0.3
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx.fill()
      })

      // Connections between nearby particles
      ctx.globalAlpha = 1
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x
          const dy   = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            const opacity = (1 - dist/120) * 0.12
            ctx.strokeStyle = `rgba(0,212,255,${opacity})`
            ctx.lineWidth   = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Occasional scan line
      if (frame % 180 < 60) {
        const progress = (frame % 180) / 60
        const scanY = progress * H
        const grad  = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
        grad.addColorStop(0, "rgba(0,212,255,0)")
        grad.addColorStop(0.5, "rgba(0,212,255,0.04)")
        grad.addColorStop(1, "rgba(0,212,255,0)")
        ctx.fillStyle   = grad
        ctx.globalAlpha = 1
        ctx.fillRect(0, scanY - 40, W, 80)

        ctx.strokeStyle = "rgba(0,212,255,0.15)"
        ctx.lineWidth   = 1
        ctx.beginPath()
        ctx.moveTo(0, scanY)
        ctx.lineTo(W, scanY)
        ctx.stroke()
      }

      animId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:"fixed",
        inset:0,
        zIndex:0,
        pointerEvents:"none",
        opacity:0.7,
      }}
    />
  )
}