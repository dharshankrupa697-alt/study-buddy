"use client"
import { useState, useEffect } from "react"
import { getUser, getRoadmap, getCurrentWeek, getProgress, getDailyTasks, createDailyTasks, toggleDailyTask, getDailyCheckin, saveDailyCheckin, getCheckinHistory, carryOverTasks } from "@/lib/supabase"
import Link from "next/link"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#7c6dfa", academic:"#3ecf8e", coding:"#60a5fa", skill:"#fbbf24"
}

const MOTIVATIONAL_QUOTES = [
  "Every expert was once a beginner 💪",
  "Small daily improvements lead to stunning results 🎯",
  "Consistency beats intensity every single time 🔥",
  "You don't have to be great to start, but you have to start to be great!",
  "The secret of getting ahead is getting started 🚀",
  "Don't watch the clock — do what it does. Keep going! ⏰",
  "Success is the sum of small efforts repeated day in and day out 💫",
  "Believe you can and you're halfway there 🌟",
  "Your future self is counting on you today 💪",
  "One day at a time. One task at a time. You've got this! 🎯",
]

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day===0?-6:1)
  d.setDate(diff)
  return d
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en", { weekday:"short", month:"short", day:"numeric" })
}

function getDaysBetween(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return Math.ceil((e.getTime()-s.getTime())/(1000*60*60*24))
}

