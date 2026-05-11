"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const [display, setDisplay] = useState(children)
  const [stage,   setStage]   = useState<"idle"|"out"|"in">("idle")

  useEffect(() => {
    setStage("out")
    const t1 = setTimeout(() => {
      setDisplay(children)
      setStage("in")
    }, 300)
    const t2 = setTimeout(() => setStage("idle"), 600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pathname])

  return (
    <>
      {/* Scan line effect */}
      {stage !== "idle" && (
        <div style={{
          position:"fixed", inset:0, zIndex:9998, pointerEvents:"none",
          overflow:"hidden"
        }}>
          {/* Horizontal scan line */}
          <div style={{
            position:"absolute", left:0, right:0, height:"2px",
            background:"linear-gradient(90deg,transparent,#7c6dfa,transparent)",
            boxShadow:"0 0 20px #00d4ff, 0 0 60px rgba(0,212,255,0.5)",
            animation: stage==="out" ? "scanDown 0.3s ease-in forwards" : "scanUp 0.3s ease-out forwards",
            top:0
          }}/>

          {/* Grid overlay */}
          <div style={{
            position:"absolute", inset:0,
            backgroundImage:"linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)",
            backgroundSize:"30px 30px",
            opacity: stage==="out" ? 1 : 0,
            transition:"opacity 0.3s"
          }}/>

          {/* Vignette flash */}
          <div style={{
            position:"absolute", inset:0,
            background: stage==="out"
              ? "radial-gradient(ellipse at center, transparent 30%, rgba(10,10,15,0.8) 100%)"
              : "radial-gradient(ellipse at center, transparent 50%, transparent 100%)",
            transition:"all 0.3s"
          }}/>

          {/* Corner brackets flash */}
          {["tl","tr","bl","br"].map(c => (
            <div key={c} style={{
              position:"absolute",
              top:    c.startsWith("t") ? "20px" : "auto",
              bottom: c.startsWith("b") ? "20px" : "auto",
              left:   c.endsWith("l")   ? "20px" : "auto",
              right:  c.endsWith("r")   ? "20px" : "auto",
              width:"30px", height:"30px",
              borderTop:    c.startsWith("t") ? "2px solid #00d4ff" : "none",
              borderBottom: c.startsWith("b") ? "2px solid #00d4ff" : "none",
              borderLeft:   c.endsWith("l")   ? "2px solid #00d4ff" : "none",
              borderRight:  c.endsWith("r")   ? "2px solid #00d4ff" : "none",
              borderRadius: c==="tl"?"4px 0 0 0":c==="tr"?"0 4px 0 0":c==="bl"?"0 0 0 4px":"0 0 4px 0",
              boxShadow:`0 0 10px rgba(0,212,255,0.8)`,
              opacity: stage==="out" ? 1 : 0,
              transition:"opacity 0.3s",
              animation: stage==="out" ? "cornerPulse 0.3s ease-in-out" : "none"
            }}/>
          ))}

          {/* Loading text */}
          {stage==="out" && (
            <div style={{
              position:"absolute", top:"50%", left:"50%",
              transform:"translate(-50%,-50%)",
              fontFamily:"monospace", fontSize:"0.7rem",
              color:"#00d4ff", letterSpacing:"4px",
              textTransform:"uppercase", opacity:0.8
            }}>
              LOADING...
            </div>
          )}
        </div>
      )}

      {/* Page content */}
      <div style={{
        opacity:   stage==="out" ? 0 : 1,
        transform: stage==="out"
          ? "translateY(8px) scale(0.99)"
          : stage==="in"
          ? "translateY(0) scale(1)"
          : "translateY(0) scale(1)",
        transition:"opacity 0.3s ease, transform 0.3s ease",
        willChange:"transform, opacity"
      }}>
        {display}
      </div>

      <style>{`
        @keyframes scanDown {
          from { top: 0%; opacity:1; }
          to   { top: 100%; opacity:0; }
        }
        @keyframes scanUp {
          from { top: 100%; opacity:0; }
          to   { top: 0%; opacity:1; }
        }
        @keyframes cornerPulse {
          0%   { opacity:0; transform:scale(0.8); }
          50%  { opacity:1; transform:scale(1.1); }
          100% { opacity:1; transform:scale(1); }
        }
      `}</style>
    </>
  )
}