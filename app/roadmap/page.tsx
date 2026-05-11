"use client"
import { useState, useEffect, useRef } from "react"
import { getUser, getRoadmap, getProgress, toggleTask, updateCurrentWeek, getCurrentWeek, saveRoadmap } from "@/lib/supabase"
import Link from "next/link"
import WeekQuiz from "@/components/WeekQuiz"

const GOAL_COLORS: Record<string, string> = {
  competitive: "#7c6dfa",
  academic:    "#3ecf8e",
  coding:      "#60a5fa",
  skill:       "#fbbf24",
}

const PHASE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Foundation:    { color:"#60a5fa",  bg:"rgba(96,165,250,0.08)",   border:"rgba(96,165,250,0.2)"   },
  Intensive:     { color:"#f87171",  bg:"rgba(248,113,113,0.08)",  border:"rgba(248,113,113,0.2)"  },
  Consolidation: { color:"#fbbf24",  bg:"rgba(251,191,36,0.08)",   border:"rgba(251,191,36,0.2)"   },
  Revision:      { color:"#fbbf24",  bg:"rgba(251,191,36,0.08)",   border:"rgba(251,191,36,0.2)"   },
  Final:         { color:"#3ecf8e",  bg:"rgba(62,207,142,0.08)",   border:"rgba(62,207,142,0.2)"   },
  General:       { color:"#7c6dfa",  bg:"rgba(124,109,250,0.08)",  border:"rgba(124,109,250,0.2)"  },
}

function getPhaseStyle(phase: string) {
  for (const key of Object.keys(PHASE_STYLES)) {
    if (phase?.toLowerCase().includes(key.toLowerCase())) return PHASE_STYLES[key]
  }
  return PHASE_STYLES.General
}

const GOAL_TYPES = [
  { id:"competitive", label:"Competitive Exam", emoji:"🏆", desc:"UPSC, JEE, NEET, CAT" },
  { id:"academic",    label:"Academic",          emoji:"📚", desc:"School or college" },
  { id:"coding",      label:"Coding / Tech",     emoji:"💻", desc:"Programming, DSA" },
  { id:"skill",       label:"Skill Building",    emoji:"🎯", desc:"Language, music, design" },
]

const GOAL_QUESTIONS: Record<string, { label:string; options?:string[]; type:string; key:string }[]> = {
  competitive: [
    { label:"Which exam?",    key:"exam",   type:"select", options:["UPSC","JEE","NEET","CAT","SSC","GATE","Other"] },
    { label:"Months left?",   key:"months", type:"select", options:["1","2","3","4","5","6","9","12","18","24"] },
    { label:"Current level?", key:"level",  type:"select", options:["Just started","3-6 months in","More than 6 months"] },
    { label:"Daily hours?",   key:"hours",  type:"select", options:["2","4","6","8","10","12"] },
  ],
  academic: [
    { label:"Subject/course?", key:"subject",  type:"text" },
    { label:"Exam date?",      key:"examDate", type:"date" },
    { label:"Level?",          key:"level",    type:"select", options:["School","Undergraduate","Postgraduate","Other"] },
    { label:"Weakest area?",   key:"weakness", type:"text" },
  ],
  coding: [
    { label:"What to learn?",  key:"topic", type:"select", options:["Python","JavaScript","React","DSA","Java","C++","Machine Learning","Web Dev","Other"] },
    { label:"Current level?",  key:"level", type:"select", options:["Complete beginner","Know basics","Intermediate","Advanced"] },
    { label:"Your goal?",      key:"goal",  type:"select", options:["Get a job","Build a project","Crack interviews","Learn for fun","Freelancing"] },
    { label:"Hours per day?",  key:"hours", type:"select", options:["1","2","3","4","5","6"] },
  ],
  skill: [
    { label:"What skill?",     key:"skill",  type:"text" },
    { label:"Current level?",  key:"level",  type:"select", options:["Complete beginner","Some experience","Intermediate","Advanced"] },
    { label:"Why this skill?", key:"reason", type:"select", options:["Career change","Personal interest","Side income","Academic requirement","Other"] },
    { label:"Hours per day?",  key:"hours",  type:"select", options:["0.5","1","2","3","4"] },
  ],
}

