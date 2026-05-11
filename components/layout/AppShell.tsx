"use client"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { signOut, getUser, getCurrentWeek, getRoadmap, getSessions, getProgress } from "@/lib/supabase"

const NAV = [
  { href:"/",           label:"Home",    emoji:"🏠", active_color:"#0a84ff" },
  { href:"/session",    label:"Study",   emoji:"🎯", active_color:"#30d158" },
  { href:"/roadmap",    label:"Plan",    emoji:"🗺️", active_color:"#bf5af2" },
  { href:"/calendar",   label:"Daily",   emoji:"📅", active_color:"#ff9f0a" },
  { href:"/profile",    label:"More",    emoji:"⚙️", active_color:"#5ac8fa" },
]

const SIDEBAR_NAV = [
  { href:"/",           label:"Home",       emoji:"🏠", desc:"Dashboard" },
  { href:"/session",    label:"Study Room", emoji:"🎯", desc:"Focus + AI" },
  { href:"/chat",       label:"AI Tutor",   emoji:"💬", desc:"Ask anything" },
  { href:"/roadmap",    label:"Roadmap",    emoji:"🗺️", desc:"Study plan" },
  { href:"/calendar",   label:"Daily",      emoji:"📅", desc:"Tasks & check-in" },
  { href:"/reports",    label:"Reports",    emoji:"📊", desc:"Analytics" },
  { href:"/techniques", label:"Techniques", emoji:"📚", desc:"Study methods" },
]

