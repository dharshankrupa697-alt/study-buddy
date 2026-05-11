"use client"
import { useState, useEffect } from "react"
import { getSessions, getUser, getRoadmap, getCurrentWeek, getProgress } from "@/lib/supabase"
import Link from "next/link"

interface Session {
  id: string
  subject?: string
  duration_minutes: number
  focus_score: number
  distractions: number
  avg_expression?: string
  created_at: string
}

const GOAL_COLORS: Record<string, string> = {
  competitive: "#7c6dfa",
  academic:    "#3ecf8e",
  coding:      "#60a5fa",
  skill:       "#fbbf24",
}

const EXPR_EMOJI: Record<string, string> = {
  happy:"😄", confused:"🤔", frustrated:"😤",
  surprised:"😮", sad:"😢", yawning:"🥱", neutral:"😐"
}

function scoreColor(s: number) {
  return s >= 80 ? "#3ecf8e" : s >= 60 ? "#fbbf24" : "#f87171"
}

export default function ReportsPage() {
  const [sessions,     setSessions]     = useState<Session[]>([])
  const [loading,      setLoading]      = useState(true)
  const [roadmap,      setRoadmap]      = useState<any>(null)
  const [goalType,     setGoalType]     = useState("")
  const [currentWeek,  setCurrentWeek]  = useState(1)
  const [progress,     setProgress]     = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { setLoading(false); return }
      const [sessionData, roadmapData, weekData, progressData] = await Promise.all([
        getSessions(user.id, 100),
        getRoadmap(user.id),
        getCurrentWeek(user.id),
        getProgress(user.id),
      ])
      setSessions(sessionData as Session[])
      setCurrentWeek(weekData)
      setProgress(progressData)
      if (roadmapData) {
        let rm = roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try {
            let clean=rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
            const parsed=JSON.parse(clean)
            if (parsed.weeks?.length>0) rm=parsed
          } catch {}
        }
        setRoadmap(rm)
        setGoalType(roadmapData.goal_type||"")
      }
      setLoading(false)
    }
    load()
  }, [])

  const color        = GOAL_COLORS[goalType] || "#7c6dfa"
  const totalSess    = sessions.length
  const totalMin     = sessions.reduce((a,s)=>a+s.duration_minutes,0)
  const totalHours   = (totalMin/60).toFixed(1)
  const avgFocus     = totalSess>0 ? Math.round(sessions.reduce((a,s)=>a+s.focus_score,0)/totalSess) : 0
  const totalDistr   = sessions.reduce((a,s)=>a+s.distractions,0)
  const bestSession  = sessions.reduce((best,s)=>s.focus_score>(best?.focus_score||0)?s:best, sessions[0])

  // Last 7 days
  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date()
    d.setDate(d.getDate()-(6-i))
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0")
    const dateStr=`${y}-${m}-${dd}`
    const daySess = sessions.filter(s=>{
      const sd=new Date(s.created_at)
      return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`===dateStr
    })
    return {
      day:d.toLocaleDateString("en",{weekday:"short"}),
      score:daySess.length>0?Math.round(daySess.reduce((a,s)=>a+s.focus_score,0)/daySess.length):0,
      hours:daySess.reduce((a,s)=>a+s.duration_minutes,0)/60,
      count:daySess.length,
    }
  })

  const maxHours = Math.max(...last7.map(d=>d.hours),0.1)
  const maxScore = 100

  // Roadmap phase progress
  const weeks = roadmap?.weeks||[]
  const phases: Record<string,{total:number;done:number;color:string}> = {}
  const PHASE_COLORS: Record<string,string> = {
    Foundation:"#60a5fa", Intensive:"#f87171", Consolidation:"#fbbf24",
    Revision:"#fbbf24", Final:"#3ecf8e", General:color
  }

  weeks.forEach((w:any,i:number)=>{
    const phase=w.phase||"General"
    const weekNum=w.week||i+1
    const tasks=w.tasks||[]
    const done=tasks.filter((_:any,ti:number)=>progress.some(p=>p.week_number===weekNum&&p.task_index===ti&&p.completed)).length
    const pc=Object.keys(PHASE_COLORS).find(k=>phase.toLowerCase().includes(k.toLowerCase()))||"General"
    if (!phases[phase]) phases[phase]={total:0,done:0,color:PHASE_COLORS[pc]}
    phases[phase].total+=tasks.length
    phases[phase].done+=done
  })

  const totalWeeks     = weeks.length
  const completedWeeks = weeks.filter((w:any,i:number)=>{
    const wn=w.week||i+1
    return (w.tasks||[]).every((_:any,ti:number)=>progress.some(p=>p.week_number===wn&&p.task_index===ti&&p.completed))
  }).length
  const overallPct = totalWeeks>0?Math.round((completedWeeks/totalWeeks)*100):0

  // SVG chart points
  const W=300, H=80
  const linePoints = last7.map((d,i)=>`${(i/(last7.length-1))*W},${H-(d.score/maxScore)*H}`).join(" ")

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",border:"3px solid rgba(124,109,250,0.2)",borderTop:"3px solid #7c6dfa",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading your reports...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:"100vh",padding:"2rem 1.5rem",maxWidth:"860px",margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"2rem"}}>
        <a href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</a>
        <div>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>Reports</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.8rem",margin:0}}>Your study analytics and progress</p>
        </div>
      </div>

      {totalSess===0 ? (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"3rem",textAlign:"center"}}>
          <div style={{fontSize:"3rem",marginBottom:"12px"}}>📊</div>
          <p style={{fontWeight:"600",marginBottom:"8px"}}>No sessions yet</p>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginBottom:"1.5rem"}}>Complete a focus session to see your analytics here</p>
          <Link href="/session" style={{background:"var(--accent)",borderRadius:"var(--radius-md)",padding:"10px 24px",color:"white",textDecoration:"none",fontWeight:"600",fontSize:"0.9rem"}}>Start a Session →</Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"1.5rem"}}>
            {[
              {label:"Study Time",    value:`${totalHours}h`,  sub:"total",        color:"var(--accent)"},
              {label:"Avg Focus",     value:String(avgFocus),  sub:"score",        color:scoreColor(avgFocus)},
              {label:"Sessions",      value:String(totalSess), sub:"completed",    color:"#60a5fa"},
              {label:"Distractions",  value:String(totalDistr),sub:"caught",       color:"#f87171"},
            ].map(c=>(
              <div key={c.label} style={{background:`${c.color}0d`,border:`1px solid ${c.color}22`,borderRadius:"var(--radius-lg)",padding:"1.2rem"}}>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:"0 0 6px",fontWeight:"500"}}>{c.label}</p>
                <p style={{fontSize:"1.8rem",fontWeight:"800",color:c.color,margin:"0 0 2px",lineHeight:1}}>{c.value}</p>
                <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>{c.sub}</p>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>

            {/* Focus trend chart */}
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <div>
                  <p style={{fontWeight:"600",fontSize:"0.9rem",margin:0}}>Focus Trend</p>
                  <p style={{color:"var(--text-muted)",fontSize:"0.72rem",margin:0}}>Last 7 days</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>Best day</p>
                  <p style={{fontWeight:"600",color:"#3ecf8e",fontSize:"0.82rem",margin:0}}>
                    {last7.reduce((b,d)=>d.score>b.score?d:b,last7[0]).day} · {last7.reduce((b,d)=>d.score>b.score?d:b,last7[0]).score}
                  </p>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"80px",overflow:"visible"}}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {[25,50,75].map(v=>(
                  <line key={v} x1="0" y1={H-(v/100)*H} x2={W} y2={H-(v/100)*H} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 3"/>
                ))}
                <polygon points={`0,${H} ${linePoints} ${W},${H}`} fill="url(#areaGrad)"/>
                <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                {last7.map((d,i)=>d.score>0&&(
                  <circle key={i} cx={(i/(last7.length-1))*W} cy={H-(d.score/maxScore)*H} r="4" fill={scoreColor(d.score)} stroke="var(--bg-card)" strokeWidth="2"/>
                ))}
              </svg>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px"}}>
                {last7.map(d=>(
                  <div key={d.day} style={{textAlign:"center"}}>
                    <p style={{fontSize:"0.6rem",color:"var(--text-muted)",margin:0}}>{d.day}</p>
                    <p style={{fontSize:"0.65rem",color:d.score>0?scoreColor(d.score):"var(--text-muted)",fontWeight:"600",margin:0}}>{d.score>0?d.score:"—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hours bar chart */}
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem"}}>
              <div style={{marginBottom:"16px"}}>
                <p style={{fontWeight:"600",fontSize:"0.9rem",margin:0}}>Study Hours</p>
                <p style={{color:"var(--text-muted)",fontSize:"0.72rem",margin:0}}>Last 7 days</p>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:"6px",height:"80px"}}>
                {last7.map((d,i)=>(
                  <div key={d.day} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",height:"100%"}}>
                    <span style={{fontSize:"0.58rem",color:"var(--text-muted)"}}>{d.hours>0?d.hours.toFixed(1):""}</span>
                    <div style={{width:"100%",flex:1,display:"flex",alignItems:"flex-end"}}>
                      <div style={{width:"100%",height:`${(d.hours/maxHours)*100}%`,background:d.hours>0?`${color}88`:"transparent",borderRadius:"4px 4px 0 0",minHeight:d.hours>0?"4px":"0",transition:"height 0.5s"}}/>
                    </div>
                    <span style={{fontSize:"0.6rem",color:"var(--text-muted)"}}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Roadmap progress */}
          {Object.keys(phases).length>0 && (
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem",marginBottom:"12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <div>
                  <p style={{fontWeight:"600",fontSize:"0.9rem",margin:0}}>🗺️ Roadmap Progress</p>
                  <p style={{color:"var(--text-muted)",fontSize:"0.72rem",margin:0}}>{completedWeeks}/{totalWeeks} weeks complete</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:"1.2rem",fontWeight:"800",color,margin:0}}>{overallPct}%</p>
                </div>
              </div>

              <div className="progress-bar" style={{marginBottom:"16px"}}>
                <div className="progress-fill" style={{width:`${overallPct}%`,background:`linear-gradient(90deg,${color},#3ecf8e)`}}/>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {Object.entries(phases).map(([phase,data])=>{
                  const pct=data.total>0?Math.round((data.done/data.total)*100):0
                  return (
                    <div key={phase}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                        <span style={{fontSize:"0.78rem",color:data.color,fontWeight:"500"}}>{phase}</span>
                        <div style={{display:"flex",gap:"8px"}}>
                          <span style={{fontSize:"0.72rem",color:"var(--text-muted)"}}>{data.done}/{data.total} tasks</span>
                          <span style={{fontSize:"0.72rem",fontWeight:"600",color:pct===100?"#3ecf8e":data.color}}>{pct}%</span>
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width:`${pct}%`,background:data.color}}/>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Link href="/roadmap" style={{display:"block",textAlign:"center",marginTop:"14px",background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:"var(--radius-md)",padding:"8px",color:"var(--accent)",textDecoration:"none",fontSize:"0.8rem",fontWeight:"600"}}>
                View Full Roadmap →
              </Link>
            </div>
          )}

          {/* AI Insights */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem",marginBottom:"12px"}}>
            <p style={{fontWeight:"600",fontSize:"0.9rem",margin:"0 0 12px"}}>🧠 AI Insights</p>
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {[
                avgFocus>=80
                  ?{icon:"🏆",text:`Excellent avg focus of ${avgFocus}! You're studying at peak performance.`,color:"#3ecf8e"}
                  :{icon:"📈",text:`Your avg focus is ${avgFocus}. Try Pomodoro technique to improve it.`,color:"#fbbf24"},
                completedWeeks>0
                  ?{icon:"🗺️",text:`${completedWeeks} of ${totalWeeks} roadmap weeks complete. Keep the momentum!`,color:color}
                  :{icon:"🗺️",text:"Start checking off tasks in your roadmap to track your progress!",color:color},
                totalSess>=5
                  ?{icon:"🔥",text:`${totalSess} sessions completed — great consistency!`,color:"#f87171"}
                  :{icon:"💪",text:`${totalSess} session${totalSess!==1?"s":""} done. Aim for at least 1 daily!`,color:"#f87171"},
                totalDistr>10
                  ?{icon:"📵",text:`${totalDistr} distractions caught. Try putting your phone in another room.`,color:"#fbbf24"}
                  :{icon:"🎯",text:`Only ${totalDistr} distractions — excellent focus discipline!`,color:"#3ecf8e"},
              ].map((ins,i)=>(
                <div key={i} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"10px 12px",background:`${ins.color}08`,border:`1px solid ${ins.color}18`,borderRadius:"var(--radius-md)"}}>
                  <span style={{fontSize:"1.1rem",flexShrink:0}}>{ins.icon}</span>
                  <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",lineHeight:1.5,margin:0}}>{ins.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem"}}>
            <p style={{fontWeight:"600",fontSize:"0.9rem",margin:"0 0 12px"}}>Recent Sessions</p>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {sessions.slice(0,8).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 12px",background:"var(--bg-elevated)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)"}}>
                  <span style={{fontSize:"1.2rem",flexShrink:0}}>{EXPR_EMOJI[s.avg_expression||"neutral"]||"😐"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:"0.82rem",fontWeight:"500",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {s.subject||"General Study"}
                    </p>
                    <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>
                      {new Date(s.created_at).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})} · {s.duration_minutes}min
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:"0.9rem",fontWeight:"700",color:scoreColor(s.focus_score),margin:0}}>{s.focus_score}</p>
                    <p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0}}>{s.distractions} distr.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
