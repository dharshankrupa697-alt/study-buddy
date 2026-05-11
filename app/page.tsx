"use client"
import { useState, useEffect } from "react"
import { getSessions, getUser, getRoadmap, getProgress, getCurrentWeek, getDailyTasks, getDailyCheckin } from "@/lib/supabase"
import Link from "next/link"

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
}

const GOAL_COLORS: Record<string, string> = {
  competitive: "#7c6dfa",
  academic:    "#3ecf8e",
  coding:      "#60a5fa",
  skill:       "#fbbf24",
}

export default function Dashboard() {
  const [userName,     setUserName]     = useState("there")
  const [sessions,     setSessions]     = useState(0)
  const [hours,        setHours]        = useState("0.0")
  const [avgFocus,     setAvgFocus]     = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [roadmap,      setRoadmap]      = useState<any>(null)
  const [goalType,     setGoalType]     = useState("")
  const [currentWeek,  setCurrentWeek]  = useState(1)
  const [progress,     setProgress]     = useState<any[]>([])
  const [todayTasks,   setTodayTasks]   = useState<any[]>([])
  const [todayCheckin, setTodayCheckin] = useState<any>(null)

  const load = async () => {
    const user = await getUser()
    if (!user) { window.location.href = "/login"; return }
    setUserName(user.user_metadata?.name?.split(" ")[0] || "there")

    const today = getTodayLocal()

    const [sess, roadmapData, progressData, weekData, dailyTasks, dailyCheckin] = await Promise.all([
      getSessions(user.id, 100),
      getRoadmap(user.id),
      getProgress(user.id),
      getCurrentWeek(user.id),
      getDailyTasks(user.id, today),
      getDailyCheckin(user.id, today),
    ])

    // Today's sessions
    const todayS = sess.filter((s: any) => {
      const sd = new Date(s.created_at)
      return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}` === today
    })
    setSessions(todayS.length)
    const totalMin = todayS.reduce((a: number, s: any) => a + s.duration_minutes, 0)
    setHours((totalMin / 60).toFixed(1))
    setAvgFocus(todayS.length > 0 ? Math.round(todayS.reduce((a: number, s: any) => a + s.focus_score, 0) / todayS.length) : 0)

    // Roadmap
    if (roadmapData) {
      let rm = roadmapData.roadmap
      if ((!rm?.weeks || rm.weeks.length === 0) && typeof rm?.overview === "string") {
        try {
          let clean = rm.overview.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
          const parsed = JSON.parse(clean)
          if (parsed.weeks?.length > 0) rm = parsed
        } catch {}
      }
      setRoadmap(rm)
      setGoalType(roadmapData.goal_type || "")
    }

    setProgress(progressData)
    setCurrentWeek(weekData)
    setTodayTasks(dailyTasks)
    setTodayCheckin(dailyCheckin)
    setLoading(false)
  }

  useEffect(() => {
    load()
    window.addEventListener("focus", load)
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load() })
    return () => window.removeEventListener("focus", load)
  }, [])

  const color          = GOAL_COLORS[goalType] || "#7c6dfa"
  const weeks          = roadmap?.weeks || []
  const weekData       = weeks.find((w: any) => (w.week || 0) === currentWeek) || weeks[0]
  const tasks          = weekData?.tasks || []
  const isTaskDone     = (weekNum: number, i: number) => progress.some(p => p.week_number === weekNum && p.task_index === i && p.completed)
  const doneTasks      = tasks.filter((_: any, i: number) => isTaskDone(currentWeek, i)).length
  const weekPct        = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0
  const totalWeeks     = weeks.length
  const completedWeeks = weeks.filter((w: any, i: number) => {
    const wn = w.week || i + 1
    return (w.tasks || []).every((_: any, ti: number) => isTaskDone(wn, ti))
  }).length
  const overallPct  = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0
  const focusColor  = avgFocus >= 70 ? "#3ecf8e" : avgFocus >= 40 ? "#fbbf24" : "#f87171"
  const greeting    = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"

  const dailyDone = todayTasks.filter(t => t.completed).length
  const dailyTotal = todayTasks.length
  const dailyPct  = dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 100) : 0

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", border:"3px solid rgba(124,109,250,0.2)", borderTop:"3px solid #7c6dfa", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
        <p style={{ color:"var(--text-muted)", fontSize:"0.85rem" }}>Loading your dashboard...</p>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:"100vh", padding:"2rem 1.5rem", maxWidth:"860px", margin:"0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom:"2rem" }}>
        <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", marginBottom:"4px" }}>{greeting} 👋</p>
        <h1 style={{ fontSize:"1.8rem", fontWeight:"700", margin:0 }}>
          Welcome back, <span style={{ color:"var(--accent)" }}>{userName}</span>!
        </h1>
        <p style={{ color:"var(--text-muted)", fontSize:"0.88rem", marginTop:"4px" }}>
          {sessions === 0 ? "Ready to start studying today?" : `You've had ${sessions} session${sessions>1?"s":""} today. Keep it up!`}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"1.5rem" }}>
        {[
          { label:"Sessions Today", value:String(sessions),             sub:"focus sessions", color:"var(--accent)",  bg:"var(--accent-soft)",          border:"var(--accent-border)" },
          { label:"Study Time",     value:`${hours}h`,                  sub:"hours logged",   color:"#3ecf8e",        bg:"rgba(62,207,142,0.08)",        border:"rgba(62,207,142,0.2)" },
          { label:"Avg Focus",      value:avgFocus>0?String(avgFocus):"--", sub:"focus score", color:focusColor,     bg:`${focusColor}15`,              border:`${focusColor}33` },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:"var(--radius-lg)", padding:"1.2rem", transition:"all 0.2s" }}>
            <p style={{ fontSize:"0.75rem", color:"var(--text-muted)", fontWeight:"500", margin:"0 0 8px" }}>{s.label}</p>
            <p style={{ fontSize:"2rem", fontWeight:"700", color:s.color, margin:"0 0 2px", lineHeight:1 }}>{s.value}</p>
            <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily tasks widget */}
      {todayTasks.length > 0 && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1.2rem", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <div>
              <p style={{ fontWeight:"600", fontSize:"0.88rem", margin:0 }}>📋 Today's Tasks</p>
              <p style={{ fontSize:"0.7rem", color:"var(--text-muted)", margin:0 }}>{dailyDone}/{dailyTotal} done · {dailyPct}%</p>
            </div>
            {todayCheckin ? (
              <span style={{ fontSize:"0.75rem", fontWeight:"600", color:todayCheckin.status==="completed"?"#3ecf8e":todayCheckin.status==="partial"?"#fbbf24":"#f87171" }}>
                {todayCheckin.status==="completed"?"✅ Done":todayCheckin.status==="partial"?"⚠️ Partial":"❌ Missed"}
              </span>
            ) : (
              <Link href="/calendar" style={{ fontSize:"0.75rem", color:"var(--accent)", textDecoration:"none", fontWeight:"600" }}>
                Check in →
              </Link>
            )}
          </div>
          <div className="progress-bar" style={{ marginBottom:"10px" }}>
            <div className="progress-fill" style={{ width:`${dailyPct}%`, background:color }}/>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {todayTasks.slice(0,3).map((task: any) => (
              <div key={task.id} style={{ display:"flex", gap:"8px", alignItems:"center", padding:"7px 10px", borderRadius:"var(--radius-md)", background:task.completed?"rgba(62,207,142,0.06)":"var(--bg-elevated)", border:`1px solid ${task.completed?"rgba(62,207,142,0.2)":"var(--border)"}` }}>
                <div style={{ width:"14px", height:"14px", borderRadius:"3px", background:task.completed?"#3ecf8e":"transparent", border:`2px solid ${task.completed?"#3ecf8e":"var(--text-muted)"}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.55rem", color:"white" }}>
                  {task.completed?"✓":""}
                </div>
                <p style={{ fontSize:"0.78rem", margin:0, color:task.completed?"var(--text-muted)":"var(--text-primary)", textDecoration:task.completed?"line-through":"none", flex:1 }}>{task.topic}</p>
                <span style={{ fontSize:"0.65rem", color:"var(--text-muted)" }}>{task.hours}h</span>
              </div>
            ))}
            {todayTasks.length > 3 && (
              <Link href="/calendar" style={{ textAlign:"center", fontSize:"0.75rem", color:"var(--text-muted)", display:"block", padding:"4px", textDecoration:"none" }}>
                +{todayTasks.length-3} more tasks →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:"12px", marginBottom:"1.5rem" }}>

        {/* Current week card */}
        {weekData ? (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1.5rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
                  <span style={{ background:`${color}15`, color, border:`1px solid ${color}33`, borderRadius:"var(--radius-sm)", padding:"3px 10px", fontSize:"0.72rem", fontWeight:"600" }}>
                    {weekData.phase || "Current Phase"}
                  </span>
                  <span style={{ background:"var(--bg-elevated)", color:"var(--text-muted)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"3px 10px", fontSize:"0.72rem" }}>
                    Week {currentWeek} of {totalWeeks}
                  </span>
                </div>
                <h2 style={{ fontSize:"1rem", fontWeight:"600", margin:0, lineHeight:1.4, color:"var(--text-primary)" }}>
                  {weekData.focus}
                </h2>
              </div>
              <div style={{ textAlign:"center", flexShrink:0, marginLeft:"16px" }}>
                <p style={{ fontSize:"1.5rem", fontWeight:"800", color, margin:0 }}>{weekPct}%</p>
                <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", margin:0 }}>this week</p>
              </div>
            </div>

            <div className="progress-bar" style={{ marginBottom:"1.2rem" }}>
              <div className="progress-fill" style={{ width:`${weekPct}%`, background:`linear-gradient(90deg,${color},${color}88)` }}/>
            </div>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                <p style={{ fontSize:"0.78rem", fontWeight:"600", color:"var(--text-secondary)", margin:0 }}>Weekly Tasks</p>
                <span style={{ fontSize:"0.72rem", color, fontWeight:"600" }}>{doneTasks}/{tasks.length} done</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {tasks.slice(0, 3).map((task: string, i: number) => {
                  const done = isTaskDone(currentWeek, i)
                  return (
                    <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"10px 12px", borderRadius:"var(--radius-md)", background:done?`${color}0a`:"var(--bg-elevated)", border:`1px solid ${done?color+"22":"var(--border)"}` }}>
                      <div style={{ width:"18px", height:"18px", borderRadius:"5px", flexShrink:0, marginTop:"1px", background:done?color:"transparent", border:`2px solid ${done?color:"var(--text-muted)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", color:"white", fontWeight:"700" }}>{done?"✓":""}</div>
                      <p style={{ fontSize:"0.82rem", margin:0, color:done?"var(--text-muted)":"var(--text-primary)", textDecoration:done?"line-through":"none", lineHeight:1.5 }}>{task}</p>
                    </div>
                  )
                })}
                {tasks.length > 3 && (
                  <Link href="/roadmap" style={{ textAlign:"center", fontSize:"0.75rem", color:"var(--text-muted)", display:"block", padding:"6px", textDecoration:"none" }}>
                    +{tasks.length-3} more tasks → View full roadmap
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"2rem", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"12px", textAlign:"center" }}>
            <span style={{ fontSize:"3rem" }}>🗺️</span>
            <p style={{ fontWeight:"600", margin:0 }}>No roadmap yet</p>
            <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", margin:0 }}>Sign up with a goal to get your AI study plan</p>
          </div>
        )}

        {/* Right column */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>

          {/* Overall roadmap */}
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1.2rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
              <p style={{ fontSize:"0.78rem", fontWeight:"600", color:"var(--text-secondary)", margin:0 }}>Overall Roadmap</p>
              <span style={{ fontSize:"0.88rem", fontWeight:"700", color:"var(--accent)" }}>{overallPct}%</span>
            </div>
            <div className="progress-bar" style={{ marginBottom:"8px" }}>
              <div className="progress-fill" style={{ width:`${overallPct}%`, background:"linear-gradient(90deg,var(--accent),#3ecf8e)" }}/>
            </div>
            <p style={{ fontSize:"0.7rem", color:"var(--text-muted)", margin:0 }}>{completedWeeks} of {totalWeeks} weeks complete</p>
          </div>

          {/* Focus score */}
          {avgFocus > 0 && (
            <div style={{ background:`${focusColor}0a`, border:`1px solid ${focusColor}22`, borderRadius:"var(--radius-lg)", padding:"1.2rem", textAlign:"center" }}>
              <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:"0 0 6px", fontWeight:"500" }}>Today's Focus Score</p>
              <p style={{ fontSize:"2.5rem", fontWeight:"800", color:focusColor, margin:"0 0 4px" }}>{avgFocus}</p>
              <p style={{ fontSize:"0.72rem", color:focusColor, margin:0, fontWeight:"600" }}>
                {avgFocus>=80?"🎯 Excellent!":avgFocus>=60?"👍 Good":"😐 Needs work"}
              </p>
            </div>
          )}

          {/* Calendar quick link */}
          <Link href="/calendar" style={{ textDecoration:"none" }}>
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1.2rem", cursor:"pointer", transition:"all 0.2s" }}>
              <p style={{ fontSize:"0.72rem", fontWeight:"600", color:"var(--text-muted)", margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>📅 Today</p>
              <p style={{ fontSize:"0.88rem", fontWeight:"600", margin:"0 0 4px" }}>
                {dailyTotal>0?`${dailyDone}/${dailyTotal} daily tasks`:"No daily tasks yet"}
              </p>
              <p style={{ fontSize:"0.75rem", color:"var(--accent)", margin:0 }}>
                {todayCheckin?"Check-in done ✅":"Check in now →"}
              </p>
            </div>
          </Link>

          {/* Quick tip */}
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1.2rem" }}>
            <p style={{ fontSize:"0.7rem", fontWeight:"600", color:"var(--text-muted)", margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"0.5px" }}>💡 Tip</p>
            <p style={{ fontSize:"0.8rem", color:"var(--text-secondary)", margin:0, lineHeight:1.6 }}>
              {avgFocus>=80?"Peak focus! Tackle your hardest topics now.":
               avgFocus>=60?"Good momentum. Try Pomodoro to push further.":
               sessions===0?"Start a session to begin tracking your focus today.":
               "Consistency beats intensity. Show up every day."}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom:"1.5rem" }}>
        <p style={{ fontSize:"0.78rem", fontWeight:"600", color:"var(--text-muted)", margin:"0 0 10px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Quick Actions</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px" }}>
          {[
            { label:"Study Room",  desc:"Start session",    href:"/session",    color:"var(--accent)", emoji:"🎯" },
            { label:"AI Tutor",    desc:"Ask anything",     href:"/chat",       color:"#60a5fa",       emoji:"💬" },
            { label:"My Roadmap",  desc:`Week ${currentWeek}`, href:"/roadmap", color,                 emoji:"🗺️" },
            { label:"Calendar",    desc:"Daily tasks",      href:"/calendar",   color:"#fbbf24",       emoji:"📅" },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration:"none" }}>
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1rem", textAlign:"center", transition:"all 0.2s", cursor:"pointer" }}>
                <span style={{ fontSize:"1.4rem", display:"block", marginBottom:"6px" }}>{item.emoji}</span>
                <p style={{ fontSize:"0.78rem", fontWeight:"600", color:"var(--text-primary)", margin:"0 0 2px" }}>{item.label}</p>
                <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", margin:0 }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Start session CTA */}
      <Link href="/session" style={{ textDecoration:"none", display:"block" }}>
        <div style={{ background:"linear-gradient(135deg,var(--accent-soft),rgba(62,207,142,0.08))", border:"1px solid var(--accent-border)", borderRadius:"var(--radius-xl)", padding:"1.2rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", transition:"all 0.2s" }}>
          <div>
            <p style={{ fontSize:"1rem", fontWeight:"700", color:"var(--text-primary)", margin:"0 0 2px" }}>Start a Focus Session</p>
            <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", margin:0 }}>Webcam AI · Expression tracking · Roadmap integration</p>
          </div>
          <div style={{ background:"var(--accent)", color:"white", borderRadius:"var(--radius-md)", padding:"10px 20px", fontWeight:"600", fontSize:"0.88rem", flexShrink:0 }}>
            Let's go →
          </div>
        </div>
      </Link>

    </div>
  )
}
