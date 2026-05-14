"use client"
import { useEffect, useRef } from "react"

const N = 160 // particle count — balanced for mobile

interface Props {
  score:      number
  distracted: boolean
  isRunning:  boolean
}

export default function FocusParticles({ score, distracted, isRunning }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef(score)
  const distRef  = useRef(distracted)
  const frameRef = useRef(0)

  // Keep refs synced with props without restarting the scene
  useEffect(() => { scoreRef.current = score      }, [score])
  useEffect(() => { distRef.current  = distracted }, [distracted])

  useEffect(() => {
    if (!isRunning || !mountRef.current) return

    const el = mountRef.current
    let cleanupFn = () => {}

    // Dynamic import keeps Three.js out of the initial bundle
    import("three").then(THREE => {
      if (!el) return

      // ── Scene setup ───────────────────────────────────────────
      const scene    = new THREE.Scene()
      const W        = el.clientWidth  || 400
      const H        = el.clientHeight || 300
      const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 100)
      camera.position.z = 4.8

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(W, H)
      renderer.setClearColor(0x000000, 0)

      const canvas = renderer.domElement
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0"
      el.appendChild(canvas)

      // Resize observer
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth, h = el.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      })
      ro.observe(el)

      // ── Particles ─────────────────────────────────────────────
      const positions  = new Float32Array(N * 3)
      const velocities = new Float32Array(N * 3)
      const homePos    = new Float32Array(N * 3)
      const phases     = new Float32Array(N)

      for (let i = 0; i < N; i++) {
        const angle    = (i / N) * Math.PI * 2
        const r        = 1.7 + (Math.random() - 0.5) * 0.7
        homePos[i*3]   = Math.cos(angle) * r
        homePos[i*3+1] = Math.sin(angle) * r
        homePos[i*3+2] = (Math.random() - 0.5) * 0.3
        positions[i*3]   = homePos[i*3]   + (Math.random() - 0.5) * 0.8
        positions[i*3+1] = homePos[i*3+1] + (Math.random() - 0.5) * 0.8
        positions[i*3+2] = homePos[i*3+2]
        phases[i] = Math.random() * Math.PI * 2
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))

      const mat = new THREE.PointsMaterial({
        size:        0.055,
        color:       0x3ecf8e,
        transparent: true,
        opacity:     0.85,
        depthWrite:  false,
      })

      const pts = new THREE.Points(geo, mat)
      scene.add(pts)

      // ── Animation loop ────────────────────────────────────────
      let t = 0

      const tick = () => {
        frameRef.current = requestAnimationFrame(tick)
        t += 0.012

        const s     = scoreRef.current
        const chaos = distRef.current
        const norm  = Math.max(0, Math.min(1, s / 100))

        // ── Color by state ──────────────────────────────────────
        if (chaos || norm < 0.35) {
          mat.color.setHex(0xff453a) // red — distracted / alert
          mat.opacity = 0.9
        } else if (norm < 0.65) {
          mat.color.setHex(0xff9f0a) // amber — moderate focus
          mat.opacity = 0.75
        } else {
          mat.color.setHex(0x3ecf8e) // teal — deep focus
          mat.opacity = 0.6 + norm * 0.3
        }

        // ── Update particle positions ───────────────────────────
        for (let i = 0; i < N; i++) {
          const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2

          if (chaos) {
            // Chaotic explosion when distracted
            velocities[ix] += (Math.random() - 0.5) * 0.16
            velocities[iy] += (Math.random() - 0.5) * 0.16
            velocities[iz] += (Math.random() - 0.5) * 0.04
            velocities[ix] *= 0.89
            velocities[iy] *= 0.89
            velocities[iz] *= 0.93

          } else if (norm > 0.65) {
            // Deep focus — smooth orbital flow
            const angle  = (i / N) * Math.PI * 2 + t * 0.38
            const r      = 1.7 + Math.sin(t * 0.22 + phases[i]) * 0.28
            const tx     = Math.cos(angle) * r
            const ty     = Math.sin(angle) * r
            const tz     = Math.sin(t * 0.17 + phases[i]) * 0.12
            velocities[ix] = (tx - positions[ix]) * 0.09
            velocities[iy] = (ty - positions[iy]) * 0.09
            velocities[iz] = (tz - positions[iz]) * 0.09

          } else {
            // Moderate — partial scatter + gentle pull home
            const scatter  = (1 - norm) * 0.045
            velocities[ix] += (Math.random() - 0.5) * scatter
            velocities[iy] += (Math.random() - 0.5) * scatter
            velocities[ix] += (homePos[ix] - positions[ix]) * 0.025
            velocities[iy] += (homePos[iy] - positions[iy]) * 0.025
            velocities[iz] += (homePos[iz] - positions[iz]) * 0.025
            velocities[ix] *= 0.95
            velocities[iy] *= 0.95
            velocities[iz] *= 0.97
          }

          positions[ix] += velocities[ix]
          positions[iy] += velocities[iy]
          positions[iz] += velocities[iz]

          // Soft boundary — repel particles that drift too far
          const dx = positions[ix], dy = positions[iy]
          const d2 = dx * dx + dy * dy
          if (d2 > 10) {
            const d = Math.sqrt(d2)
            velocities[ix] -= (dx / d) * 0.018
            velocities[iy] -= (dy / d) * 0.018
          }
        }

        geo.attributes.position.needsUpdate = true
        pts.rotation.z += 0.0008
        renderer.render(scene, camera)
      }

      tick()

      cleanupFn = () => {
        cancelAnimationFrame(frameRef.current)
        ro.disconnect()
        renderer.dispose()
        geo.dispose()
        mat.dispose()
        if (el.contains(canvas)) el.removeChild(canvas)
      }
    }).catch(err => console.error("Three.js failed to load:", err))

    return () => cleanupFn()
  }, [isRunning])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position:     "absolute",
        inset:        0,
        pointerEvents:"none",
        overflow:     "hidden",
        zIndex:       0,
      }}
    />
  )
}
