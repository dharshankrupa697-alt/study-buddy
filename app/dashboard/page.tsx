"use client"
import { useState, useEffect } from "react"
import { getSessions, getUser, getRoadmap, getProgress, getCurrentWeek, getDailyTasks, getDailyCheckin } from "@/lib/supabase"
import Link from "next/link"

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
}

const GOAL_COLORS: Record<string,string> = {
  competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
}

const QUOTES = [
  "Every expert was once a beginner 💪",
  "Small daily improvements lead to stunning results 🎯",
  "Consistency beats intensity every single time 🔥",
  "The secret of getting ahead is getting started 🚀",
  "You don't have to be great to start, but you have to start to be great!",
  "Your future self is counting on you today 💪",
  "One day, one task, one step. You've got this! 🌟",
  "Success is the sum of small efforts repeated daily 💫",
]

function ActivityRing({ pct, color, size, strokeWidth, label, value }: {
  pct:number; color:string; size:number; strokeWidth:number; label:string; value:string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={`${color}22`} strokeWidth={strokeWidth}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize: size>80?"1.2rem":"0.85rem", fontWeight:"800", color, lineHeight:1 }}>{value}</span>
        </div>
      </div>
      <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", fontWeight:"500", margin:0, textAlign:"center" }}>{label}</p>
    </div>
  )
}

function WelcomePopup({ name, streak, quote, onClose }: { name:string; streak:number; quote:string; onClose:()=>void }) {
  const hour = new Date().getHours()
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening"

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.85)",
      backdropFilter:"blur(20px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"1.5rem", animation:"fadeIn 0.4s ease"
    }}>
      <div style={{
        background:"#1c1c1e",
        borderRadius:"var(--radius-2xl)",
        padding:"2.5rem 2rem",
        maxWidth:"360px", width:"100%",
        textAlign:"center",
        border:"1px solid rgba(255,255,255,0.08)",
        boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
        animation:"slideUp 0.4s ease"
      }}>
        {/* Emoji */}
        <div style={{ fontSize:"3.5rem", marginBottom:"1rem", animation:"fadeIn 0.5s ease 0.2s both" }}>
          {hour<12?"🌅":hour<17?"☀️":"🌙"}
        </div>

        {/* Greeting */}
        <p style={{ fontSize:"0.85rem", color:"var(--text-muted)", marginBottom:"4px", animation:"fadeIn 0.5s ease 0.3s both" }}>
          {greeting}
        </p>
        <h1 style={{ fontSize:"1.8rem", fontWeight:"700", marginBottom:"1.2rem", animation:"fadeIn 0.5s ease 0.35s both" }}>
          Hey, {name}! 👋
        </h1>

        {/* Streak */}
        {streak > 0 && (
          <div style={{
            background:"rgba(255,159,10,0.12)",
            border:"1px solid rgba(255,159,10,0.25)",
            borderRadius:"var(--radius-lg)",
            padding:"10px 16px",
            marginBottom:"1.2rem",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
            animation:"fadeIn 0.5s ease 0.4s both"
          }}>
            <span style={{ fontSize:"1.4rem" }}>🔥</span>
            <div>
              <p style={{ fontWeight:"700", color:"#ff9f0a", margin:0, fontSize:"0.95rem" }}>
                {streak} Day Streak!
              </p>
              <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:0 }}>Keep the momentum going!</p>
            </div>
          </div>
        )}

        {/* Quote */}
        <div style={{
          background:"rgba(255,255,255,0.04)",
          borderRadius:"var(--radius-lg)",
          padding:"14px 16px",
          marginBottom:"1.8rem",
          animation:"fadeIn 0.5s ease 0.45s both"
        }}>
          <p style={{ fontSize:"0.88rem", color:"var(--text-secondary)", lineHeight:1.7, margin:0, fontStyle:"italic" }}>
            "{quote}"
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={onClose}
          style={{
            width:"100%", padding:"16px",
            background:"linear-gradient(135deg,#0a84ff,#30d158)",
            border:"none", borderRadius:"var(--radius-xl)",
            color:"white", fontSize:"1rem", fontWeight:"700",
            cursor:"pointer",
            boxShadow:"0 8px 24px rgba(10,132,255,0.4)",
            animation:"fadeIn 0.5s ease 0.5s both",
            letterSpacing:"0.3px"
          }}
        >
          Let's do this! →
        </button>

        <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"12px", cursor:"pointer" }} onClick={onClose}>
          Skip for now
        </p>
      </div>
    </div>
  )
}


const MILESTONES = [3,7,14,30,60,100]