export default function CalendarPage() {
  const [loading,       setLoading]       = useState(true)
  const [userId,        setUserId]        = useState("")
  const [roadmap,       setRoadmap]       = useState<any>(null)
  const [goalType,      setGoalType]      = useState("")
  const [goalDetails,   setGoalDetails]   = useState<any>({})
  const [currentWeek,   setCurrentWeek]   = useState(1)
  const [progress,      setProgress]      = useState<any[]>([])
  const [todayTasks,    setTodayTasks]    = useState<any[]>([])
  const [generating,    setGenerating]    = useState(false)
  const [checkin,       setCheckin]       = useState<any>(null)
  const [showCheckin,   setShowCheckin]   = useState(false)
  const [checkinNote,   setCheckinNote]   = useState("")
  const [checkinDone,   setCheckinDone]   = useState(false)
  const [selectedDate,  setSelectedDate]  = useState(getTodayStr())
  const [selectedTasks, setSelectedTasks] = useState<any[]>([])
  const [viewMode,      setViewMode]      = useState<"today"|"calendar">("today")
  const [monthDays,     setMonthDays]     = useState<any[]>([])
  const [checkinHistory,setCheckinHistory]= useState<any[]>([])
  const [prediction,    setPrediction]    = useState<any>(null)
  const [showPrediction,setShowPrediction]= useState(false)
  const [quote,         setQuote]         = useState("")

  const color = GOAL_COLORS[goalType] || "#7c6dfa"

  useEffect(() => {
    setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random()*MOTIVATIONAL_QUOTES.length)])
    load()
  }, [])

  const load = async () => {
    const user = await getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [roadmapData, weekData, progressData, history] = await Promise.all([
      getRoadmap(user.id),
      getCurrentWeek(user.id),
      getProgress(user.id),
      getCheckinHistory(user.id, 30),
    ])

    setCurrentWeek(weekData)
    setProgress(progressData)
    setCheckinHistory(history)

    if (roadmapData) {
      let rm = roadmapData.roadmap
      if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
        try {
          const parsed=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim())
          if (parsed.weeks?.length>0) rm=parsed
        } catch {}
      }
      setRoadmap(rm)
      setGoalType(roadmapData.goal_type||"")
      setGoalDetails(roadmapData.goal_details||{})
    }

    // Load today's tasks
    const today = getTodayStr()
    const tasks = await getDailyTasks(user.id, today)
    setTodayTasks(tasks)

    // Check today's checkin
    const todayCheckin = await getDailyCheckin(user.id, today)
    setCheckin(todayCheckin)

    // Build month calendar
    buildMonthCalendar(history)
    setLoading(false)
  }

  const buildMonthCalendar = (history: any[]) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month+1, 0)
    const days = []

    // Empty slots before first day
    const startDay = firstDay.getDay()===0?6:firstDay.getDay()-1
    for (let i=0; i<startDay; i++) days.push(null)

    for (let d=1; d<=lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      const checkin = history.find(c=>c.date===dateStr)
      const isToday = dateStr===getTodayStr()
      const isPast  = new Date(dateStr) < new Date(getTodayStr())
      days.push({ date:d, dateStr, checkin, isToday, isPast })
    }
    setMonthDays(days)
  }

  const generateTodayTasks = async () => {
    if (!roadmap || generating) return
    setGenerating(true)

    const weeks   = roadmap.weeks||[]
    const week    = weeks.find((w:any)=>w.week===currentWeek)||weeks[0]
    if (!week) { setGenerating(false); return }

    const today     = getTodayStr()
    const weekStart = getWeekStart(new Date()).toISOString().split("T")[0]
    const hours     = parseFloat(goalDetails?.hours||goalDetails?.daily_hours||"2")

    try {
      const res  = await fetch("/api/daily-tasks", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify({
          weekTasks:  week.tasks||[],
          hoursPerDay:hours,
          weekNumber: currentWeek,
          startDate:  weekStart,
          goalType,
          weekFocus:  week.focus||"",
        })
      })
      const data = await res.json()
      if (data.tasks) {
        const withUser = data.tasks.map((t:any)=>({ ...t, user_id:userId }))
        await createDailyTasks(withUser)
        const todayTasks = withUser.filter((t:any)=>t.date===today)
        setTodayTasks(todayTasks)
      }
    } catch(e) { console.error(e) }
    setGenerating(false)
  }

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    await toggleDailyTask(taskId, !completed)
    setTodayTasks(prev=>prev.map(t=>t.id===taskId?{...t,completed:!completed}:t))
  }

  const handleCheckin = async (status: string) => {
    const today  = getTodayStr()
    const done   = todayTasks.filter(t=>t.completed).length
    const total  = todayTasks.length

    await saveDailyCheckin(userId, today, status, done, total, checkinNote)

    // If missed/partial → carry over incomplete tasks to tomorrow
    if (status==="missed"||status==="partial") {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate()+1)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]
      await carryOverTasks(userId, today, tomorrowStr)
    }

    setCheckin({ status, completed_tasks:done, total_tasks:total })
    setShowCheckin(false)
    setCheckinDone(true)

    // Recalculate prediction
    calculatePrediction()
  }

  const calculatePrediction = () => {
    if (!roadmap) return
    const weeks      = roadmap.weeks||[]
    const totalWeeks = weeks.length
    const completedW = weeks.filter((w:any,i:number)=>{
      const wn = w.week||i+1
      return (w.tasks||[]).every((_:any,ti:number)=>progress.some((p:any)=>p.week_number===wn&&p.task_index===ti&&p.completed))
    }).length

    const remaining  = totalWeeks - completedW
    const examDate   = goalDetails?.examDate || goalDetails?.exam_date
    const today      = new Date()

    // Calculate missed days from checkin history
    const missed = checkinHistory.filter(c=>c.status==="missed").length
    const total  = checkinHistory.length
    const missRate = total>0 ? missed/total : 0

    // Predict completion
    const avgDaysPerWeek = 7 + (missRate * 3) // More misses = slower
    const predictedDays  = remaining * avgDaysPerWeek
    const predictedDate  = new Date(today)
    predictedDate.setDate(predictedDate.getDate() + predictedDays)

    let status: "on_track"|"behind"|"critical" = "on_track"
    let message = ""
    let advice  = ""

    if (examDate) {
      const daysToExam = getDaysBetween(getTodayStr(), examDate)
      if (predictedDays <= daysToExam * 0.8) {
        status  = "on_track"
        message = `You'll finish ${Math.round(daysToExam-predictedDays)} days before your exam! 🎉`
        advice  = "Great pace! Keep this consistency."
      } else if (predictedDays <= daysToExam) {
        status  = "behind"
        message = `You'll just make it by your exam date ⚠️`
        advice  = "Add 30 mins extra daily to create a buffer."
      } else {
        status  = "critical"
        message = `At current pace you'll miss your exam date by ${Math.round(predictedDays-daysToExam)} days`
        advice  = "Add 1-2 hours daily to get back on track."
      }
    } else {
      message = `At current pace you'll complete in ~${Math.round(predictedDays)} days`
      advice  = remaining===0 ? "Roadmap complete! 🏆" : "Stay consistent every day!"
    }

    setPrediction({ status, message, advice, predictedDate:predictedDate.toDateString(), completedW, totalWeeks, remaining, missRate:Math.round(missRate*100) })
  }

  const loadDateTasks = async (dateStr: string) => {
    setSelectedDate(dateStr)
    const tasks = await getDailyTasks(userId, dateStr)
    setSelectedTasks(tasks)
  }

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",border:"3px solid rgba(124,109,250,0.2)",borderTop:"3px solid #7c6dfa",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading your calendar...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const todayDone  = todayTasks.filter(t=>t.completed).length
  const todayTotal = todayTasks.length
  const todayPct   = todayTotal>0?Math.round((todayDone/todayTotal)*100):0

  return (
    <div style={{minHeight:"100vh",padding:"2rem 1.5rem",maxWidth:"760px",margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1.5rem"}}>
        <a href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</a>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>Study Calendar</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.8rem",margin:0}}>Daily tasks · Check-ins · Progress tracking</p>
        </div>
        <button
          onClick={()=>{calculatePrediction();setShowPrediction(true)}}
          style={{background:`${color}15`,border:`1px solid ${color}33`,borderRadius:"var(--radius-md)",color,padding:"7px 14px",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer"}}
        >
          📊 Predict
        </button>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:"8px",marginBottom:"1.5rem"}}>
        {[{key:"today",label:"📋 Today"},{ key:"calendar",label:"📅 Calendar"}].map(v=>(
          <button key={v.key} onClick={()=>setViewMode(v.key as any)} style={{
            padding:"8px 16px",borderRadius:"var(--radius-md)",fontWeight:"600",fontSize:"0.85rem",cursor:"pointer",
            background:viewMode===v.key?color:"var(--bg-card)",
            border:`1px solid ${viewMode===v.key?color:"var(--border)"}`,
            color:viewMode===v.key?"white":"var(--text-secondary)",
            transition:"all 0.2s"
          }}>{v.label}</button>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {viewMode==="today" && (
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>

          {/* Today's summary card */}
          <div style={{background:"var(--bg-card)",border:`1px solid ${color}22`,borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
              <div>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Today</p>
                <h2 style={{fontSize:"1.1rem",fontWeight:"700",margin:0}}>{formatDate(getTodayStr())}</h2>
                <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:"2px 0 0"}}>Week {currentWeek} · {goalType} prep</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:"2rem",fontWeight:"800",color,margin:0}}>{todayPct}%</p>
                <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>complete</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="progress-bar" style={{marginBottom:"12px"}}>
              <div className="progress-fill" style={{width:`${todayPct}%`,background:`linear-gradient(90deg,${color},${color}88)`}}/>
            </div>

            {/* Checkin status */}
            {checkin ? (
              <div style={{background:checkin.status==="completed"?"rgba(62,207,142,0.08)":checkin.status==="partial"?"rgba(251,191,36,0.08)":"rgba(248,113,113,0.08)",border:`1px solid ${checkin.status==="completed"?"rgba(62,207,142,0.2)":checkin.status==="partial"?"rgba(251,191,36,0.2)":"rgba(248,113,113,0.2)"}`,borderRadius:"var(--radius-md)",padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"1.2rem"}}>{checkin.status==="completed"?"✅":checkin.status==="partial"?"⚠️":"❌"}</span>
                <div>
                  <p style={{fontWeight:"600",fontSize:"0.85rem",margin:0,color:checkin.status==="completed"?"#3ecf8e":checkin.status==="partial"?"#fbbf24":"#f87171"}}>
                    {checkin.status==="completed"?"Day Complete!":checkin.status==="partial"?"Partially Done":"Day Missed"}
                  </p>
                  <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{checkin.completed_tasks}/{checkin.total_tasks} tasks done</p>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowCheckin(true)} style={{width:"100%",padding:"10px",background:`${color}15`,border:`1px solid ${color}33`,borderRadius:"var(--radius-md)",color,fontWeight:"600",fontSize:"0.85rem",cursor:"pointer"}}>
                ✓ End of Day Check-in
              </button>
            )}
          </div>

          {/* Today's tasks */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <div>
                <p style={{fontWeight:"700",fontSize:"0.95rem",margin:0}}>Today's Tasks</p>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{todayDone}/{todayTotal} completed</p>
              </div>
              {todayTasks.length===0 && (
                <button onClick={generateTodayTasks} disabled={generating} style={{background:generating?"var(--bg-elevated)":color,border:"none",borderRadius:"var(--radius-md)",color:generating?"var(--text-muted)":"white",padding:"7px 14px",fontSize:"0.78rem",fontWeight:"600",cursor:generating?"not-allowed":"pointer"}}>
                  {generating?"Generating...":"Generate Tasks"}
                </button>
              )}
            </div>

            {todayTasks.length===0 ? (
              <div style={{textAlign:"center",padding:"2rem",color:"var(--text-muted)"}}>
                <p style={{fontSize:"2rem",marginBottom:"8px"}}>📋</p>
                <p style={{fontSize:"0.85rem",margin:"0 0 4px",fontWeight:"600"}}>No tasks for today</p>
                <p style={{fontSize:"0.78rem",margin:0}}>Generate your daily tasks to get started!</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {todayTasks.map(task=>(
                  <div key={task.id} onClick={()=>handleToggleTask(task.id,task.completed)} style={{
                    display:"flex",gap:"12px",alignItems:"flex-start",
                    padding:"12px 14px",borderRadius:"var(--radius-md)",cursor:"pointer",
                    background:task.completed?"rgba(62,207,142,0.06)":"var(--bg-elevated)",
                    border:`1px solid ${task.completed?"rgba(62,207,142,0.2)":"var(--border)"}`,
                    transition:"all 0.2s"
                  }}>
                    <div style={{width:"20px",height:"20px",borderRadius:"5px",flexShrink:0,background:task.completed?"#3ecf8e":"transparent",border:`2px solid ${task.completed?"#3ecf8e":"var(--text-muted)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",color:"white",fontWeight:"700",marginTop:"1px"}}>
                      {task.completed?"✓":""}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px"}}>
                        <p style={{fontSize:"0.88rem",fontWeight:"600",margin:0,color:task.completed?"var(--text-muted)":"var(--text-primary)",textDecoration:task.completed?"line-through":"none"}}>{task.topic}</p>
                        {task.carried_over&&<span style={{background:"rgba(251,191,36,0.15)",color:"#fbbf24",borderRadius:"var(--radius-sm)",padding:"1px 6px",fontSize:"0.62rem",fontWeight:"600"}}>Carried over</span>}
                      </div>
                      <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:0}}>{task.description}</p>
                      <p style={{fontSize:"0.68rem",color:color,margin:"2px 0 0"}}>{task.hours}h</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Motivational quote */}
          <div style={{background:`${color}08`,border:`1px solid ${color}15`,borderRadius:"var(--radius-lg)",padding:"1rem",textAlign:"center"}}>
            <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",margin:0,lineHeight:1.7,fontStyle:"italic"}}>"{quote}"</p>
          </div>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {viewMode==="calendar" && (
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>

          {/* Month calendar */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.95rem",margin:"0 0 16px"}}>
              {new Date().toLocaleDateString("en",{month:"long",year:"numeric"})}
            </p>

            {/* Day labels */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"8px"}}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(
                <div key={d} style={{textAlign:"center",fontSize:"0.65rem",color:"var(--text-muted)",fontWeight:"600",padding:"4px"}}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
              {monthDays.map((day,i)=>{
                if (!day) return <div key={i}/>
                const statusColor = day.checkin?.status==="completed"?"#3ecf8e":day.checkin?.status==="partial"?"#fbbf24":day.checkin?.status==="missed"?"#f87171":day.isToday?color:day.isPast?"var(--bg-elevated)":"var(--bg-elevated)"
                const isSelected = selectedDate===day.dateStr

                return (
                  <div key={i} onClick={()=>loadDateTasks(day.dateStr)} style={{
                    aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    borderRadius:"var(--radius-md)",cursor:"pointer",
                    background:isSelected?`${color}22`:day.checkin?"transparent":"transparent",
                    border:`2px solid ${isSelected?color:day.isToday?color+"44":"transparent"}`,
                    transition:"all 0.2s",position:"relative"
                  }}>
                    <span style={{fontSize:"0.78rem",fontWeight:day.isToday?"700":"400",color:day.isToday?color:"var(--text-primary)"}}>{day.date}</span>
                    {day.checkin && (
                      <div style={{width:"5px",height:"5px",borderRadius:"50%",background:statusColor,marginTop:"2px"}}/>
                    )}
                    {day.isToday && !day.checkin && (
                      <div style={{width:"4px",height:"4px",borderRadius:"50%",background:color,marginTop:"2px"}}/>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:"12px",marginTop:"12px",justifyContent:"center"}}>
              {[{color:"#3ecf8e",label:"Completed"},{color:"#fbbf24",label:"Partial"},{color:"#f87171",label:"Missed"},{color:color,label:"Today"}].map(l=>(
                <div key={l.label} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:l.color}}/>
                  <span style={{fontSize:"0.65rem",color:"var(--text-muted)"}}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected date tasks */}
          {selectedDate && (
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
              <p style={{fontWeight:"700",fontSize:"0.95rem",margin:"0 0 12px"}}>{formatDate(selectedDate)}</p>
              {selectedTasks.length===0 ? (
                <p style={{fontSize:"0.82rem",color:"var(--text-muted)",textAlign:"center",padding:"1rem 0"}}>No tasks for this day</p>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {selectedTasks.map(task=>(
                    <div key={task.id} style={{display:"flex",gap:"10px",alignItems:"center",padding:"10px 12px",background:task.completed?"rgba(62,207,142,0.06)":"var(--bg-elevated)",borderRadius:"var(--radius-md)",border:`1px solid ${task.completed?"rgba(62,207,142,0.2)":"var(--border)"}`}}>
                      <div style={{width:"16px",height:"16px",borderRadius:"4px",background:task.completed?"#3ecf8e":"transparent",border:`2px solid ${task.completed?"#3ecf8e":"var(--text-muted)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"white",flexShrink:0}}>
                        {task.completed?"✓":""}
                      </div>
                      <div style={{flex:1}}>
                        <p style={{fontSize:"0.82rem",fontWeight:"500",margin:0,color:task.completed?"var(--text-muted)":"var(--text-primary)",textDecoration:task.completed?"line-through":"none"}}>{task.topic}</p>
                        <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>{task.hours}h</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Checkin history */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"0.95rem",margin:"0 0 12px"}}>Recent Check-ins</p>
            {checkinHistory.length===0 ? (
              <p style={{fontSize:"0.82rem",color:"var(--text-muted)",textAlign:"center",padding:"1rem 0"}}>No check-ins yet — complete your first day!</p>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                {checkinHistory.slice(0,7).map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"8px 12px",background:"var(--bg-elevated)",borderRadius:"var(--radius-md)",border:"1px solid var(--border)"}}>
                    <span style={{fontSize:"1rem"}}>{c.status==="completed"?"✅":c.status==="partial"?"⚠️":"❌"}</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"0.82rem",fontWeight:"500",margin:0}}>{formatDate(c.date)}</p>
                      <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>{c.completed_tasks}/{c.total_tasks} tasks</p>
                    </div>
                    <span style={{fontSize:"0.75rem",fontWeight:"600",color:c.status==="completed"?"#3ecf8e":c.status==="partial"?"#fbbf24":"#f87171",textTransform:"capitalize"}}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHECK-IN MODAL ── */}
      {showCheckin && (
        <div onClick={()=>setShowCheckin(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"1rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"500px",padding:"1.5rem"}}>
            <p style={{fontWeight:"700",fontSize:"1.1rem",margin:"0 0 4px"}}>End of Day Check-in</p>
            <p style={{color:"var(--text-muted)",fontSize:"0.82rem",margin:"0 0 1.2rem"}}>{formatDate(getTodayStr())} · {todayDone}/{todayTotal} tasks done</p>

            <p style={{fontWeight:"600",fontSize:"0.85rem",margin:"0 0 10px"}}>How was your study day?</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"1rem"}}>
              {[
                {status:"completed", emoji:"✅", label:"Completed all tasks",   color:"#3ecf8e", desc:"I finished everything planned for today"},
                {status:"partial",   emoji:"⚠️", label:"Partially completed",  color:"#fbbf24", desc:"I did some tasks but not all"},
                {status:"missed",    emoji:"❌", label:"Missed today",          color:"#f87171", desc:"Couldn't study today — will catch up"},
              ].map(opt=>(
                <button key={opt.status} onClick={()=>handleCheckin(opt.status)} style={{
                  display:"flex",gap:"12px",alignItems:"center",
                  padding:"12px 14px",borderRadius:"var(--radius-md)",cursor:"pointer",
                  background:`${opt.color}08`,border:`1px solid ${opt.color}22`,
                  textAlign:"left",transition:"all 0.2s"
                }}>
                  <span style={{fontSize:"1.4rem"}}>{opt.emoji}</span>
                  <div>
                    <p style={{fontWeight:"600",color:opt.color,margin:0,fontSize:"0.88rem"}}>{opt.label}</p>
                    <p style={{fontSize:"0.75rem",color:"var(--text-muted)",margin:0}}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <textarea
              value={checkinNote}
              onChange={e=>setCheckinNote(e.target.value)}
              placeholder="Any notes? (optional)"
              rows={2}
              style={{width:"100%",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-primary)",padding:"10px 12px",fontSize:"0.85rem",resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box" as const}}
            />
          </div>
        </div>
      )}

      {/* ── PREDICTION MODAL ── */}
      {showPrediction && prediction && (
        <div onClick={()=>setShowPrediction(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",width:"100%",maxWidth:"480px",overflow:"hidden"}}>

            {/* Header */}
            <div style={{padding:"1.5rem",background:prediction.status==="on_track"?"rgba(62,207,142,0.08)":prediction.status==="behind"?"rgba(251,191,36,0.08)":"rgba(248,113,113,0.08)",borderBottom:"1px solid var(--border)",textAlign:"center"}}>
              <p style={{fontSize:"2.5rem",margin:"0 0 8px"}}>{prediction.status==="on_track"?"🎯":prediction.status==="behind"?"⚠️":"🔥"}</p>
              <p style={{fontWeight:"700",fontSize:"1rem",margin:"0 0 6px",color:prediction.status==="on_track"?"#3ecf8e":prediction.status==="behind"?"#fbbf24":"#f87171"}}>
                {prediction.status==="on_track"?"On Track!":prediction.status==="behind"?"Slightly Behind":"Action Needed!"}
              </p>
              <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",margin:0,lineHeight:1.6}}>{prediction.message}</p>
            </div>

            <div style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"12px"}}>

              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                {[
                  {label:"Completed",   value:`${prediction.completedW}/${prediction.totalWeeks}`, sub:"weeks"},
                  {label:"Remaining",   value:String(prediction.remaining),                        sub:"weeks"},
                  {label:"Miss rate",   value:`${prediction.missRate}%`,                           sub:"days missed"},
                ].map(s=>(
                  <div key={s.label} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px",textAlign:"center"}}>
                    <p style={{fontSize:"1.2rem",fontWeight:"800",color,margin:0}}>{s.value}</p>
                    <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Advice */}
              <div style={{background:prediction.status==="critical"?"rgba(248,113,113,0.06)":"rgba(62,207,142,0.06)",border:`1px solid ${prediction.status==="critical"?"rgba(248,113,113,0.2)":"rgba(62,207,142,0.2)"}`,borderRadius:"var(--radius-lg)",padding:"1rem"}}>
                <p style={{fontWeight:"600",fontSize:"0.85rem",margin:"0 0 6px"}}>💡 Recommendation</p>
                <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0,lineHeight:1.6}}>{prediction.advice}</p>
              </div>

              {/* Motivational quote for behind students */}
              {prediction.status!=="on_track" && (
                <div style={{background:`${color}08`,border:`1px solid ${color}15`,borderRadius:"var(--radius-md)",padding:"10px 14px",textAlign:"center"}}>
                  <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0,fontStyle:"italic"}}>"{quote}"</p>
                </div>
              )}

              <button onClick={()=>setShowPrediction(false)} style={{width:"100%",padding:"12px",background:"var(--accent)",border:"none",borderRadius:"var(--radius-md)",color:"white",fontWeight:"700",fontSize:"0.9rem",cursor:"pointer"}}>
                Got it, let's study! 💪
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
