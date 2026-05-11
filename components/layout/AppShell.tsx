"use client"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { signOut } from "@/lib/supabase"
import PageTransition from "@/components/PageTransition"

const NAV = [
  { href:"/",           label:"Dashboard",   emoji:"🏠", desc:"Overview" },
  { href:"/session",    label:"Study Room",  emoji:"🎯", desc:"Focus + AI" },
  { href:"/chat",       label:"AI Tutor",    emoji:"💬", desc:"Ask anything" },
  { href:"/roadmap",    label:"Roadmap",     emoji:"🗺️", desc:"AI study plan" },
  { href:"/reports",    label:"Reports",     emoji:"📊", desc:"Analytics" },
  { href:"/techniques", label:"Techniques",  emoji:"📚", desc:"Methods" },
  { href:"/calendar", label:"Calendar", emoji:"📅", desc:"Daily tasks" },
]

const GOAL_COLORS: Record<string, string> = {
  competitive: "#7c6dfa",
  academic:    "#3ecf8e",
  coding:      "#60a5fa",
  skill:       "#fbbf24",
}

function SidebarStats() {
  const [stats, setStats] = useState({ avg:0, hrs:"0.0", sessions:0, weekNum:1, weekPct:0, phase:"", goalType:"" })

  useEffect(() => {
    const load = async () => {
      const { getUser, getSessions, getRoadmap, getCurrentWeek, getProgress } = await import("@/lib/supabase")
      const user = await getUser()
      if (!user) return

      const [sessions, roadmapData, weekData, progressData] = await Promise.all([
        getSessions(user.id, 100),
        getRoadmap(user.id),
        getCurrentWeek(user.id),
        getProgress(user.id),
      ])

      const today = (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
      })()

      const todayS   = sessions.filter((s: any) => {
        const sd = new Date(s.created_at)
        return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}` === today
      })
      const avg      = todayS.length > 0 ? Math.round(todayS.reduce((a:number,s:any)=>a+s.focus_score,0)/todayS.length) : 0
      const totalMin = todayS.reduce((a:number,s:any)=>a+s.duration_minutes,0)

      let weekNum=weekData||1, weekPct=0, phase="", goalType=roadmapData?.goal_type||""
      if (roadmapData) {
        let rm = roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try {
            let clean=rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
            const parsed=JSON.parse(clean)
            if (parsed.weeks?.length>0) rm=parsed
          } catch {}
        }
        const cw    = rm?.weeks?.find((w:any)=>w.week===weekNum)||rm?.weeks?.[0]
        phase       = cw?.phase||""
        const tasks = cw?.tasks||[]
        const done  = tasks.filter((_:any,i:number)=>progressData.some((p:any)=>p.week_number===weekNum&&p.task_index===i&&p.completed)).length
        weekPct     = tasks.length>0?Math.round((done/tasks.length)*100):0
      }
      setStats({ avg, hrs:(totalMin/60).toFixed(1), sessions:todayS.length, weekNum, weekPct, phase, goalType })
    }
    load()
  }, [])

  const color = GOAL_COLORS[stats.goalType] || "#7c6dfa"

  return (
    <div style={{ padding:"0 12px", display:"flex", flexDirection:"column", gap:"6px" }}>
      {/* Week progress */}
      <div style={{ background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", padding:"10px 12px", border:"1px solid var(--border)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
          <span style={{ fontSize:"0.68rem", color:"var(--text-muted)", fontWeight:"500" }}>Week {stats.weekNum}</span>
          <span style={{ fontSize:"0.68rem", fontWeight:"700", color }}>{stats.weekPct}%</span>
        </div>
        <div style={{ fontSize:"0.62rem", color:"var(--text-muted)", marginBottom:"6px" }}>{stats.phase||"Study plan"}</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width:`${stats.weekPct}%`, background:`linear-gradient(90deg,${color},${color}99)` }}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"4px" }}>
        {[
          { label:"Focus", value: stats.avg>0?`${stats.avg}`:"--", color:"var(--accent)" },
          { label:"Hours", value:`${stats.hrs}h`,                   color:"var(--green)" },
          { label:"Sess",  value:`${stats.sessions}`,               color:"var(--blue)" },
        ].map(s=>(
          <div key={s.label} style={{ background:"var(--bg-elevated)", borderRadius:"var(--radius-sm)", padding:"6px 8px", border:"1px solid var(--border)", textAlign:"center" }}>
            <div style={{ fontSize:"0.82rem", fontWeight:"700", color:s.color }}>{s.value}</div>
            <div style={{ fontSize:"0.55rem", color:"var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path   = usePathname()
  const isAuth = path==="/login"||path==="/signup"

  if (isAuth) return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)" }}>{children}</div>
  )

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg-base)" }}>

      {/* Sidebar */}
      <aside style={{
        width:"220px", flexShrink:0,
        background:"var(--bg-surface)",
        borderRight:"1px solid var(--border)",
        display:"flex", flexDirection:"column",
        position:"fixed", top:0, left:0, bottom:0,
        zIndex:50,
      }}>

        {/* Logo */}
        <div style={{ padding:"18px 16px 12px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{
              width:"34px", height:"34px",
              background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)",
              borderRadius:"10px",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"1rem", flexShrink:0,
              boxShadow:"0 4px 12px rgba(124,109,250,0.3)"
            }}>🧠</div>
            <div>
              <p style={{ fontWeight:"700", fontSize:"0.9rem", margin:0, color:"var(--text-primary)" }}>StudyBuddy</p>
              <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>AI Study Assistant</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"8px" }}>
          <div style={{ marginBottom:"4px" }}>
            {NAV.map(item => {
              const active = path===item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"8px 10px", borderRadius:"var(--radius-md)",
                  marginBottom:"2px", textDecoration:"none",
                  background: active ? "var(--accent-soft)" : "transparent",
                  border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
                  transition:"all 0.15s",
                }}>
                  <span style={{ fontSize:"1rem", width:"20px", textAlign:"center" }}>{item.emoji}</span>
                  <div>
                    <p style={{ fontSize:"0.82rem", fontWeight: active?"600":"400", color: active?"var(--text-primary)":"var(--text-secondary)", margin:0 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>{item.desc}</p>
                  </div>
                  {active && <div style={{ marginLeft:"auto", width:"4px", height:"4px", borderRadius:"50%", background:"var(--accent)", flexShrink:0 }}/>}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Stats */}
        <div style={{ borderTop:"1px solid var(--border)", padding:"10px 0 8px", flexShrink:0 }}>
          <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", padding:"0 16px 6px", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.5px" }}>Today</p>
          <SidebarStats/>
        </div>

        {/* User */}
        <div style={{ borderTop:"1px solid var(--border)", padding:"10px 12px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem", fontWeight:"700", color:"white", flexShrink:0 }}>S</div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:"0.78rem", fontWeight:"600", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Student</p>
              <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <span className="dot dot-green" style={{ width:"5px", height:"5px" }}/>
                <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>Online</p>
              </div>
            </div>
            <button onClick={async()=>{ await signOut(); window.location.href="/login" }} style={{
              background:"transparent", border:"1px solid var(--border)",
              borderRadius:"var(--radius-sm)", color:"var(--text-muted)",
              padding:"3px 7px", fontSize:"0.62rem", cursor:"pointer"
            }}>
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft:"220px", flex:1, minHeight:"100vh", position:"relative", zIndex:1 }}>
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Mobile nav */}
      <nav style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:"var(--bg-surface)",
        borderTop:"1px solid var(--border)",
        padding:"6px 0 16px",
        zIndex:100,
        display:"none",
      }} className="mobile-nav">
        {NAV.slice(0,5).map(item=>{
          const active=path===item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              gap:"2px", padding:"4px 8px", textDecoration:"none",
              color:active?"var(--accent)":"var(--text-muted)", flex:1
            }}>
              <span style={{ fontSize:"1.1rem" }}>{item.emoji}</span>
              <span style={{ fontSize:"0.55rem", fontWeight:active?"600":"400" }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (max-width:768px) {
          aside { display:none !important; }
          main  { margin-left:0 !important; padding-bottom:80px; }
          .mobile-nav { display:flex !important; }
        }
      `}</style>
    </div>
  )
}