"use client"
import { useState, useEffect } from "react"
import { getSessions, getUser, getRoadmap, getCurrentWeek, getProgress } from "@/lib/supabase"
import Link from "next/link"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
}

const EXPR_EMOJI: Record<string,string> = {
  happy:"😄", confused:"🤔", frustrated:"😤", surprised:"😮", sad:"😢", yawning:"🥱", neutral:"😐"
}

function sc(s:number) { return s>=70?"#30d158":s>=40?"#ff9f0a":"#ff453a" }

function MiniRing({pct,color,size=48,stroke=5}:{pct:number;color:string;size?:number;stroke?:number}) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, offset=circ-(pct/100)*circ
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}22`} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circ}`} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{transition:"stroke-dashoffset 1s ease"}}
        />
      </svg>
    </div>
  )
}

export default function ReportsPage() {
  const [sessions,    setSessions]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [roadmap,     setRoadmap]     = useState<any>(null)
  const [goalType,    setGoalType]    = useState("")
  const [currentWeek, setCurrentWeek] = useState(1)
  const [progress,    setProgress]    = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { window.location.href="/login"; return }
      const [sessionData, roadmapData, weekData, progressData] = await Promise.all([
        getSessions(user.id,100), getRoadmap(user.id), getCurrentWeek(user.id), getProgress(user.id)
      ])
      setSessions(sessionData); setCurrentWeek(weekData); setProgress(progressData)
      if (roadmapData) {
        let rm=roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
        }
        setRoadmap(rm); setGoalType(roadmapData.goal_type||"")
      }
      setLoading(false)
    }
    load()
  }, [])

  const color       = GOAL_COLORS[goalType]||"#0a84ff"
  const totalSess   = sessions.length
  const totalMin    = sessions.reduce((a,s)=>a+s.duration_minutes,0)
  const totalHours  = (totalMin/60).toFixed(1)
  const avgFocus    = totalSess>0?Math.round(sessions.reduce((a,s)=>a+s.focus_score,0)/totalSess):0
  const totalDistr  = sessions.reduce((a,s)=>a+s.distractions,0)

  // Last 7 days
  const last7=Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i))
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0")
    const dateStr=`${y}-${m}-${dd}`
    const daySess=sessions.filter(s=>{ const sd=new Date(s.created_at); return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`===dateStr })
    return { day:d.toLocaleDateString("en",{weekday:"short"}), score:daySess.length>0?Math.round(daySess.reduce((a,s)=>a+s.focus_score,0)/daySess.length):0, hours:daySess.reduce((a,s)=>a+s.duration_minutes,0)/60, count:daySess.length }
  })
  const maxHours=Math.max(...last7.map(d=>d.hours),0.5)

  // Roadmap phases
  const weeks=roadmap?.weeks||[]
  const phases: Record<string,{total:number;done:number;color:string}>={}
  const PHASE_COLORS: Record<string,string>={Foundation:"#5ac8fa",Intensive:"#ff453a",Consolidation:"#ff9f0a",Revision:"#ff9f0a",Final:"#30d158",General:color}
  weeks.forEach((w:any,i:number)=>{
    const phase=w.phase||"General", weekNum=w.week||i+1, tasks=w.tasks||[]
    const done=tasks.filter((_:any,ti:number)=>progress.some(p=>p.week_number===weekNum&&p.task_index===ti&&p.completed)).length
    const pc=Object.keys(PHASE_COLORS).find(k=>phase.toLowerCase().includes(k.toLowerCase()))||"General"
    if (!phases[phase]) phases[phase]={total:0,done:0,color:PHASE_COLORS[pc]}
    phases[phase].total+=tasks.length; phases[phase].done+=done
  })

  const totalWeeks=weeks.length
  const completedWeeks=weeks.filter((w:any,i:number)=>{const wn=w.week||i+1;return(w.tasks||[]).every((_:any,ti:number)=>progress.some(p=>p.week_number===wn&&p.task_index===ti&&p.completed))}).length
  const overallPct=totalWeeks>0?Math.round((completedWeeks/totalWeeks)*100):0

  // SVG line
  const LW=300,LH=70
  const linePoints=last7.map((d,i)=>`${(i/(last7.length-1))*LW},${LH-(d.score/100)*LH}`).join(" ")

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"36px",height:"36px",border:"3px solid rgba(10,132,255,0.2)",borderTop:"3px solid #0a84ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading reports...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:"100vh",padding:"1.5rem",maxWidth:"760px",margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1.8rem"}}>
        <Link href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</Link>
        <div>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>Reports</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.78rem",margin:0}}>Your study analytics</p>
        </div>
      </div>

      {totalSess===0?(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"3rem",textAlign:"center"}}>
          <div style={{fontSize:"3rem",marginBottom:"12px",opacity:0.4}}>📊</div>
          <p style={{fontWeight:"600",marginBottom:"8px",color:"var(--text-secondary)"}}>No sessions yet</p>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginBottom:"1.5rem"}}>Complete a focus session to see your analytics</p>
          <Link href="/session" style={{background:"var(--accent)",borderRadius:"var(--radius-xl)",padding:"12px 24px",color:"white",textDecoration:"none",fontWeight:"700",fontSize:"0.9rem",boxShadow:"0 4px 16px rgba(10,132,255,0.3)"}}>Start a Session →</Link>
        </div>
      ):(
        <>
          {/* Stat cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginBottom:"1.2rem"}}>
            {[
              {label:"Study Time",   value:`${totalHours}h`, sub:"total",     color:"var(--accent)",  pct:Math.min(100,parseFloat(totalHours)*5) },
              {label:"Avg Focus",    value:String(avgFocus), sub:"score",     color:sc(avgFocus),     pct:avgFocus },
              {label:"Sessions",     value:String(totalSess),sub:"completed", color:"#bf5af2",        pct:Math.min(100,totalSess*5) },
              {label:"Distractions", value:String(totalDistr),sub:"caught",  color:"#ff453a",        pct:Math.min(100,totalDistr*3) },
            ].map(c=>(
              <div key={c.label} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.2rem",display:"flex",alignItems:"center",gap:"14px"}}>
                <MiniRing pct={c.pct} color={c.color} size={52} stroke={5}/>
                <div>
                  <p style={{fontSize:"1.6rem",fontWeight:"800",color:c.color,margin:0,lineHeight:1}}>{c.value}</p>
                  <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:"2px 0 0"}}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"1.2rem"}}>

            {/* Focus trend */}
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.2rem"}}>
              <p style={{fontWeight:"600",fontSize:"0.88rem",margin:"0 0 4px"}}>Focus Trend</p>
              <p style={{color:"var(--text-muted)",fontSize:"0.7rem",margin:"0 0 14px"}}>Last 7 days</p>
              <svg viewBox={`0 0 ${LW} ${LH}`} style={{width:"100%",height:"70px",overflow:"visible"}}>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {[25,50,75].map(v=>(
                  <line key={v} x1="0" y1={LH-(v/100)*LH} x2={LW} y2={LH-(v/100)*LH} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="4 4"/>
                ))}
                <polygon points={`0,${LH} ${linePoints} ${LW},${LH}`} fill="url(#fg)"/>
                <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                {last7.map((d,i)=>d.score>0&&(
                  <circle key={i} cx={(i/(last7.length-1))*LW} cy={LH-(d.score/100)*LH} r="4" fill={sc(d.score)} stroke="var(--bg-card)" strokeWidth="2"/>
                ))}
              </svg>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"8px"}}>
                {last7.map(d=>(
                  <div key={d.day} style={{textAlign:"center"}}>
                    <p style={{fontSize:"0.58rem",color:"var(--text-muted)",margin:0}}>{d.day}</p>
                    <p style={{fontSize:"0.62rem",color:d.score>0?sc(d.score):"var(--text-subtle)",fontWeight:"600",margin:0}}>{d.score>0?d.score:"—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hours bar */}
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.2rem"}}>
              <p style={{fontWeight:"600",fontSize:"0.88rem",margin:"0 0 4px"}}>Study Hours</p>
              <p style={{color:"var(--text-muted)",fontSize:"0.7rem",margin:"0 0 14px"}}>Last 7 days</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:"6px",height:"70px"}}>
                {last7.map((d,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",height:"100%"}}>
                    <span style={{fontSize:"0.55rem",color:"var(--text-muted)"}}>{d.hours>0?d.hours.toFixed(1):""}</span>
                    <div style={{width:"100%",flex:1,display:"flex",alignItems:"flex-end"}}>
                      <div style={{width:"100%",height:`${(d.hours/maxHours)*100}%`,background:d.hours>0?`${color}88`:"transparent",borderRadius:"4px 4px 0 0",minHeight:d.hours>0?"4px":"0",transition:"height 0.6s ease"}}/>
                    </div>
                    <span style={{fontSize:"0.58rem",color:"var(--text-muted)"}}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Roadmap progress */}
          {Object.keys(phases).length>0&&(
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem",marginBottom:"1.2rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
                <div>
                  <p style={{fontWeight:"700",fontSize:"0.9rem",margin:0}}>🗺️ Roadmap</p>
                  <p style={{color:"var(--text-muted)",fontSize:"0.72rem",margin:0}}>{completedWeeks}/{totalWeeks} weeks complete</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                  <MiniRing pct={overallPct} color={color} size={48} stroke={5}/>
                  <div>
                    <p style={{fontSize:"1.3rem",fontWeight:"800",color,margin:0,lineHeight:1}}>{overallPct}%</p>
                    <p style={{fontSize:"0.6rem",color:"var(--text-muted)",margin:0}}>overall</p>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {Object.entries(phases).map(([phase,data])=>{
                  const pct=data.total>0?Math.round((data.done/data.total)*100):0
                  return (
                    <div key={phase}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                        <span style={{fontSize:"0.8rem",color:data.color,fontWeight:"500"}}>{phase}</span>
                        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                          <span style={{fontSize:"0.72rem",color:"var(--text-muted)"}}>{data.done}/{data.total}</span>
                          <span style={{fontSize:"0.75rem",fontWeight:"700",color:pct===100?"#30d158":data.color}}>{pct}%</span>
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width:`${pct}%`,background:data.color}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link href="/roadmap" style={{display:"block",textAlign:"center",marginTop:"14px",background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:"var(--radius-lg)",padding:"10px",color:"var(--accent)",textDecoration:"none",fontSize:"0.82rem",fontWeight:"600"}}>
                View Full Roadmap →
              </Link>
            </div>
          )}

          {/* AI Insights */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem",marginBottom:"1.2rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.9rem",margin:"0 0 12px"}}>🧠 AI Insights</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {[
                avgFocus>=80?{icon:"🏆",text:`Exceptional avg focus of ${avgFocus}! You're studying at peak performance.`,color:"#30d158"}:{icon:"📈",text:`Your avg focus is ${avgFocus}. Try Pomodoro to push it higher.`,color:"#ff9f0a"},
                completedWeeks>0?{icon:"🗺️",text:`${completedWeeks} of ${totalWeeks} roadmap weeks complete. Momentum is building!`,color}:{icon:"🗺️",text:"Start completing roadmap tasks to track your progress!",color},
                totalSess>=5?{icon:"🔥",text:`${totalSess} sessions completed — you're building a solid habit!`,color:"#bf5af2"}:{icon:"💪",text:`${totalSess} session${totalSess!==1?"s":""} done. Aim for at least 1 daily!`,color:"#bf5af2"},
                totalDistr>10?{icon:"📵",text:`${totalDistr} distractions detected. Try putting phone in another room.`,color:"#ff9f0a"}:{icon:"🎯",text:`Only ${totalDistr} distractions — excellent focus discipline!`,color:"#30d158"},
              ].map((ins,i)=>(
                <div key={i} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"12px 14px",background:`${ins.color}08`,border:`1px solid ${ins.color}15`,borderRadius:"var(--radius-xl)"}}>
                  <span style={{fontSize:"1.2rem",flexShrink:0}}>{ins.icon}</span>
                  <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",lineHeight:1.6,margin:0}}>{ins.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.9rem",margin:"0 0 12px"}}>Recent Sessions</p>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {sessions.slice(0,8).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"var(--bg-elevated)",borderRadius:"var(--radius-xl)",border:"1px solid var(--border)"}}>
                  <div style={{width:"36px",height:"36px",borderRadius:"var(--radius-md)",background:`${sc(s.focus_score)}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>
                    {EXPR_EMOJI[s.avg_expression||"neutral"]||"😐"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:"0.85rem",fontWeight:"500",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.subject||"General Study"}</p>
                    <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>{new Date(s.created_at).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})} · {s.duration_minutes}min</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:"1rem",fontWeight:"700",color:sc(s.focus_score),margin:0}}>{s.focus_score}</p>
                    <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>{s.distractions} distr</p>
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