function StreakCard({ streak, best, studiedToday, color }: { streak:number; best:number; studiedToday:boolean; color:string }) {
  const nextMilestone = MILESTONES.find(m=>m>streak)||MILESTONES[MILESTONES.length-1]
  const prevMilestone = MILESTONES.filter(m=>m<=streak).pop()||0
  const pct = nextMilestone===prevMilestone?100:Math.round(((streak-prevMilestone)/(nextMilestone-prevMilestone))*100)
  const hour = new Date().getHours()
  const atRisk = !studiedToday && streak>0 && hour>=17

  const badge = streak>=100?"🏆 Legend":streak>=60?"💎 Diamond":streak>=30?"🥇 Gold":streak>=14?"🥈 Silver":streak>=7?"🥉 Bronze":streak>=3?"⭐ Rising":null

  return (
    <div style={{background:"var(--bg-card)",border:`1px solid ${atRisk?"rgba(255,69,58,0.3)":streak>0?"rgba(255,159,10,0.2)":"var(--border)"}`,borderRadius:"var(--radius-xl)",padding:"1.2rem",marginBottom:"1.2rem",position:"relative",overflow:"hidden"}}>
      {/* At-risk warning */}
      {atRisk&&(
        <div style={{background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.2)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"1rem"}}>⚠️</span>
          <p style={{fontSize:"0.8rem",color:"#ff453a",fontWeight:"600",margin:0}}>Streak at risk! Study today to keep your {streak}-day streak</p>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
        {/* Big fire + count */}
        <div style={{textAlign:"center",flexShrink:0}}>
          <div style={{fontSize:"2.5rem",lineHeight:1,marginBottom:"2px"}}>{streak>0?"🔥":"💤"}</div>
          <p style={{fontSize:"2rem",fontWeight:"800",color:streak>0?"#ff9f0a":"var(--text-muted)",margin:0,lineHeight:1}}>{streak}</p>
          <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0,fontWeight:"600"}}>DAY{streak!==1?"S":""}</p>
        </div>

        {/* Progress to next milestone */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <p style={{fontSize:"0.78rem",fontWeight:"600",margin:0}}>{studiedToday?"✅ Studied today":"📚 Study today!"}</p>
            {badge&&<span style={{fontSize:"0.68rem",fontWeight:"700",background:"rgba(255,159,10,0.12)",color:"#ff9f0a",border:"1px solid rgba(255,159,10,0.25)",borderRadius:"99px",padding:"2px 8px"}}>{badge}</span>}
          </div>
          <div style={{height:"6px",background:"var(--bg-elevated)",borderRadius:"99px",overflow:"hidden",marginBottom:"6px"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#ff9f0a,#ff6b00)",borderRadius:"99px",width:`${pct}%`,transition:"width 1s ease"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>{streak<nextMilestone?`${nextMilestone-streak} days to ${nextMilestone}-day milestone`:"🎯 Milestone reached!"}</p>
            {best>streak&&<p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>Best: {best}d</p>}
          </div>
        </div>
      </div>

      {/* Milestone dots */}
      <div style={{display:"flex",gap:"6px",marginTop:"12px",justifyContent:"center"}}>
        {MILESTONES.map(m=>(
          <div key={m} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
            <div style={{width:"28px",height:"28px",borderRadius:"50%",background:streak>=m?"linear-gradient(135deg,#ff9f0a,#ff6b00)":streak>0&&m===nextMilestone?"rgba(255,159,10,0.15)":"var(--bg-elevated)",border:`1.5px solid ${streak>=m?"#ff9f0a":streak>0&&m===nextMilestone?"rgba(255,159,10,0.4)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:"700",color:streak>=m?"white":streak>0&&m===nextMilestone?"#ff9f0a":"var(--text-muted)",transition:"all 0.3s"}}>
              {streak>=m?"✓":m}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [loading,      setLoading]      = useState(true)
  const [showWelcome,  setShowWelcome]  = useState(false)
  const [userName,     setUserName]     = useState("there")
  const [sessions,     setSessions]     = useState(0)
  const [hours,        setHours]        = useState("0.0")
  const [avgFocus,     setAvgFocus]     = useState(0)
  const [roadmap,      setRoadmap]      = useState<any>(null)
  const [goalType,     setGoalType]     = useState("")
  const [currentWeek,  setCurrentWeek]  = useState(1)
  const [progress,     setProgress]     = useState<any[]>([])
  const [todayTasks,   setTodayTasks]   = useState<any[]>([])
  const [todayCheckin, setTodayCheckin] = useState<any>(null)
  const [streak,       setStreak]       = useState(0)
  const [bestStreak,   setBestStreak]   = useState(0)
  const [studiedToday, setStudiedToday] = useState(false)
  const [quote,        setQuote]        = useState("")

  const load = async () => {
    const user = await getUser()
    if (!user) { setLoading(false); return }
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

    const todayS = sess.filter((s:any) => {
      const sd=new Date(s.created_at)
      return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`===today
    })
    setSessions(todayS.length)
    const totalMin = todayS.reduce((a:number,s:any)=>a+s.duration_minutes,0)
    setHours((totalMin/60).toFixed(1))
    setAvgFocus(todayS.length>0?Math.round(todayS.reduce((a:number,s:any)=>a+s.focus_score,0)/todayS.length):0)

    if (roadmapData) {
      let rm=roadmapData.roadmap
      if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
        try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
      }
      setRoadmap(rm)
      setGoalType(roadmapData.goal_type||"")
    }

    setProgress(progressData)
    setCurrentWeek(weekData)
    setTodayTasks(dailyTasks)
    setTodayCheckin(dailyCheckin)

    // Calculate current streak
    const toDay=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    const sessDay=(se:any)=>{ const sd=new Date(se.created_at); return toDay(sd) }
    let s=0, now=new Date()
    for (let i=0;i<365;i++) {
      const d=new Date(now); d.setDate(d.getDate()-i)
      const ds=toDay(d)
      if (sess.some((se:any)=>sessDay(se)===ds)) s++
      else if (i>0) break
    }
    setStreak(s)
    // Check if studied today
    setStudiedToday(sess.some((se:any)=>sessDay(se)===toDay(new Date())))
    // Calculate best streak
    const allDays=[...new Set(sess.map((se:any)=>sessDay(se)))].sort() as string[]
    let best=0, cur=0
    for (let i=0;i<allDays.length;i++) {
      if (i===0){cur=1}
      else {
        const diff=(new Date(allDays[i]).getTime()-new Date(allDays[i-1]).getTime())/(86400000)
        cur=diff<=1.5?cur+1:1
      }
      best=Math.max(best,cur)
    }
    setBestStreak(Math.max(best,s))
    setLoading(false)

    // Show welcome popup once per day
    const lastWelcome = localStorage.getItem("last_welcome")
    if (lastWelcome !== today) {
      setShowWelcome(true)
    }
  }

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random()*QUOTES.length)])
    load()
    window.addEventListener("focus", load)
    return () => window.removeEventListener("focus", load)
  }, [])

  const handleWelcomeClose = () => {
    setShowWelcome(false)
    localStorage.setItem("last_welcome", getTodayLocal())
  }

  const color = GOAL_COLORS[goalType] || "#0a84ff"
  const weeks = roadmap?.weeks||[]
  const weekData = weeks.find((w:any)=>(w.week||0)===currentWeek)||weeks[0]
  const tasks = weekData?.tasks||[]
  const isTaskDone = (weekNum:number,i:number) => progress.some(p=>p.week_number===weekNum&&p.task_index===i&&p.completed)
  const doneTasks = tasks.filter((_:any,i:number)=>isTaskDone(currentWeek,i)).length
  const weekPct = tasks.length>0?Math.round((doneTasks/tasks.length)*100):0
  const totalWeeks = weeks.length
  const completedWeeks = weeks.filter((w:any,i:number)=>{ const wn=w.week||i+1; return (w.tasks||[]).every((_:any,ti:number)=>isTaskDone(wn,ti)) }).length
  const overallPct = totalWeeks>0?Math.round((completedWeeks/totalWeeks)*100):0
  const focusPct = avgFocus
  const dailyDone = todayTasks.filter(t=>t.completed).length
  const dailyTotal = todayTasks.length
  const dailyPct = dailyTotal>0?Math.round((dailyDone/dailyTotal)*100):0
  const greeting = new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"36px",height:"36px",border:"3px solid rgba(10,132,255,0.2)",borderTop:"3px solid #0a84ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading...</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Welcome popup */}
      {showWelcome && (
        <WelcomePopup name={userName} streak={streak} quote={quote} onClose={handleWelcomeClose}/>
      )}

      <div style={{minHeight:"100vh",padding:"1.5rem",maxWidth:"800px",margin:"0 auto"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.8rem"}}>
          <div>
            <p style={{fontSize:"0.82rem",color:"var(--text-muted)",margin:0}}>{greeting}</p>
            <h1 style={{fontSize:"1.6rem",fontWeight:"700",margin:0}}>
              Hey, <span style={{color:"var(--accent)"}}>{userName}</span> 👋
            </h1>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            {streak>0 && (
              <div style={{background:"rgba(255,159,10,0.12)",border:"1px solid rgba(255,159,10,0.2)",borderRadius:"var(--radius-md)",padding:"6px 12px",display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontSize:"1rem"}}>🔥</span>
                <span style={{fontSize:"0.82rem",fontWeight:"700",color:"#ff9f0a"}}>{streak}d</span>
              </div>
            )}
            <Link href="/chat" style={{textDecoration:"none"}}>
              <div style={{background:"rgba(10,132,255,0.12)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:"var(--radius-md)",padding:"6px 12px",display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontSize:"0.85rem"}}>💬</span>
                <span style={{fontSize:"0.78rem",color:"var(--accent)",fontWeight:"600"}}>AI Tutor</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Activity Rings */}
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem",marginBottom:"1.2rem"}}>
          <p className="section-title" style={{marginBottom:"1.2rem"}}>Today's Activity</p>
          <div style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>
            <ActivityRing pct={Math.min(100,parseFloat(hours)*50)} color="#ff453a" size={90} strokeWidth={8} label="Study Time" value={`${hours}h`}/>
            <ActivityRing pct={focusPct} color="#30d158" size={90} strokeWidth={8} label="Focus Score" value={focusPct>0?String(focusPct):"--"}/>
            <ActivityRing pct={dailyPct} color="#0a84ff" size={90} strokeWidth={8} label="Daily Tasks" value={`${dailyDone}/${dailyTotal}`}/>
          </div>
        </div>

        {/* Streak card */}
        <StreakCard streak={streak} best={bestStreak} studiedToday={studiedToday} color={color}/>

        {/* Today's priority task */}
        <div style={{marginBottom:"1.2rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
            <p className="section-title" style={{margin:0}}>Today's Priority</p>
            <Link href="/calendar" style={{fontSize:"0.75rem",color:"var(--accent)",textDecoration:"none",fontWeight:"600"}}>
              View all →
            </Link>
          </div>

          {todayTasks.length===0 ? (
            <Link href="/calendar" style={{textDecoration:"none",display:"block"}}>
              <div style={{
                background:"linear-gradient(135deg,rgba(10,132,255,0.12),rgba(48,209,88,0.08))",
                border:"1px solid rgba(10,132,255,0.25)",
                borderRadius:"var(--radius-xl)",
                padding:"1.5rem",
                display:"flex",alignItems:"center",gap:"16px",
                cursor:"pointer",
                boxShadow:"0 0 0 0 rgba(10,132,255,0)",
                animation:"glow 3s ease infinite"
              }}>
                <div style={{width:"48px",height:"48px",borderRadius:"var(--radius-md)",background:"rgba(10,132,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0,border:"1px solid rgba(10,132,255,0.3)"}}>
                  📋
                </div>
                <div style={{flex:1}}>
                  <p style={{fontWeight:"700",fontSize:"0.95rem",margin:"0 0 4px",color:"var(--accent)"}}>Generate Today's Tasks</p>
                  <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:0}}>Tap to create your personalised daily study plan</p>
                </div>
                <span style={{fontSize:"1.2rem",color:"var(--accent)"}}>✨</span>
              </div>
            </Link>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {todayTasks.slice(0,3).map((task:any,i:number)=>(
                <div key={task.id} style={{
                  background:task.completed?"rgba(48,209,88,0.06)":"var(--bg-card)",
                  border:`1px solid ${task.completed?"rgba(48,209,88,0.2)":"var(--border)"}`,
                  borderRadius:"var(--radius-lg)",
                  padding:"14px 16px",
                  display:"flex",alignItems:"center",gap:"14px",
                  transition:"all 0.2s",
                  animation:`fadeIn 0.3s ease ${i*0.1}s both`
                }}>
                  <div style={{width:"22px",height:"22px",borderRadius:"50%",flexShrink:0,background:task.completed?"#30d158":"transparent",border:`2px solid ${task.completed?"#30d158":"var(--text-subtle)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:"white",fontWeight:"700"}}>
                    {task.completed?"✓":""}
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:"0.9rem",fontWeight:"500",margin:0,color:task.completed?"var(--text-muted)":"var(--text-primary)",textDecoration:task.completed?"line-through":"none"}}>{task.topic}</p>
                    <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{task.description}</p>
                  </div>
                  <span style={{fontSize:"0.72rem",color:"var(--accent)",fontWeight:"600",flexShrink:0}}>{task.hours}h</span>
                  {!task.completed && (
                    <Link href={`/session?week=${currentWeek}&task=0`} style={{textDecoration:"none",flexShrink:0}}>
                      <span style={{fontSize:"0.7rem",fontWeight:"700",color:"white",background:"var(--accent)",borderRadius:"var(--radius-sm)",padding:"4px 10px",display:"block",whiteSpace:"nowrap"}}>Study →</span>
                    </Link>
                  )}
                </div>
              ))}

              {!todayCheckin && (
                <Link href="/calendar" style={{textDecoration:"none",display:"block"}}>
                  <div style={{background:"rgba(255,159,10,0.06)",border:"1px solid rgba(255,159,10,0.2)",borderRadius:"var(--radius-lg)",padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer"}}>
                    <span style={{fontSize:"1.2rem"}}>✅</span>
                    <p style={{fontSize:"0.85rem",fontWeight:"600",color:"#ff9f0a",margin:0}}>End of day check-in →</p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Roadmap progress */}
        {weekData && (
          <div style={{marginBottom:"1.2rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <p className="section-title" style={{margin:0}}>Roadmap Progress</p>
              <Link href="/roadmap" style={{fontSize:"0.75rem",color:"var(--accent)",textDecoration:"none",fontWeight:"600"}}>View →</Link>
            </div>
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.2rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <div>
                  <div style={{display:"flex",gap:"6px",marginBottom:"6px"}}>
                    <span style={{background:`${color}15`,color,border:`1px solid ${color}30`,borderRadius:"99px",padding:"2px 10px",fontSize:"0.68rem",fontWeight:"600"}}>{weekData.phase}</span>
                    <span style={{background:"rgba(255,255,255,0.06)",color:"var(--text-muted)",borderRadius:"99px",padding:"2px 10px",fontSize:"0.68rem"}}>Week {currentWeek}/{totalWeeks}</span>
                  </div>
                  <p style={{fontSize:"0.88rem",fontWeight:"600",margin:0,color:"var(--text-primary)"}}>{weekData.focus}</p>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:"12px"}}>
                  <p style={{fontSize:"1.4rem",fontWeight:"800",color,margin:0,lineHeight:1}}>{weekPct}%</p>
                  <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>this week</p>
                </div>
              </div>
              <div className="progress-bar" style={{marginBottom:"8px"}}>
                <div className="progress-fill" style={{width:`${weekPct}%`,background:`linear-gradient(90deg,${color},${color}88)`}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{doneTasks}/{tasks.length} tasks done</p>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>Overall: {overallPct}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div style={{marginBottom:"1.5rem"}}>
          <p className="section-title" style={{marginBottom:"10px"}}>Quick Actions</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {[
              {label:"Study",    emoji:"🎯", href:"/session",    color:"#30d158", bg:"rgba(48,209,88,0.08)"},
              {label:"Roadmap",  emoji:"🗺️", href:"/roadmap",    color:"#bf5af2", bg:"rgba(191,90,242,0.08)"},
              {label:"Reports",  emoji:"📊", href:"/reports",    color:"#ff9f0a", bg:"rgba(255,159,10,0.08)"},
              {label:"Methods",  emoji:"📚", href:"/techniques", color:"#5ac8fa", bg:"rgba(90,200,250,0.08)"},
            ].map(item=>(
              <Link key={item.href} href={item.href} style={{textDecoration:"none"}}>
                <div style={{background:item.bg,border:`1px solid ${item.color}20`,borderRadius:"var(--radius-lg)",padding:"14px 8px",textAlign:"center",transition:"all 0.2s"}}>
                  <span style={{fontSize:"1.4rem",display:"block",marginBottom:"6px"}}>{item.emoji}</span>
                  <p style={{fontSize:"0.72rem",fontWeight:"600",color:item.color,margin:0}}>{item.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Start session CTA */}
        <Link href={`/session?week=${currentWeek}&task=0`} style={{textDecoration:"none",display:"block"}}>
          <div style={{
            background:"linear-gradient(135deg,#0a84ff,#30d158)",
            borderRadius:"var(--radius-xl)",
            padding:"1.4rem 1.8rem",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            cursor:"pointer",
            boxShadow:"0 8px 32px rgba(10,132,255,0.35)"
          }}>
            <div>
              <p style={{fontSize:"1.1rem",fontWeight:"700",color:"white",margin:"0 0 4px"}}>Start Focus Session</p>
              <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.75)",margin:0}}>Webcam AI · Expression tracking · Smart alerts</p>
            </div>
            <div style={{background:"rgba(255,255,255,0.2)",borderRadius:"var(--radius-md)",padding:"10px 18px",flexShrink:0}}>
              <span style={{color:"white",fontWeight:"700",fontSize:"0.9rem"}}>Go 🎯</span>
            </div>
          </div>
        </Link>

      </div>
    </>
  )
}
