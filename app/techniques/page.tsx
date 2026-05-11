"use client"
import { useState, useEffect, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────
type Technique = "pomodoro" | "deepwork" | "spaced" | "timeboxing" | "feynman"
type TimerPhase = "idle" | "work" | "break" | "longbreak"

// ── Technique config ──────────────────────────────────────────────
const TECHNIQUES = {
  pomodoro: {
    name:        "Pomodoro",
    emoji:       "🍅",
    color:       "#D85A30",
    tagline:     "25 min focus · 5 min break",
    description: "Work in focused 25-minute sprints separated by short breaks. After 4 pomodoros, take a longer 15-minute break.",
    work:        25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4,
    tips: ["Turn off all notifications", "One task per pomodoro only", "If distracted, write it down and refocus", "Never skip the break — it recharges you"],
  },
  deepwork: {
    name:        "Deep Work",
    emoji:       "🧠",
    color:       "#534AB7",
    tagline:     "90 min focus · 20 min break",
    description: "Extended uninterrupted focus blocks based on Cal Newport's research. Best for complex problems and creative work.",
    work:        90, shortBreak: 20, longBreak: 30, cyclesBeforeLong: 2,
    tips: ["Phone in another room", "Tell others not to disturb you", "Use the same time and place daily", "Quit social media during sessions"],
  },
  spaced: {
    name:        "Spaced Repetition",
    emoji:       "🔁",
    color:       "#1D9E75",
    tagline:     "Review at increasing intervals",
    description: "Review material at scientifically optimal intervals. New cards daily, then 1d → 3d → 7d → 14d → 30d gaps.",
    work:        20, shortBreak: 10, longBreak: 20, cyclesBeforeLong: 3,
    tips: ["Review yesterday's material first", "Test yourself — don't just re-read", "Use flashcards (Anki is best)", "Hard cards appear more often — that's good"],
  },
  timeboxing: {
    name:        "Timeboxing",
    emoji:       "📦",
    color:       "#BA7517",
    tagline:     "Fixed time per task",
    description: "Assign fixed time blocks to specific tasks. Forces you to work efficiently and prevents perfectionism from stalling progress.",
    work:        45, shortBreak: 10, longBreak: 20, cyclesBeforeLong: 3,
    tips: ["Plan tomorrow's boxes tonight", "Be specific — not 'study maths', but 'solve pg 45–60'", "Time is fixed — output isn't", "Review what you finished at end of day"],
  },
  feynman: {
    name:        "Feynman Technique",
    emoji:       "✍️",
    color:       "#9B4DBF",
    tagline:     "Learn by teaching",
    description: "Explain the concept in simple words as if teaching a child. Gaps in your explanation reveal gaps in your understanding.",
    work:        30, shortBreak: 10, longBreak: 15, cyclesBeforeLong: 3,
    tips: ["Write the concept title, then explain it simply", "Spot where you get stuck — that's your gap", "Go back to source material for the gaps", "Simplify further until a 10-year-old understands"],
  },
}

// ── Spaced repetition schedule ────────────────────────────────────
const SR_INTERVALS = [
  { label:"New",     days:0,  color:"#534AB7", count:8  },
  { label:"1 day",  days:1,  color:"#1D9E75", count:12 },
  { label:"3 days", days:3,  color:"#BA7517", count:6  },
  { label:"7 days", days:7,  color:"#D85A30", count:4  },
  { label:"14 days",days:14, color:"#9B4DBF", count:3  },
  { label:"30 days",days:30, color:"#888",    count:2  },
]

// ── Feynman steps ─────────────────────────────────────────────────
const FEYNMAN_STEPS = [
  { num:1, title:"Pick a concept",       desc:"Write the name of what you want to learn at the top of a blank page." },
  { num:2, title:"Explain it simply",    desc:"Write an explanation as if you're teaching it to a 10-year-old. No jargon." },
  { num:3, title:"Find your gaps",       desc:"Where you got stuck or vague — those are your knowledge gaps. Note them." },
  { num:4, title:"Go back and study",    desc:"Return to your source material specifically for those gap areas." },
  { num:5, title:"Simplify & use analogy", desc:"Rewrite your explanation using a simple real-world analogy. If you can't, keep studying." },
]

export default function TechniquesPage() {
  const [active, setActive]       = useState<Technique>("pomodoro")
  const [phase, setPhase]         = useState<TimerPhase>("idle")
  const [seconds, setSeconds]     = useState(0)
  const [cycle, setCycle]         = useState(1)
  const [totalCycles, setTotalCycles] = useState(0)
  const [feynStep, setFeynStep]   = useState(0)
  const timerRef                  = useRef<NodeJS.Timeout | null>(null)
  const tech                      = TECHNIQUES[active]

  // ── Timer logic ───────────────────────────────────────────────────
  const totalSeconds = (p: TimerPhase) => {
    if (p === "work")      return tech.work * 60
    if (p === "break")     return tech.shortBreak * 60
    if (p === "longbreak") return tech.longBreak * 60
    return 0
  }

  useEffect(() => {
    if (phase === "idle") return
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          // Phase complete
          clearInterval(timerRef.current!)
          if (phase === "work") {
            const newCycle = cycle + 1
            setCycle(newCycle)
            setTotalCycles(t => t + 1)
            const isLongBreak = newCycle > tech.cyclesBeforeLong
            if (isLongBreak) { setCycle(1); startPhase("longbreak") }
            else startPhase("break")
          } else {
            startPhase("work")
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [phase, cycle])

  const startPhase = (p: TimerPhase) => {
    clearInterval(timerRef.current!)
    setPhase(p)
    setSeconds(totalSeconds(p))
  }

  const startTimer = () => startPhase("work")

  const resetTimer = () => {
    clearInterval(timerRef.current!)
    setPhase("idle")
    setSeconds(0)
    setCycle(1)
  }

  const switchTech = (t: Technique) => {
    resetTimer()
    setActive(t)
    setFeynStep(0)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0")
    return `${m}:${(s % 60).toString().padStart(2, "0")}`
  }

  const progress = phase === "idle" ? 0
    : Math.round(((totalSeconds(phase) - seconds) / totalSeconds(phase)) * 100)

  const phaseLabel = phase === "idle"      ? "Ready to start"
    : phase === "work"      ? "Focus time 🎯"
    : phase === "break"     ? "Short break ☕"
    : "Long break 🌿"

  const phaseColor = phase === "work" ? tech.color
    : phase === "break" ? "#1D9E75"
    : "#534AB7"

  // ── Circular progress SVG ─────────────────────────────────────────
  const R = 70, C = 2 * Math.PI * R
  const strokeDash = `${(progress / 100) * C} ${C}`

  return (
    <main style={{ minHeight:"100vh", background:"#0f0f0f", color:"white", padding:"1.5rem", maxWidth:"520px", margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"1.5rem" }}>
        <a href="/" style={{ color:"#888", textDecoration:"none", fontSize:"1.2rem" }}>←</a>
        <div>
          <h1 style={{ fontSize:"1.2rem", fontWeight:"600" }}>Study Techniques</h1>
          <p style={{ color:"#555", fontSize:"0.75rem" }}>Science-backed methods for deeper learning</p>
        </div>
      </div>

      {/* Technique selector */}
      <div style={{ display:"flex", gap:"8px", overflowX:"auto", paddingBottom:"4px", marginBottom:"1.5rem" }}>
        {(Object.keys(TECHNIQUES) as Technique[]).map(t => {
          const tc = TECHNIQUES[t]
          return (
            <button key={t} onClick={() => switchTech(t)} style={{
              background: active===t ? tc.color : "#1a1a1a",
              border: active===t ? "none" : "1px solid #2a2a2a",
              borderRadius:"10px", color:"white", padding:"8px 14px",
              fontSize:"0.82rem", fontWeight:"600", cursor:"pointer",
              whiteSpace:"nowrap", flexShrink:0,
              boxShadow: active===t ? `0 0 20px ${tc.color}44` : "none",
              transition:"all 0.3s"
            }}>
              {tc.emoji} {tc.name}
            </button>
          )
        })}
      </div>

      {/* Technique info */}
      <div style={{
        background:"#1a1a1a", borderRadius:"16px",
        border:`1px solid ${tech.color}33`, padding:"1.2rem",
        marginBottom:"1.5rem"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
          <span style={{ fontSize:"1.8rem" }}>{tech.emoji}</span>
          <div>
            <h2 style={{ fontSize:"1rem", fontWeight:"700", margin:0 }}>{tech.name}</h2>
            <p style={{ fontSize:"0.75rem", color:tech.color, margin:0, fontWeight:"500" }}>{tech.tagline}</p>
          </div>
        </div>
        <p style={{ fontSize:"0.83rem", color:"#aaa", lineHeight:1.6, margin:0 }}>{tech.description}</p>
      </div>

      {/* Timer — shown for all except Feynman */}
      {active !== "feynman" && (
        <div style={{
          background:"#1a1a1a", borderRadius:"16px",
          border:`1px solid ${phaseColor}33`, padding:"2rem",
          textAlign:"center", marginBottom:"1.5rem"
        }}>
          {/* Cycle indicators */}
          <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"16px" }}>
            {Array.from({ length: tech.cyclesBeforeLong }).map((_, i) => (
              <div key={i} style={{
                width:"10px", height:"10px", borderRadius:"50%",
                background: i < cycle - 1 ? tech.color : "#2a2a2a",
                border: i === cycle - 1 && phase !== "idle" ? `2px solid ${tech.color}` : "none",
                transition:"all 0.3s"
              }} />
            ))}
          </div>

          {/* Circular timer */}
          <div style={{ position:"relative", display:"inline-block", marginBottom:"16px" }}>
            <svg width="170" height="170" viewBox="0 0 170 170">
              <circle cx="85" cy="85" r={R} fill="none" stroke="#2a2a2a" strokeWidth="8" />
              <circle cx="85" cy="85" r={R} fill="none"
                stroke={phaseColor} strokeWidth="8"
                strokeDasharray={strokeDash}
                strokeLinecap="round"
                transform="rotate(-90 85 85)"
                style={{ transition:"stroke-dasharray 0.5s, stroke 0.5s" }}
              />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:"2.2rem", fontWeight:"800", letterSpacing:"2px", color:phaseColor }}>
                {phase === "idle" ? `${tech.work}:00` : formatTime(seconds)}
              </div>
              <div style={{ fontSize:"0.72rem", color:"#666", marginTop:"2px" }}>{phaseLabel}</div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:"flex", justifyContent:"center", gap:"24px", marginBottom:"20px" }}>
            {[
              { label:"Cycle",         value:`${cycle}/${tech.cyclesBeforeLong}` },
              { label:"Completed",     value:String(totalCycles) },
              { label:"Progress",      value:`${progress}%` },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center" }}>
                <p style={{ fontSize:"1rem", fontWeight:"700", color:phaseColor, margin:0 }}>{s.value}</p>
                <p style={{ fontSize:"0.65rem", color:"#555", margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
            {phase === "idle" ? (
              <button onClick={startTimer} style={{
                background: tech.color, border:"none", borderRadius:"12px",
                color:"white", padding:"12px 40px", fontSize:"1rem",
                fontWeight:"600", cursor:"pointer",
                boxShadow:`0 0 20px ${tech.color}55`
              }}>Start {tech.emoji}</button>
            ) : (
              <>
                <button onClick={resetTimer} style={{
                  background:"#2a2a2a", border:"none", borderRadius:"12px",
                  color:"#aaa", padding:"12px 24px", fontSize:"0.9rem",
                  fontWeight:"600", cursor:"pointer"
                }}>Reset</button>
                <button onClick={() => startPhase(phase === "work" ? "break" : "work")} style={{
                  background: tech.color, border:"none", borderRadius:"12px",
                  color:"white", padding:"12px 24px", fontSize:"0.9rem",
                  fontWeight:"600", cursor:"pointer"
                }}>
                  {phase === "work" ? "Take Break" : "Resume Work"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Spaced repetition schedule */}
      {active === "spaced" && (
        <div style={{ background:"#1a1a1a", borderRadius:"16px", border:"1px solid #2a2a2a", padding:"1.2rem", marginBottom:"1.5rem" }}>
          <p style={{ fontWeight:"600", fontSize:"0.9rem", marginBottom:"4px" }}>Today's Review Queue</p>
          <p style={{ color:"#555", fontSize:"0.72rem", marginBottom:"12px" }}>Cards due for review by interval</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {SR_INTERVALS.map(interval => (
              <div key={interval.label} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"60px", fontSize:"0.75rem", color:interval.color, fontWeight:"600" }}>{interval.label}</div>
                <div style={{ flex:1, height:"20px", background:"#111", borderRadius:"6px", overflow:"hidden" }}>
                  <div style={{
                    width:`${(interval.count / 15) * 100}%`,
                    height:"100%", background:interval.color + "88",
                    borderRadius:"6px", display:"flex", alignItems:"center",
                    paddingLeft:"8px"
                  }}>
                    <span style={{ fontSize:"0.68rem", color:"white", fontWeight:"600" }}>{interval.count} cards</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"12px", padding:"10px", background:"#111", borderRadius:"10px", border:"1px solid #1D9E7533" }}>
            <p style={{ fontSize:"0.78rem", color:"#1D9E75", margin:0, fontWeight:"500" }}>
              📊 Total: {SR_INTERVALS.reduce((a,b) => a + b.count, 0)} cards due today
            </p>
          </div>
        </div>
      )}

      {/* Feynman steps */}
      {active === "feynman" && (
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ background:"#1a1a1a", borderRadius:"16px", border:"1px solid #9B4DBF33", padding:"1.2rem", marginBottom:"1rem" }}>
            <p style={{ fontWeight:"600", fontSize:"0.9rem", marginBottom:"4px" }}>The 5-Step Process</p>
            <p style={{ color:"#555", fontSize:"0.72rem", marginBottom:"16px" }}>Tap each step as you complete it</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {FEYNMAN_STEPS.map((step, i) => (
                <div
                  key={step.num}
                  onClick={() => setFeynStep(i)}
                  style={{
                    display:"flex", gap:"12px", alignItems:"flex-start",
                    padding:"12px", borderRadius:"12px", cursor:"pointer",
                    background: feynStep === i ? "#9B4DBF22" : "#111",
                    border:`1px solid ${feynStep === i ? "#9B4DBF" : i < feynStep ? "#1D9E7544" : "#222"}`,
                    transition:"all 0.2s"
                  }}
                >
                  <div style={{
                    width:"28px", height:"28px", borderRadius:"50%", flexShrink:0,
                    background: i < feynStep ? "#1D9E75" : feynStep === i ? "#9B4DBF" : "#2a2a2a",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.8rem", fontWeight:"700"
                  }}>
                    {i < feynStep ? "✓" : step.num}
                  </div>
                  <div>
                    <p style={{ fontWeight:"600", fontSize:"0.85rem", margin:"0 0 3px" }}>{step.title}</p>
                    <p style={{ fontSize:"0.75rem", color:"#777", margin:0, lineHeight:1.5 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
              <button
                onClick={() => setFeynStep(s => Math.max(0, s - 1))}
                disabled={feynStep === 0}
                style={{ flex:1, padding:"10px", background:"#2a2a2a", border:"none", borderRadius:"10px", color: feynStep===0 ? "#444" : "#aaa", cursor: feynStep===0 ? "not-allowed" : "pointer", fontWeight:"600" }}
              >← Back</button>
              <button
                onClick={() => setFeynStep(s => Math.min(FEYNMAN_STEPS.length - 1, s + 1))}
                disabled={feynStep === FEYNMAN_STEPS.length - 1}
                style={{ flex:1, padding:"10px", background:"#9B4DBF", border:"none", borderRadius:"10px", color:"white", cursor: feynStep===FEYNMAN_STEPS.length-1 ? "not-allowed" : "pointer", fontWeight:"600", opacity: feynStep===FEYNMAN_STEPS.length-1 ? 0.5 : 1 }}
              >Next →</button>
            </div>
          </div>

          {/* Ask AI for topic */}
          <div style={{ background:"#1a1a1a", borderRadius:"14px", border:"1px solid #9B4DBF33", padding:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontWeight:"600", fontSize:"0.85rem", margin:0 }}>Stuck explaining something?</p>
              <p style={{ fontSize:"0.75rem", color:"#666", margin:0 }}>Ask the AI Tutor to help simplify it</p>
            </div>
            <a href="/chat" style={{ background:"#9B4DBF", borderRadius:"8px", padding:"8px 14px", fontSize:"0.8rem", color:"white", textDecoration:"none", fontWeight:"600", whiteSpace:"nowrap" }}>Ask AI →</a>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{ background:"#1a1a1a", borderRadius:"16px", border:"1px solid #2a2a2a", padding:"1.2rem" }}>
        <p style={{ fontWeight:"600", fontSize:"0.9rem", marginBottom:"10px" }}>💡 Pro Tips</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {tech.tips.map((tip, i) => (
            <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
              <div style={{ width:"20px", height:"20px", borderRadius:"50%", background:tech.color+"33", color:tech.color, fontSize:"0.7rem", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {i+1}
              </div>
              <p style={{ fontSize:"0.82rem", color:"#aaa", margin:0, lineHeight:1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  )
}