export default function RoadmapPage() {
  const [roadmap,       setRoadmap]       = useState<any>(null)
  const [goalType,      setGoalType]      = useState("")
  const [loading,       setLoading]       = useState(true)
  const [progress,      setProgress]      = useState<any[]>([])
  const [currentWeek,   setCurrentWeek]   = useState(1)
  const [userId,        setUserId]        = useState("")
  const [expandedWeek,  setExpandedWeek]  = useState<number|null>(null)
  const [celebrating,   setCelebrating]   = useState(false)
  const [showRegen,     setShowRegen]     = useState(false)
  const [regenGoalType, setRegenGoalType] = useState("")
  const [regenAnswers,  setRegenAnswers]  = useState<Record<string,string>>({})
  const [regenerating,  setRegenerating]  = useState(false)
  const [regenMsg,      setRegenMsg]      = useState("")
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const [roadmapData, progressData, weekData] = await Promise.all([
        getRoadmap(user.id),
        getProgress(user.id),
        getCurrentWeek(user.id),
      ])
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
      setProgress(progressData)
      setCurrentWeek(weekData)
      setExpandedWeek(weekData)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior:"smooth", block:"center" })
  }, [loading])

  const isTaskDone = (weekNum: number, taskIdx: number) =>
    progress.some(p => p.week_number===weekNum && p.task_index===taskIdx && p.completed)

  const weekPct = (week: any, weekNum: number) => {
    const tasks = week.tasks || []
    if (!tasks.length) return 0
    return Math.round((tasks.filter((_: any, i: number) => isTaskDone(weekNum, i)).length / tasks.length) * 100)
  }

  const handleToggle = async (weekNum: number, taskIdx: number) => {
    const done = isTaskDone(weekNum, taskIdx)
    await toggleTask(userId, weekNum, taskIdx, !done)
    setProgress(prev => {
      const ex = prev.find(p => p.week_number===weekNum && p.task_index===taskIdx)
      if (ex) return prev.map(p => p.week_number===weekNum && p.task_index===taskIdx ? {...p,completed:!done} : p)
      return [...prev, { week_number:weekNum, task_index:taskIdx, completed:true }]
    })
    const week = weeks.find((w:any) => (w.week||0)===weekNum)
    if (week) {
      const tasks = week.tasks||[]
      const doneCount = tasks.filter((_:any,i:number) => i===taskIdx?!done:isTaskDone(weekNum,i)).length
      if (doneCount===tasks.length && !done) {
        // ── All tasks done → show quiz, don't auto advance ──
        setCelebrating(true)
        setTimeout(()=>setCelebrating(false),3000)
        // Keep week expanded so user sees the quiz
        setExpandedWeek(weekNum)
      }
    }
  }

  const handleRegen = async () => {
    if (!regenGoalType) return
    for (const q of GOAL_QUESTIONS[regenGoalType]||[]) {
      if (q.type!=="date"&&!regenAnswers[q.key]) { alert(`Please answer: ${q.label}`); return }
    }
    setRegenerating(true); setRegenMsg("D.K is building your new roadmap...")
    try {
      const user = await getUser()
      if (!user) return
      const prompts: Record<string,string> = {
        competitive:`Create a study roadmap for ${user.user_metadata?.name} preparing for ${regenAnswers.exam} with ${regenAnswers.months} months left, studying ${regenAnswers.hours} hours daily. Level: ${regenAnswers.level}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
        academic: (() => {
          const level    = (goalDetails as any).eduLevel  || ""
          const stream   = (goalDetails as any).stream    || ""
          const subject  = (goalDetails as any).subject   || ""
          const college  = (goalDetails as any).college   || ""
          const semester = (goalDetails as any).semester  || ""
          const research = (goalDetails as any).research  || ""
          const weakness = (goalDetails as any).weakness  || ""
          const examDate = (goalDetails as any).examDate  || ""
          const hours    = (goalDetails as any).hours     || "2"
          const isSchool = ["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard"].includes(level)
          const isHighSchool = ["11th Standard","12th Standard"].includes(level)
          const isUG = level === "Undergraduate (UG)"
          const isPG = level === "Postgraduate (PG)"
          const isPhD = level === "PhD"

          if (isSchool) {
            return `Create a NCERT-based study roadmap for ${name} who is in ${level}. Focus ONLY on NCERT syllabus. Exam date: ${examDate}. Weakest area: ${weakness}. Daily hours: ${hours}. Include chapter-wise weekly plan. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
          }
          if (isHighSchool) {
            return `Create a board exam roadmap for ${name} in ${level}, ${stream} stream. NCERT syllabus with reference books. Exam date: ${examDate}. Weakest area: ${weakness}. Daily hours: ${hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
          }
          if (isUG) {
            return `Create a semester roadmap for ${name} studying ${subject} at ${college}, ${semester}. Exam date: ${examDate}. Weakest area: ${weakness}. Daily hours: ${hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
          }
          if (isPG) {
            return `Create a postgraduate roadmap for ${name} studying ${subject} at ${college}, ${semester}. Advanced concepts and research. Exam date: ${examDate}. Weakest area: ${weakness}. Daily hours: ${hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
          }
          if (isPhD) {
            return `Create a PhD research roadmap for ${name} researching ${research} at ${college}. Literature review, methodology, writing phases. Daily hours: ${hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
          }
          return `Create a study roadmap for ${name} at ${level}. Subject: ${subject}. Exam: ${examDate}. Weakest: ${weakness}. Hours: ${hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
        })(),
        coding:`Create a coding roadmap for ${user.user_metadata?.name} learning ${regenAnswers.topic}. Level: ${regenAnswers.level}. Goal: ${regenAnswers.goal}. Hours: ${regenAnswers.hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
        skill:`Create a skill roadmap for ${user.user_metadata?.name} learning ${regenAnswers.skill}. Level: ${regenAnswers.level}. Reason: ${regenAnswers.reason}. Hours: ${regenAnswers.hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
      }
      const res  = await fetch("/api/roadmap", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt:prompts[regenGoalType]}) })
      const data = await res.json()
      let newRoadmap
      try {
        let clean=data.reply.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
        newRoadmap=JSON.parse(clean)
      } catch { newRoadmap={overview:data.reply,weeks:[],strategy:""} }
      setRegenMsg("Saving your new roadmap...")
      await saveRoadmap(user.id,newRoadmap,regenGoalType,regenAnswers)
      await updateCurrentWeek(user.id,1)
      setProgress([]); setCurrentWeek(1); setExpandedWeek(1)
      setRoadmap(newRoadmap); setGoalType(regenGoalType)
      setShowRegen(false); setRegenGoalType(""); setRegenAnswers({}); setRegenMsg("")
    } catch(e) { console.error(e) }
    finally { setRegenerating(false) }
  }

  const color = GOAL_COLORS[goalType] || "#7c6dfa"

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",border:"3px solid rgba(124,109,250,0.2)",borderTop:"3px solid #7c6dfa",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading your roadmap...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!roadmap) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"3rem",marginBottom:"12px"}}>🗺️</div>
        <p style={{fontWeight:"600",marginBottom:"8px"}}>No roadmap yet</p>
        <Link href="/signup" style={{background:"var(--accent)",borderRadius:"var(--radius-md)",padding:"10px 24px",color:"white",textDecoration:"none",fontWeight:"600"}}>Get Started →</Link>
      </div>
    </div>
  )

  const weeks = roadmap.weeks||[]
  const overview = roadmap.overview||{}
  const strategy = roadmap.strategy||""
  const totalWeeks = weeks.length
  const completedWeeks = weeks.filter((w:any,i:number)=>weekPct(w,w.week||i+1)===100).length
  const overallPct = totalWeeks>0?Math.round((completedWeeks/totalWeeks)*100):0

  const phases: Record<string,any[]> = {}
  weeks.forEach((w:any,i:number)=>{
    const phase=w.phase||"General"
    if (!phases[phase]) phases[phase]=[]
    phases[phase].push({...w,originalIndex:i})
  })

  const inputStyle = { width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-primary)", padding:"8px 12px", fontSize:"0.85rem", outline:"none", boxSizing:"border-box" as const }

  return (
    <div style={{minHeight:"100vh",padding:"2rem 1.5rem",maxWidth:"720px",margin:"0 auto",paddingBottom:"100px"}}>

      {/* Celebration */}
      {celebrating && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"linear-gradient(90deg,var(--accent),#3ecf8e)",padding:"14px",textAlign:"center",fontSize:"0.95rem",fontWeight:"700",color:"white",animation:"slideDown 0.3s ease"}}>
          🎉 Week Complete! Moving to next week →
          <style>{`@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}`}</style>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"2rem"}}>
        <a href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</a>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>My Roadmap</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.8rem",margin:0}}>
            {typeof overview==="object" ? overview.exam||overview.subject||"AI generated study plan" : "AI generated study plan"}
          </p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:"1.2rem",fontWeight:"800",color,margin:0}}>{overallPct}%</p>
            <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>complete</p>
          </div>
          <button onClick={()=>setShowRegen(s=>!s)} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-secondary)",padding:"7px 12px",fontSize:"0.75rem",cursor:"pointer",fontWeight:"500"}}>
            {showRegen?"✕ Cancel":"🔄 Change Goal"}
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
          <div>
            <p style={{fontWeight:"600",fontSize:"0.88rem",margin:"0 0 2px"}}>Overall Progress</p>
            <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{completedWeeks}/{totalWeeks} weeks complete</p>
          </div>
          <div style={{display:"flex",gap:"12px",textAlign:"center"}}>
            {[
              {label:"Weeks done",  value:completedWeeks, color},
              {label:"Remaining",   value:totalWeeks-completedWeeks, color:"var(--text-muted)"},
            ].map(s=>(
              <div key={s.label}>
                <p style={{fontSize:"1.3rem",fontWeight:"800",color:s.color,margin:0}}>{s.value}</p>
                <p style={{fontSize:"0.6rem",color:"var(--text-muted)",margin:0}}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{width:`${overallPct}%`,background:`linear-gradient(90deg,${color},#3ecf8e)`}}/>
        </div>
      </div>

      {/* Regen form */}
      {showRegen && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.5rem",marginBottom:"1.5rem"}}>
          <h3 style={{fontWeight:"600",fontSize:"1rem",margin:"0 0 4px"}}>Change Your Goal</h3>
          <p style={{color:"var(--text-muted)",fontSize:"0.8rem",marginBottom:"1.2rem"}}>⚠️ This will generate a new roadmap and reset your progress</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"1rem"}}>
            {GOAL_TYPES.map(g=>(
              <button key={g.id} onClick={()=>{setRegenGoalType(g.id);setRegenAnswers({})}} style={{padding:"10px",borderRadius:"var(--radius-md)",cursor:"pointer",background:regenGoalType===g.id?"var(--accent-soft)":"var(--bg-elevated)",border:`1px solid ${regenGoalType===g.id?"var(--accent-border)":"var(--border)"}`,color:"var(--text-primary)",textAlign:"left",transition:"all 0.2s"}}>
                <div style={{fontSize:"1.2rem",marginBottom:"2px"}}>{g.emoji}</div>
                <div style={{fontSize:"0.78rem",fontWeight:"600"}}>{g.label}</div>
                <div style={{fontSize:"0.65rem",color:"var(--text-muted)"}}>{g.desc}</div>
              </button>
            ))}
          </div>
          {regenGoalType && (
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"1rem"}}>
              {GOAL_QUESTIONS[regenGoalType].map(q=>(
                <div key={q.key}>
                  <label style={{fontSize:"0.75rem",color:"var(--text-secondary)",display:"block",marginBottom:"4px",fontWeight:"500"}}>{q.label}</label>
                  {q.type==="select"&&q.options ? (
                    <select value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}>
                      <option value="">Select...</option>
                      {q.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : q.type==="date" ? (
                    <input type="date" value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} style={{...inputStyle,colorScheme:"dark"}}/>
                  ) : (
                    <input type="text" value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} placeholder={`Enter ${q.label.toLowerCase()}`} style={inputStyle}/>
                  )}
                </div>
              ))}
            </div>
          )}
          {regenMsg && (
            <div style={{background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:"var(--radius-md)",padding:"10px",marginBottom:"12px",fontSize:"0.82rem",color:"var(--accent)",textAlign:"center"}}>
              ⚙️ {regenMsg}
              <div className="progress-bar" style={{marginTop:"8px"}}>
                <div className="progress-fill" style={{width:"100%",background:"var(--accent)",animation:"loading 30s linear forwards"}}/>
              </div>
              <style>{`@keyframes loading{from{width:0%}to{width:100%}}`}</style>
            </div>
          )}
          <button onClick={handleRegen} disabled={regenerating||!regenGoalType} style={{width:"100%",padding:"12px",background:regenerating||!regenGoalType?"var(--bg-elevated)":"var(--accent)",border:"none",borderRadius:"var(--radius-md)",color:regenerating||!regenGoalType?"var(--text-muted)":"white",fontSize:"0.9rem",fontWeight:"600",cursor:regenerating||!regenGoalType?"not-allowed":"pointer"}}>
            {regenerating?"D.K is building your plan... ⚙️":"Generate New Roadmap 🚀"}
          </button>
        </div>
      )}

      {/* Strategy */}
      {strategy && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1.2rem",marginBottom:"1.5rem"}}>
          <p style={{fontWeight:"600",fontSize:"0.85rem",margin:"0 0 8px"}}>🧠 Strategy</p>
          <div style={{fontSize:"0.82rem",color:"var(--text-secondary)",lineHeight:1.7}}>
          {typeof strategy === "string" ? (
            <p style={{margin:0}}>{strategy}</p>
          ) : (
            Object.entries(strategy as Record<string,any>).map(([key,value])=>(
              <div key={key} style={{marginBottom:"10px"}}>
                <p style={{fontWeight:"700",color:"var(--accent)",margin:"0 0 4px",textTransform:"capitalize"}}>{key.replace(/_/g," ")}</p>
                <p style={{margin:0,color:"var(--text-secondary)"}}>
                  {Array.isArray(value)
                    ? value.join(" · ")
                    : typeof value==="object"&&value!==null
                    ? Object.entries(value).map(([k,v])=>`${k.replace(/_/g," ")}: ${v}`).join(" · ")
                    : String(value)}
                </p>
              </div>
            ))
          )}
        </div>
        </div>
      )}

      {/* Road */}
      {Object.entries(phases).map(([phase,phaseWeeks],phaseIdx)=>{
        const ps = getPhaseStyle(phase)
        const phaseTotal = phaseWeeks.length
        const phaseDone  = phaseWeeks.filter(w=>weekPct(w,w.week||w.originalIndex+1)===100).length
        const phasePct   = Math.round((phaseDone/phaseTotal)*100)
        const isComplete = phasePct===100

        return (
          <div key={phase} style={{marginBottom:"2rem"}}>

            {/* Phase header */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",borderRadius:"var(--radius-md)",background:ps.bg,border:`1px solid ${ps.border}`,marginBottom:"12px"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:isComplete?"#3ecf8e":ps.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",fontWeight:"700",color:"white",flexShrink:0}}>
                {isComplete?"✓":phaseIdx+1}
              </div>
              <div style={{flex:1}}>
                <p style={{fontWeight:"700",color:ps.color,margin:0,fontSize:"0.9rem"}}>{phase}</p>
                <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>{phaseTotal} weeks · {phaseDone}/{phaseTotal} complete</p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"80px"}}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${phasePct}%`,background:ps.color}}/>
                  </div>
                </div>
                <span style={{fontSize:"0.82rem",fontWeight:"700",color:ps.color,minWidth:"36px",textAlign:"right"}}>{phasePct}%</span>
              </div>
            </div>

            {/* Weeks */}
            <div style={{paddingLeft:"16px",borderLeft:`2px solid ${ps.border}`,marginLeft:"14px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {phaseWeeks.map((week:any)=>{
                const weekNum   = week.week||week.originalIndex+1
                const pct       = weekPct(week,weekNum)
                const isActive  = weekNum===currentWeek
                const isDone    = pct===100
                const isLocked  = weekNum>currentWeek+2
                const isExpanded= expandedWeek===weekNum
                const tasks     = week.tasks||[]

                return (
                  <div key={weekNum} ref={isActive?activeRef:undefined} style={{position:"relative"}}>

                    {/* Road dot */}
                    <div style={{position:"absolute",left:"-21px",top:"16px",width:"10px",height:"10px",borderRadius:"50%",background:isDone?"#3ecf8e":isActive?ps.color:"var(--bg-elevated)",border:`2px solid ${isDone?"#3ecf8e":isActive?ps.color:"var(--border)"}`,boxShadow:isActive?`0 0 10px ${ps.color}`:undefined,transition:"all 0.3s"}}/>

                    {/* Week card */}
                    <div onClick={()=>!isLocked&&setExpandedWeek(isExpanded?null:weekNum)} style={{background:isActive?ps.bg:"var(--bg-card)",borderRadius:"var(--radius-lg)",border:`1px solid ${isActive?ps.border:"var(--border)"}`,padding:"12px 14px",cursor:isLocked?"not-allowed":"pointer",opacity:isLocked?0.5:1,transition:"all 0.2s"}}>

                      {/* Week header row */}
                      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                        <div style={{width:"30px",height:"30px",borderRadius:"var(--radius-sm)",background:isDone?"rgba(62,207,142,0.15)":isActive?`${ps.color}15`:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.78rem",fontWeight:"700",color:isDone?"#3ecf8e":isActive?ps.color:"var(--text-muted)",flexShrink:0}}>
                          {isDone?"✓":`W${weekNum}`}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontWeight:"600",fontSize:"0.82rem",margin:0,color:isDone?"var(--text-muted)":isActive?"var(--text-primary)":"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {week.focus}
                          </p>
                          {week.hours && <p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0}}>{week.hours}h this week</p>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                          <div style={{width:"50px"}}>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{width:`${pct}%`,background:isDone?"#3ecf8e":ps.color}}/>
                            </div>
                          </div>
                          <span style={{fontSize:"0.68rem",fontWeight:"600",color:isDone?"#3ecf8e":isActive?ps.color:"var(--text-muted)",minWidth:"28px",textAlign:"right"}}>{pct}%</span>
                          <span style={{color:"var(--text-muted)",fontSize:"0.7rem"}}>{isExpanded?"▲":"▼"}</span>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExpanded && !isLocked && (
                        <div style={{marginTop:"14px",borderTop:"1px solid var(--border)",paddingTop:"14px"}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
                            <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0,fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px"}}>Tasks</p>
                            <span style={{fontSize:"0.72rem",color:ps.color,fontWeight:"600"}}>{tasks.filter((_:any,i:number)=>isTaskDone(weekNum,i)).length}/{tasks.length} done</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {tasks.map((task:string,tIdx:number)=>{
                              const done=isTaskDone(weekNum,tIdx)
                              return (
                                <div key={tIdx} onClick={()=>handleToggle(weekNum,tIdx)} style={{display:"flex",gap:"10px",alignItems:"flex-start",padding:"10px 12px",borderRadius:"var(--radius-md)",cursor:"pointer",background:done?"rgba(62,207,142,0.06)":"var(--bg-elevated)",border:`1px solid ${done?"rgba(62,207,142,0.2)":"var(--border)"}`,transition:"all 0.2s"}}>
                                  <div style={{width:"18px",height:"18px",borderRadius:"5px",flexShrink:0,background:done?"#3ecf8e":"transparent",border:`2px solid ${done?"#3ecf8e":"var(--text-muted)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",color:"white",fontWeight:"700",marginTop:"1px"}}>
                                    {done?"✓":""}
                                  </div>
                                  <p style={{fontSize:"0.82rem",margin:0,lineHeight:1.5,color:done?"var(--text-muted)":"var(--text-primary)",textDecoration:done?"line-through":"none"}}>{task}</p>
                                </div>
                              )
                            })}
                          </div>

                          {pct<100 ? (
                            <button onClick={async()=>{
                              for(let i=0;i<tasks.length;i++) if(!isTaskDone(weekNum,i)) await toggleTask(userId,weekNum,i,true)
                              setProgress(prev=>{const u=[...prev];tasks.forEach((_:any,i:number)=>{const e=u.find(p=>p.week_number===weekNum&&p.task_index===i);if(e)e.completed=true;else u.push({week_number:weekNum,task_index:i,completed:true})});return u})
                              setCelebrating(true);setTimeout(()=>setCelebrating(false),3000)
                              // Keep expanded to show quiz
                              setExpandedWeek(weekNum)
                            }} style={{width:"100%",marginTop:"12px",padding:"9px",background:`${ps.color}15`,border:`1px solid ${ps.border}`,borderRadius:"var(--radius-md)",color:ps.color,fontSize:"0.82rem",fontWeight:"600",cursor:"pointer"}}>
                              ✓ Mark Week {weekNum} Complete
                            </button>
                          ) : (
                            <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
                              <div style={{textAlign:"center",padding:"8px",background:"rgba(62,207,142,0.08)",borderRadius:"var(--radius-md)",color:"#3ecf8e",fontSize:"0.82rem",fontWeight:"600"}}>
                                🎉 Week {weekNum} Complete!
                              </div>
                              <div style={{borderTop:"1px solid var(--border)",paddingTop:"10px"}}>
                                <WeekQuiz
                                  weekNumber={weekNum}
                                  weekFocus={week.focus||""}
                                  weekTasks={tasks}
                                  goalType={goalType}
                                  color={ps.color}
                                  userId={userId}
                                  onPassed={()=>{
                                    setCelebrating(true)
                                    setTimeout(()=>setCelebrating(false),3000)
                                    const next=weekNum+1
                                    setCurrentWeek(next)
                                    setExpandedWeek(next)
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isLocked && (
                        <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:"6px 0 0",textAlign:"center"}}>
                          🔒 Complete previous weeks to unlock
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Phase complete */}
            {isComplete && (
              <div style={{background:"rgba(62,207,142,0.08)",border:"1px solid rgba(62,207,142,0.2)",borderRadius:"var(--radius-md)",padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px",marginLeft:"14px",marginTop:"8px"}}>
                <span style={{fontSize:"1.2rem"}}>🏅</span>
                <p style={{fontSize:"0.82rem",color:"#3ecf8e",fontWeight:"600",margin:0}}>{phase} Phase Complete! Great work!</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Finish line */}
      <div style={{textAlign:"center",padding:"2rem 1rem",background:overallPct===100?"rgba(62,207,142,0.08)":"var(--bg-card)",borderRadius:"var(--radius-xl)",border:overallPct===100?"1px solid rgba(62,207,142,0.2)":"2px dashed var(--border)",marginLeft:"14px"}}>
        <div style={{fontSize:"3rem",marginBottom:"8px"}}>{overallPct===100?"🏆":"🏁"}</div>
        <p style={{fontWeight:"700",fontSize:"1rem",margin:0,color:overallPct===100?"#3ecf8e":"var(--text-muted)"}}>
          {overallPct===100?"Congratulations! Roadmap Complete!":"Finish Line"}
        </p>
        <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:"4px 0 0"}}>
          {overallPct===100?"You've completed your entire study roadmap! 🎉":`${totalWeeks-completedWeeks} weeks remaining · Keep going!`}
        </p>
        {overallPct===100 && (
          <Link href="/session" style={{display:"inline-block",marginTop:"12px",background:"var(--accent)",borderRadius:"var(--radius-md)",padding:"10px 24px",color:"white",textDecoration:"none",fontWeight:"600",fontSize:"0.88rem"}}>
            Start Final Revision 🚀
          </Link>
        )}
      </div>

    </div>
  )
}