function SidebarStats() {
  const [stats, setStats] = useState({ hrs:"0.0", sessions:0, weekPct:0, phase:"", goalType:"", color:"#0a84ff" })

  const GOAL_COLORS: Record<string,string> = {
    competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
  }

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) return
      const [sessions, roadmapData, weekData, progressData] = await Promise.all([
        getSessions(user.id, 100), getRoadmap(user.id), getCurrentWeek(user.id), getProgress(user.id)
      ])
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`
      const todayS = sessions.filter((s:any)=>{
        const sd=new Date(s.created_at)
        return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`===todayStr
      })
      const totalMin = todayS.reduce((a:number,s:any)=>a+s.duration_minutes,0)
      let weekPct=0, phase="", goalType=""
      if (roadmapData) {
        let rm=roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
        }
        const cw=rm?.weeks?.find((w:any)=>w.week===weekData)||rm?.weeks?.[0]
        phase=cw?.phase||""
        goalType=roadmapData.goal_type||""
        const tasks=cw?.tasks||[]
        const done=tasks.filter((_:any,i:number)=>progressData.some((p:any)=>p.week_number===weekData&&p.task_index===i&&p.completed)).length
        weekPct=tasks.length>0?Math.round((done/tasks.length)*100):0
      }
      const color = GOAL_COLORS[goalType]||"#0a84ff"
      setStats({ hrs:(totalMin/60).toFixed(1), sessions:todayS.length, weekPct, phase, goalType, color })
    }
    load()
  }, [])

  return (
    <div style={{ padding:"12px 12px 0" }}>
      {/* Week progress ring */}
      <div style={{ background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", padding:"12px", marginBottom:"8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          {/* Mini ring */}
          <div style={{ position:"relative", width:"44px", height:"44px", flexShrink:0 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke={stats.color} strokeWidth="4"
                strokeDasharray={`${(stats.weekPct/100)*113} 113`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition:"stroke-dasharray 1s ease" }}
              />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"0.6rem", fontWeight:"700", color:stats.color }}>{stats.weekPct}%</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize:"0.78rem", fontWeight:"600", margin:0 }}>Week Progress</p>
            <p style={{ fontSize:"0.68rem", color:"var(--text-muted)", margin:0 }}>{stats.phase||"Study plan"}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
        {[
          { label:"Today", value:`${stats.hrs}h`, color:"#30d158" },
          { label:"Sessions", value:String(stats.sessions), color:"#0a84ff" },
        ].map(s=>(
          <div key={s.label} style={{ background:"var(--bg-elevated)", borderRadius:"var(--radius-sm)", padding:"8px 10px" }}>
            <p style={{ fontSize:"1rem", fontWeight:"700", color:s.color, margin:0 }}>{s.value}</p>
            <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isAuth = path==="/login"||path==="/signup"||path==="/reset-password"
  const [userName, setUserName] = useState("")
  const [userInitial, setUserInitial] = useState("S")

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (user) {
        const name = user.user_metadata?.name||user.email||"Student"
        setUserName(name.split(" ")[0])
        setUserInitial(name.charAt(0).toUpperCase())
      }
    }
    load()
  }, [])

  if (isAuth) return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)" }}>{children}</div>
  )

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg-base)" }}>

      {/* ── Desktop Sidebar ── */}
      <aside style={{
        width:"220px", flexShrink:0,
        background:"var(--bg-surface)",
        borderRight:"1px solid var(--border)",
        display:"flex", flexDirection:"column",
        position:"fixed", top:0, left:0, bottom:0, zIndex:50,
      }}>
        {/* Logo */}
        <div style={{ padding:"20px 16px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{
              width:"36px", height:"36px",
              background:"var(--accent)",
              borderRadius:"10px",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"1.1rem", flexShrink:0,
              boxShadow:"0 4px 12px rgba(10,132,255,0.4)"
            }}>🧠</div>
            <div>
              <p style={{ fontWeight:"700", fontSize:"0.95rem", margin:0 }}>StudyBuddy</p>
              <p style={{ fontSize:"0.62rem", color:"var(--text-muted)", margin:0 }}>AI Study Companion</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
          {SIDEBAR_NAV.map(item => {
            const active = path===item.href
            return (
              <Link key={item.href} href={item.href} style={{
                display:"flex", alignItems:"center", gap:"10px",
                padding:"9px 10px", borderRadius:"var(--radius-md)",
                marginBottom:"2px", textDecoration:"none",
                background: active ? "rgba(10,132,255,0.12)" : "transparent",
                transition:"all 0.15s",
              }}>
                <span style={{ fontSize:"1rem", width:"20px", textAlign:"center" }}>{item.emoji}</span>
                <div>
                  <p style={{ fontSize:"0.82rem", fontWeight:active?"600":"400", color:active?"white":"var(--text-secondary)", margin:0 }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>{item.desc}</p>
                </div>
                {active && <div style={{ marginLeft:"auto", width:"4px", height:"4px", borderRadius:"50%", background:"var(--accent)", flexShrink:0, boxShadow:"0 0 6px var(--accent)" }}/>}
              </Link>
            )
          })}
        </nav>

        {/* Stats */}
        <div style={{ borderTop:"1px solid var(--border)", paddingBottom:"8px", flexShrink:0 }}>
          <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", padding:"10px 16px 4px", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.8px" }}>Today</p>
          <SidebarStats/>
        </div>

        {/* User */}
        <div style={{ borderTop:"1px solid var(--border)", padding:"12px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--green))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.75rem", fontWeight:"700", color:"white", flexShrink:0 }}>
              {userInitial}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:"0.78rem", fontWeight:"600", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userName||"Student"}</p>
              <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <div className="dot dot-green" style={{ width:"5px", height:"5px" }}/>
                <p style={{ fontSize:"0.6rem", color:"var(--text-muted)", margin:0 }}>Active</p>
              </div>
            </div>
            <button onClick={async()=>{ await signOut(); window.location.href="/login" }} style={{
              background:"rgba(255,255,255,0.06)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-sm)", color:"var(--text-muted)",
              padding:"4px 8px", fontSize:"0.62rem", cursor:"pointer"
            }}>Out</button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ marginLeft:"220px", flex:1, minHeight:"100vh", position:"relative" }}>
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav glass" style={{
        position:"fixed", bottom:0, left:0, right:0,
        borderTop:"1px solid var(--border)",
        padding:"8px 0 20px",
        zIndex:100, display:"none",
        justifyContent:"space-around", alignItems:"center",
      }}>
        {NAV.map(item => {
          const active = path===item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              gap:"3px", padding:"4px 12px", textDecoration:"none",
              flex:1, position:"relative"
            }}>
              {active && (
                <div style={{
                  position:"absolute", top:"-8px", left:"50%", transform:"translateX(-50%)",
                  width:"32px", height:"3px", borderRadius:"99px",
                  background:item.active_color,
                  boxShadow:`0 0 8px ${item.active_color}`
                }}/>
              )}
              <span style={{ fontSize:"1.3rem", filter:active?"none":"grayscale(0.3)", transition:"all 0.2s" }}>{item.emoji}</span>
              <span style={{ fontSize:"0.6rem", fontWeight:active?"700":"400", color:active?item.active_color:"var(--text-muted)", letterSpacing:"0.3px" }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

    </div>
  )
}
