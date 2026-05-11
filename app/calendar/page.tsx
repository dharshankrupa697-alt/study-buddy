"use client"
import { useState, useEffect } from "react"
import { getUser, getRoadmap, getCurrentWeek, getProgress, getDailyTasks, createDailyTasks, toggleDailyTask, getDailyCheckin, saveDailyCheckin, getCheckinHistory, carryOverTasks } from "@/lib/supabase"
import Link from "next/link"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
}

const QUOTES = [
  "Every expert was once a beginner 💪",
  "Small daily improvements lead to stunning results 🎯",
  "Consistency beats intensity every single time 🔥",
  "The secret of getting ahead is getting started 🚀",
  "Your future self is counting on you today 💪",
  "One day, one task, one step. You've got this! 🌟",
]

function getTodayStr() {
  const now=new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
}

function formatDate(dateStr:string) {
  const d=new Date(dateStr)
  return d.toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})
}

function getDaysBetween(start:string,end:string) {
  return Math.ceil((new Date(end).getTime()-new Date(start).getTime())/(1000*60*60*24))
}

export default function CalendarPage() {
  const [loading,       setLoading]       = useState(true)
  const [userId,        setUserId]        = useState("")
  const [roadmap,       setRoadmap]       = useState<any>(null)
  const [goalType,      setGoalType]      = useState("")
  const [goalDetails,   setGoalDetails]   = useState<any>({})
  const [currentWeek,   setCurrentWeek]   = useState(1)
  const [todayTasks,    setTodayTasks]    = useState<any[]>([])
  const [generating,    setGenerating]    = useState(false)
  const [checkin,       setCheckin]       = useState<any>(null)
  const [showCheckin,   setShowCheckin]   = useState(false)
  const [checkinNote,   setCheckinNote]   = useState("")
  const [selectedDate,  setSelectedDate]  = useState(getTodayStr())
  const [selectedTasks, setSelectedTasks] = useState<any[]>([])
  const [viewMode,      setViewMode]      = useState<"today"|"calendar">("today")
  const [monthDays,     setMonthDays]     = useState<any[]>([])
  const [checkinHistory,setCheckinHistory]= useState<any[]>([])
  const [prediction,    setPrediction]    = useState<any>(null)
  const [showPrediction,setShowPrediction]= useState(false)
  const [quote,         setQuote]         = useState("")
  const [progress,      setProgress]      = useState<any[]>([])

  const color = GOAL_COLORS[goalType] || "#0a84ff"

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random()*QUOTES.length)])
    load()
  }, [])

  const load = async () => {
    const user = await getUser()
    if (!user) { window.location.href="/login"; return }
    setUserId(user.id)

    const [roadmapData, weekData, progressData, history] = await Promise.all([
      getRoadmap(user.id), getCurrentWeek(user.id), getProgress(user.id), getCheckinHistory(user.id,30)
    ])

    setCurrentWeek(weekData); setProgress(progressData); setCheckinHistory(history)

    if (roadmapData) {
      let rm=roadmapData.roadmap
      if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
        try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
      }
      setRoadmap(rm); setGoalType(roadmapData.goal_type||""); setGoalDetails(roadmapData.goal_details||{})
    }

    const today=getTodayStr()
    const [tasks, todayCheckin] = await Promise.all([getDailyTasks(user.id,today), getDailyCheckin(user.id,today)])
    setTodayTasks(tasks); setCheckin(todayCheckin)
    buildMonthCalendar(history)
    setLoading(false)
  }

  const buildMonthCalendar = (history:any[]) => {
    const now=new Date(), year=now.getFullYear(), month=now.getMonth()
    const firstDay=new Date(year,month,1), lastDay=new Date(year,month+1,0)
    const days=[]
    const startDay=firstDay.getDay()===0?6:firstDay.getDay()-1
    for (let i=0;i<startDay;i++) days.push(null)
    for (let d=1;d<=lastDay.getDate();d++) {
      const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      const checkin=history.find(c=>c.date===dateStr)
      days.push({date:d,dateStr,checkin,isToday:dateStr===getTodayStr(),isPast:new Date(dateStr)<new Date(getTodayStr())})
    }
    setMonthDays(days)
  }

  const generateTodayTasks = async () => {
    if (!roadmap||generating) return
    setGenerating(true)
    const weeks=roadmap.weeks||[]
    const week=weeks.find((w:any)=>w.week===currentWeek)||weeks[0]
    if (!week) { setGenerating(false); return }
    const today=getTodayStr()
    const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay()+(weekStart.getDay()===0?-6:1))
    const hours=parseFloat(goalDetails?.hours||goalDetails?.daily_hours||"2")
    try {
      const res=await fetch("/api/daily-tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekTasks:week.tasks||[],hoursPerDay:hours,weekNumber:currentWeek,startDate:weekStart.toISOString().split("T")[0],goalType,weekFocus:week.focus||""})})
      const data=await res.json()
      if (data.tasks) {
        const withUser=data.tasks.map((t:any)=>({...t,user_id:userId}))
        await createDailyTasks(withUser)
        setTodayTasks(withUser.filter((t:any)=>t.date===today))
      }
    } catch(e){console.error(e)}
    setGenerating(false)
  }

  const handleToggle = async (taskId:string,completed:boolean) => {
    await toggleDailyTask(taskId,!completed)
    setTodayTasks(prev=>prev.map(t=>t.id===taskId?{...t,completed:!completed}:t))
  }

  const handleCheckin = async (status:string) => {
    const today=getTodayStr()
    const done=todayTasks.filter(t=>t.completed).length, total=todayTasks.length
    await saveDailyCheckin(userId,today,status,done,total,checkinNote)
    if (status==="missed"||status==="partial") {
      const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1)
      await carryOverTasks(userId,today,tomorrow.toISOString().split("T")[0])
    }
    setCheckin({status,completed_tasks:done,total_tasks:total}); setShowCheckin(false)
    calculatePrediction()
  }

  const calculatePrediction = () => {
    if (!roadmap) return
    const weeks=roadmap.weeks||[], totalWeeks=weeks.length
    const completedW=weeks.filter((w:any,i:number)=>{
      const wn=w.week||i+1
      return (w.tasks||[]).every((_:any,ti:number)=>progress.some((p:any)=>p.week_number===wn&&p.task_index===ti&&p.completed))
    }).length
    const remaining=totalWeeks-completedW
    const examDate=goalDetails?.examDate||goalDetails?.exam_date
    const missed=checkinHistory.filter(c=>c.status==="missed").length
    const total=checkinHistory.length, missRate=total>0?missed/total:0
    const avgDaysPerWeek=7+(missRate*3), predictedDays=remaining*avgDaysPerWeek
    const predictedDate=new Date(); predictedDate.setDate(predictedDate.getDate()+predictedDays)
    let status:"on_track"|"behind"|"critical"="on_track", message="", advice=""
    if (examDate) {
      const daysToExam=getDaysBetween(getTodayStr(),examDate)
      if (predictedDays<=daysToExam*0.8) { status="on_track"; message=`You'll finish ${Math.round(daysToExam-predictedDays)} days before your exam! 🎉`; advice="Great pace! Keep this consistency." }
      else if (predictedDays<=daysToExam) { status="behind"; message="You'll just make it by your exam date ⚠️"; advice="Add 30 mins extra daily to create a buffer." }
      else { status="critical"; message=`Behind by ~${Math.round(predictedDays-daysToExam)} days at current pace`; advice="Add 1-2 hours daily to get back on track." }
    } else { message=`At current pace you'll complete in ~${Math.round(predictedDays)} days`; advice=remaining===0?"Roadmap complete! 🏆":"Stay consistent every day!" }
    setPrediction({status,message,advice,completedW,totalWeeks,remaining,missRate:Math.round(missRate*100)})
  }

  const loadDateTasks = async (dateStr:string) => {
    setSelectedDate(dateStr)
    const tasks=await getDailyTasks(userId,dateStr)
    setSelectedTasks(tasks)
  }

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"36px",height:"36px",border:"3px solid rgba(10,132,255,0.2)",borderTop:"3px solid #0a84ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading calendar...</p>
      </div>
    </div>
  )

  const dailyDone=todayTasks.filter(t=>t.completed).length
  const dailyTotal=todayTasks.length
  const dailyPct=dailyTotal>0?Math.round((dailyDone/dailyTotal)*100):0

  return (
    <div style={{minHeight:"100vh",padding:"1.5rem",maxWidth:"680px",margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1.8rem"}}>
        <Link href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</Link>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>Daily Planner</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.78rem",margin:0}}>Tasks · Check-ins · Predictions</p>
        </div>
        <button onClick={()=>{calculatePrediction();setShowPrediction(true)}} style={{background:`${color}12`,border:`1px solid ${color}30`,borderRadius:"var(--radius-xl)",color,padding:"8px 14px",fontSize:"0.78rem",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>
          📊 Predict
        </button>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:"6px",marginBottom:"1.5rem",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"4px"}}>
        {[{key:"today",label:"📋 Today"},{key:"calendar",label:"📅 Calendar"}].map(v=>(
          <button key={v.key} onClick={()=>setViewMode(v.key as any)} style={{flex:1,padding:"10px",borderRadius:"var(--radius-lg)",fontWeight:"600",fontSize:"0.85rem",cursor:"pointer",background:viewMode===v.key?"var(--bg-elevated)":"transparent",border:"none",color:viewMode===v.key?"white":"var(--text-muted)",transition:"all 0.2s"}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {viewMode==="today"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>

          {/* Progress ring card */}
          <div style={{background:"var(--bg-card)",border:`1px solid ${color}22`,borderRadius:"var(--radius-2xl)",padding:"1.5rem",display:"flex",alignItems:"center",gap:"1.5rem"}}>
            {/* Ring */}
            <div style={{position:"relative",width:"80px",height:"80px",flexShrink:0}}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke={`${color}22`} strokeWidth="6"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6"
                  strokeDasharray={`${(dailyPct/100)*201} 201`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{transition:"stroke-dasharray 1s ease"}}
                />
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:"1.1rem",fontWeight:"800",color,lineHeight:1}}>{dailyPct}%</span>
              </div>
            </div>
            <div style={{flex:1}}>
              <p style={{fontWeight:"700",fontSize:"1rem",margin:"0 0 4px"}}>{formatDate(getTodayStr())}</p>
              <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:"0 0 10px"}}>{dailyDone}/{dailyTotal} tasks done · Week {currentWeek}</p>
              {checkin ? (
                <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:checkin.status==="completed"?"rgba(48,209,88,0.1)":checkin.status==="partial"?"rgba(255,159,10,0.1)":"rgba(255,69,58,0.1)",borderRadius:"99px",padding:"4px 12px",border:`1px solid ${checkin.status==="completed"?"rgba(48,209,88,0.25)":checkin.status==="partial"?"rgba(255,159,10,0.25)":"rgba(255,69,58,0.25)"}`}}>
                  <span style={{fontSize:"0.9rem"}}>{checkin.status==="completed"?"✅":checkin.status==="partial"?"⚠️":"❌"}</span>
                  <span style={{fontSize:"0.75rem",fontWeight:"600",color:checkin.status==="completed"?"#30d158":checkin.status==="partial"?"#ff9f0a":"#ff453a",textTransform:"capitalize"}}>{checkin.status}</span>
                </div>
              ) : (
                <button onClick={()=>setShowCheckin(true)} style={{background:`${color}12`,border:`1px solid ${color}30`,borderRadius:"99px",color,padding:"6px 14px",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}>
                  Check in now →
                </button>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <div>
                <p style={{fontWeight:"700",fontSize:"0.95rem",margin:0}}>Today's Tasks</p>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{dailyDone}/{dailyTotal} completed</p>
              </div>
              {todayTasks.length===0&&(
                <button onClick={generateTodayTasks} disabled={generating} style={{background:generating?"var(--bg-elevated)":color,border:"none",borderRadius:"var(--radius-xl)",color:generating?"var(--text-muted)":"white",padding:"8px 16px",fontSize:"0.78rem",fontWeight:"700",cursor:generating?"not-allowed":"pointer",boxShadow:generating?"none":`0 4px 16px ${color}33`}}>
                  {generating?"Generating...":"✨ Generate"}
                </button>
              )}
            </div>

            {todayTasks.length===0?(
              <div style={{textAlign:"center",padding:"2rem",color:"var(--text-muted)"}}>
                <div style={{fontSize:"2.5rem",marginBottom:"10px",opacity:0.4}}>📋</div>
                <p style={{fontSize:"0.88rem",margin:"0 0 4px",fontWeight:"600",color:"var(--text-secondary)"}}>No tasks yet</p>
                <p style={{fontSize:"0.78rem",margin:0}}>Generate your daily study tasks!</p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {todayTasks.map((task,i)=>(
                  <div key={task.id} onClick={()=>handleToggle(task.id,task.completed)} style={{display:"flex",gap:"14px",alignItems:"flex-start",padding:"14px",borderRadius:"var(--radius-xl)",cursor:"pointer",background:task.completed?"rgba(48,209,88,0.06)":"var(--bg-elevated)",border:`1px solid ${task.completed?"rgba(48,209,88,0.15)":"var(--border)"}`,transition:"all 0.2s",animation:`fadeIn 0.3s ease ${i*0.08}s both`}}>
                    <div style={{width:"22px",height:"22px",borderRadius:"50%",flexShrink:0,background:task.completed?"#30d158":"transparent",border:`2px solid ${task.completed?"#30d158":"var(--text-subtle)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:"white",fontWeight:"700",marginTop:"1px"}}>
                      {task.completed?"✓":""}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                        <p style={{fontSize:"0.9rem",fontWeight:"500",margin:0,color:task.completed?"var(--text-muted)":"white",textDecoration:task.completed?"line-through":"none"}}>{task.topic}</p>
                        {task.carried_over&&<span style={{background:"rgba(255,159,10,0.12)",color:"#ff9f0a",borderRadius:"99px",padding:"1px 8px",fontSize:"0.62rem",fontWeight:"600"}}>Carried over</span>}
                      </div>
                      <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:0}}>{task.description}</p>
                    </div>
                    <span style={{fontSize:"0.72rem",color,fontWeight:"600",flexShrink:0}}>{task.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quote */}
          <div style={{background:`${color}08`,border:`1px solid ${color}15`,borderRadius:"var(--radius-xl)",padding:"1.2rem",textAlign:"center"}}>
            <p style={{fontSize:"0.88rem",color:"var(--text-secondary)",margin:0,lineHeight:1.7,fontStyle:"italic"}}>"{quote}"</p>
          </div>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {viewMode==="calendar"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>

          {/* Month grid */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.95rem",margin:"0 0 16px"}}>
              {new Date().toLocaleDateString("en",{month:"long",year:"numeric"})}
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"8px"}}>
              {["M","T","W","T","F","S","S"].map((d,i)=>(
                <div key={i} style={{textAlign:"center",fontSize:"0.65rem",color:"var(--text-muted)",fontWeight:"600",padding:"4px"}}>{d}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
              {monthDays.map((day,i)=>{
                if (!day) return <div key={i}/>
                const sc=day.checkin?.status==="completed"?"#30d158":day.checkin?.status==="partial"?"#ff9f0a":day.checkin?.status==="missed"?"#ff453a":day.isToday?color:undefined
                const isSelected=selectedDate===day.dateStr
                return (
                  <div key={i} onClick={()=>loadDateTasks(day.dateStr)} style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:"var(--radius-md)",cursor:"pointer",background:isSelected?`${color}20`:day.checkin?`${sc}0a`:"transparent",border:`2px solid ${isSelected?color:day.isToday?`${color}44`:"transparent"}`,transition:"all 0.2s",position:"relative"}}>
                    <span style={{fontSize:"0.8rem",fontWeight:day.isToday?"700":"400",color:day.isToday?color:"var(--text-primary)"}}>{day.date}</span>
                    {day.checkin&&<div style={{width:"5px",height:"5px",borderRadius:"50%",background:sc,marginTop:"2px"}}/>}
                    {day.isToday&&!day.checkin&&<div style={{width:"4px",height:"4px",borderRadius:"50%",background:color,marginTop:"2px"}}/>}
                  </div>
                )
              })}
            </div>
            <div style={{display:"flex",gap:"12px",marginTop:"14px",justifyContent:"center"}}>
              {[{color:"#30d158",label:"Done"},{color:"#ff9f0a",label:"Partial"},{color:"#ff453a",label:"Missed"},{color,label:"Today"}].map(l=>(
                <div key={l.label} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <div style={{width:"7px",height:"7px",borderRadius:"50%",background:l.color}}/>
                  <span style={{fontSize:"0.65rem",color:"var(--text-muted)"}}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected date tasks */}
          {selectedDate&&(
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem"}}>
              <p style={{fontWeight:"700",fontSize:"0.88rem",margin:"0 0 12px"}}>{formatDate(selectedDate)}</p>
              {selectedTasks.length===0?(
                <p style={{fontSize:"0.82rem",color:"var(--text-muted)",textAlign:"center",padding:"1rem 0"}}>No tasks for this day</p>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                  {selectedTasks.map(task=>(
                    <div key={task.id} style={{display:"flex",gap:"10px",alignItems:"center",padding:"10px 12px",background:task.completed?"rgba(48,209,88,0.06)":"var(--bg-elevated)",borderRadius:"var(--radius-lg)",border:`1px solid ${task.completed?"rgba(48,209,88,0.15)":"var(--border)"}`}}>
                      <div style={{width:"16px",height:"16px",borderRadius:"50%",background:task.completed?"#30d158":"transparent",border:`2px solid ${task.completed?"#30d158":"var(--text-subtle)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"white",flexShrink:0}}>
                        {task.completed?"✓":""}
                      </div>
                      <div style={{flex:1}}>
                        <p style={{fontSize:"0.82rem",fontWeight:"500",margin:0,color:task.completed?"var(--text-muted)":"white",textDecoration:task.completed?"line-through":"none"}}>{task.topic}</p>
                        <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>{task.hours}h</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Checkin history */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.88rem",margin:"0 0 12px"}}>Recent Check-ins</p>
            {checkinHistory.length===0?(
              <p style={{fontSize:"0.82rem",color:"var(--text-muted)",textAlign:"center",padding:"1rem 0"}}>No check-ins yet — complete your first day!</p>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                {checkinHistory.slice(0,7).map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 12px",background:"var(--bg-elevated)",borderRadius:"var(--radius-lg)",border:"1px solid var(--border)"}}>
                    <span style={{fontSize:"1rem"}}>{c.status==="completed"?"✅":c.status==="partial"?"⚠️":"❌"}</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"0.82rem",fontWeight:"500",margin:0}}>{formatDate(c.date)}</p>
                      <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>{c.completed_tasks}/{c.total_tasks} tasks</p>
                    </div>
                    <span style={{fontSize:"0.75rem",fontWeight:"600",color:c.status==="completed"?"#30d158":c.status==="partial"?"#ff9f0a":"#ff453a",textTransform:"capitalize"}}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHECK-IN MODAL ── */}
      {showCheckin&&(
        <div onClick={()=>setShowCheckin(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(16px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"1rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",width:"100%",maxWidth:"500px",padding:"1.5rem",animation:"slideUp 0.3s ease"}}>
            <div style={{width:"40px",height:"4px",background:"var(--bg-elevated)",borderRadius:"99px",margin:"0 auto 1.5rem"}}/>
            <p style={{fontWeight:"700",fontSize:"1.1rem",margin:"0 0 4px"}}>End of Day Check-in</p>
            <p style={{color:"var(--text-muted)",fontSize:"0.82rem",margin:"0 0 1.2rem"}}>{formatDate(getTodayStr())} · {dailyDone}/{dailyTotal} tasks done</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"1rem"}}>
              {[
                {status:"completed",emoji:"✅",label:"Completed all tasks",color:"#30d158",desc:"I finished everything planned today"},
                {status:"partial",  emoji:"⚠️",label:"Partially completed",color:"#ff9f0a",desc:"I did some tasks but not all"},
                {status:"missed",   emoji:"❌",label:"Missed today",       color:"#ff453a",desc:"Couldn't study — will catch up"},
              ].map(opt=>(
                <button key={opt.status} onClick={()=>handleCheckin(opt.status)} style={{display:"flex",gap:"14px",alignItems:"center",padding:"14px 16px",borderRadius:"var(--radius-xl)",cursor:"pointer",background:`${opt.color}08`,border:`1px solid ${opt.color}22`,textAlign:"left",transition:"all 0.2s"}}>
                  <span style={{fontSize:"1.5rem"}}>{opt.emoji}</span>
                  <div>
                    <p style={{fontWeight:"600",color:opt.color,margin:0,fontSize:"0.9rem"}}>{opt.label}</p>
                    <p style={{fontSize:"0.75rem",color:"var(--text-muted)",margin:0}}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <textarea value={checkinNote} onChange={e=>setCheckinNote(e.target.value)} placeholder="Any notes? (optional)" rows={2} style={{width:"100%",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",color:"var(--text-primary)",padding:"10px 12px",fontSize:"0.85rem",resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box" as const}}/>
          </div>
        </div>
      )}

      {/* ── PREDICTION MODAL ── */}
      {showPrediction&&prediction&&(
        <div onClick={()=>setShowPrediction(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",width:"100%",maxWidth:"440px",overflow:"hidden",animation:"fadeInScale 0.3s ease",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}}>
            <div style={{padding:"1.5rem",background:prediction.status==="on_track"?"rgba(48,209,88,0.08)":prediction.status==="behind"?"rgba(255,159,10,0.08)":"rgba(255,69,58,0.08)",borderBottom:"1px solid var(--border)",textAlign:"center"}}>
              <p style={{fontSize:"2.5rem",margin:"0 0 8px"}}>{prediction.status==="on_track"?"🎯":prediction.status==="behind"?"⚠️":"🔥"}</p>
              <p style={{fontWeight:"700",fontSize:"1rem",margin:"0 0 6px",color:prediction.status==="on_track"?"#30d158":prediction.status==="behind"?"#ff9f0a":"#ff453a"}}>
                {prediction.status==="on_track"?"On Track!":prediction.status==="behind"?"Slightly Behind":"Action Needed!"}
              </p>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",margin:0,lineHeight:1.6}}>{prediction.message}</p>
            </div>
            <div style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"12px"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                {[
                  {label:"Weeks Done",  value:`${prediction.completedW}/${prediction.totalWeeks}`, color},
                  {label:"Remaining",   value:String(prediction.remaining),                        color:"var(--text-secondary)"},
                  {label:"Miss Rate",   value:`${prediction.missRate}%`,                           color:"#ff453a"},
                ].map(s=>(
                  <div key={s.label} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"10px",textAlign:"center"}}>
                    <p style={{fontSize:"1.2rem",fontWeight:"800",color:s.color,margin:0}}>{s.value}</p>
                    <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}>
                <p style={{fontWeight:"600",fontSize:"0.85rem",margin:"0 0 6px"}}>💡 Recommendation</p>
                <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0,lineHeight:1.6}}>{prediction.advice}</p>
              </div>
              {prediction.status!=="on_track"&&(
                <div style={{background:`${color}08`,border:`1px solid ${color}15`,borderRadius:"var(--radius-md)",padding:"10px 14px",textAlign:"center"}}>
                  <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0,fontStyle:"italic"}}>"{quote}"</p>
                </div>
              )}
              <button onClick={()=>setShowPrediction(false)} style={{width:"100%",padding:"14px",background:"var(--accent)",border:"none",borderRadius:"var(--radius-xl)",color:"white",fontWeight:"700",fontSize:"0.9rem",cursor:"pointer",boxShadow:"0 4px 16px rgba(10,132,255,0.3)"}}>
                Got it, let's study! 💪
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
