"use client"
import { useState, useEffect, useRef } from "react"
import { getUser, getRoadmap, getProgress, toggleTask, updateCurrentWeek, getCurrentWeek, saveRoadmap } from "@/lib/supabase"
import Link from "next/link"
import WeekQuiz from "@/components/WeekQuiz"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
}

const PHASE_STYLES: Record<string,{color:string;bg:string;border:string}> = {
  Foundation:    { color:"#5ac8fa",  bg:"rgba(90,200,250,0.08)",   border:"rgba(90,200,250,0.2)"   },
  Intensive:     { color:"#ff453a",  bg:"rgba(255,69,58,0.08)",    border:"rgba(255,69,58,0.2)"    },
  Consolidation: { color:"#ff9f0a",  bg:"rgba(255,159,10,0.08)",   border:"rgba(255,159,10,0.2)"   },
  Revision:      { color:"#ff9f0a",  bg:"rgba(255,159,10,0.08)",   border:"rgba(255,159,10,0.2)"   },
  Final:         { color:"#30d158",  bg:"rgba(48,209,88,0.08)",    border:"rgba(48,209,88,0.2)"    },
  General:       { color:"#0a84ff",  bg:"rgba(10,132,255,0.08)",   border:"rgba(10,132,255,0.2)"   },
}

function getPhaseStyle(phase:string) {
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

const GOAL_QUESTIONS: Record<string,{label:string;options?:string[];type:string;key:string;dependsOn?:string;showWhen?:string[]}[]> = {
  competitive: [
    { label:"Which exam?",           key:"exam",   type:"select", options:["UPSC","JEE","NEET","CAT","SSC","GATE","Other"] },
    { label:"Months left?",          key:"months", type:"select", options:["1","2","3","4","5","6","9","12","18","24"] },
    { label:"Current level?",        key:"level",  type:"select", options:["Just started","3-6 months in","More than 6 months"] },
    { label:"Daily hours available?",key:"hours",  type:"select", options:["2","4","6","8","10","12"] },
  ],
  academic: [
    { label:"Education level?",      key:"eduLevel", type:"select", options:["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard","11th Standard","12th Standard","Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"Which stream?",         key:"stream",   type:"select", options:["Science (PCM)","Science (PCB)","Science (PCMB)","Commerce","Arts / Humanities","Other"], dependsOn:"eduLevel", showWhen:["11th Standard","12th Standard"] },
    { label:"Subject/course?",       key:"subject",  type:"text",   dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"University/College?",   key:"college",  type:"text",   dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"Semester/Year?",        key:"semester", type:"select", options:["1st Sem","2nd Sem","3rd Sem","4th Sem","5th Sem","6th Sem","7th Sem","8th Sem","1st Year","2nd Year","3rd Year"], dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)"] },
    { label:"Research topic?",       key:"research", type:"text",   dependsOn:"eduLevel", showWhen:["PhD"] },
    { label:"Exam date?",            key:"examDate", type:"date" },
    { label:"Weakest area?",         key:"weakness", type:"text" },
    { label:"Daily hours?",          key:"hours",    type:"select", options:["1","2","3","4","5","6","8"] },
  ],
  coding: [
    { label:"What to learn?",  key:"topic", type:"select", options:["Python","JavaScript","React","DSA","Java","C++","Machine Learning","Web Dev","App Dev","Other"] },
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
  const [showStrategy,  setShowStrategy]  = useState(false)
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { window.location.href="/login"; return }
      setUserId(user.id)
      const [roadmapData, progressData, weekData] = await Promise.all([
        getRoadmap(user.id), getProgress(user.id), getCurrentWeek(user.id)
      ])
      if (roadmapData) {
        let rm=roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
        }
        setRoadmap(rm); setGoalType(roadmapData.goal_type||"")
      }
      setProgress(progressData); setCurrentWeek(weekData); setExpandedWeek(weekData)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior:"smooth", block:"center" })
  }, [loading])

  const isTaskDone = (weekNum:number, taskIdx:number) =>
    progress.some(p=>p.week_number===weekNum&&p.task_index===taskIdx&&p.completed)

  const weekPct = (week:any, weekNum:number) => {
    const tasks=week.tasks||[]
    if (!tasks.length) return 0
    return Math.round((tasks.filter((_:any,i:number)=>isTaskDone(weekNum,i)).length/tasks.length)*100)
  }

  const handleToggle = async (weekNum:number, taskIdx:number) => {
    const done=isTaskDone(weekNum,taskIdx)
    await toggleTask(userId,weekNum,taskIdx,!done)
    setProgress(prev=>{
      const ex=prev.find(p=>p.week_number===weekNum&&p.task_index===taskIdx)
      if (ex) return prev.map(p=>p.week_number===weekNum&&p.task_index===taskIdx?{...p,completed:!done}:p)
      return [...prev,{week_number:weekNum,task_index:taskIdx,completed:true}]
    })
    const week=weeks.find((w:any)=>(w.week||0)===weekNum)
    if (week) {
      const tasks=week.tasks||[]
      const doneCount=tasks.filter((_:any,i:number)=>i===taskIdx?!done:isTaskDone(weekNum,i)).length
      if (doneCount===tasks.length&&!done) { setCelebrating(true); setTimeout(()=>setCelebrating(false),3000); setExpandedWeek(weekNum) }
    }
  }

  const handleRegen = async () => {
    if (!regenGoalType) return
    const visibleQ=(GOAL_QUESTIONS[regenGoalType]||[]).filter(q=>{
      if (!q.dependsOn) return true
      const depVal=regenAnswers[q.dependsOn]
      if (!depVal) return false
      return q.showWhen?.includes(depVal)??true
    })
    for (const q of visibleQ) { if (q.type!=="date"&&!regenAnswers[q.key]) { alert(`Please answer: ${q.label}`); return } }
    setRegenerating(true); setRegenMsg("D.K is building your new roadmap...")
    try {
      const user=await getUser(); if (!user) return
      const name=user.user_metadata?.name||"Student"
      const a=regenAnswers as any
      const prompts: Record<string,string> = {
        competitive:`Create a study roadmap for ${name} preparing for ${a.exam} with ${a.months} months left, ${a.hours} hours daily. Level: ${a.level}. Return JSON: overview (string), weeks (array max 20: week, phase, focus, tasks array 4 items, hours), strategy (string).`,
        academic: (()=>{
          const level=a.eduLevel||""; const isSchool=["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard"].includes(level)
          const isHigh=["11th Standard","12th Standard"].includes(level); const isUG=level==="Undergraduate (UG)"; const isPG=level==="Postgraduate (PG)"; const isPhD=level==="PhD"
          if (isSchool) return `Create NCERT-based roadmap for ${name} in ${level}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
          if (isHigh)   return `Create board exam roadmap for ${name} in ${level}, ${a.stream} stream. NCERT focus. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 20: week, phase, focus, tasks 4 items, hours), strategy.`
          if (isUG)     return `Create semester roadmap for ${name} studying ${a.subject} at ${a.college}, ${a.semester}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
          if (isPG)     return `Create PG roadmap for ${name} studying ${a.subject} at ${a.college}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
          if (isPhD)    return `Create PhD roadmap for ${name} researching ${a.research} at ${a.college}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 20: week, phase, focus, tasks 4 items, hours), strategy.`
          return `Create study roadmap for ${name} at ${level}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`
        })(),
        coding:`Create coding roadmap for ${name} learning ${a.topic}. Level: ${a.level}. Goal: ${a.goal}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`,
        skill:`Create skill roadmap for ${name} learning ${a.skill}. Level: ${a.level}. Reason: ${a.reason}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`,
      }
      const res=await fetch("/api/roadmap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:prompts[regenGoalType]})})
      const data=await res.json()
      let newRoadmap
      try { let clean=data.reply.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim(); newRoadmap=JSON.parse(clean) }
      catch { newRoadmap={overview:data.reply,weeks:[],strategy:""} }
      setRegenMsg("Saving your new roadmap...")
      await saveRoadmap(user.id,newRoadmap,regenGoalType,regenAnswers)
      await updateCurrentWeek(user.id,1)
      setProgress([]); setCurrentWeek(1); setExpandedWeek(1)
      setRoadmap(newRoadmap); setGoalType(regenGoalType)
      setShowRegen(false); setRegenGoalType(""); setRegenAnswers({}); setRegenMsg("")
    } catch(e){console.error(e)} finally{setRegenerating(false)}
  }

  const color=GOAL_COLORS[goalType]||"#0a84ff"
  const strategy=roadmap?.strategy||""
  const overview=roadmap?.overview||{}

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:"36px",height:"36px",border:"3px solid rgba(10,132,255,0.2)",borderTop:"3px solid #0a84ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:"var(--text-muted)",fontSize:"0.85rem"}}>Loading your roadmap...</p>
      </div>
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

  const weeks=roadmap.weeks||[]
  const totalWeeks=weeks.length
  const completedWeeks=weeks.filter((w:any,i:number)=>weekPct(w,w.week||i+1)===100).length
  const overallPct=totalWeeks>0?Math.round((completedWeeks/totalWeeks)*100):0

  const phases: Record<string,any[]>={}
  weeks.forEach((w:any,i:number)=>{ const phase=w.phase||"General"; if(!phases[phase]) phases[phase]=[]; phases[phase].push({...w,originalIndex:i}) })

  const inputStyle={width:"100%",padding:"10px 14px",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-primary)",fontSize:"0.88rem",outline:"none",boxSizing:"border-box" as const,colorScheme:"dark" as const}

  return (
    <div style={{minHeight:"100vh",padding:"1.5rem",maxWidth:"680px",margin:"0 auto",paddingBottom:"100px"}}>

      {/* Celebration */}
      {celebrating && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:"linear-gradient(90deg,#0a84ff,#30d158)",padding:"14px",textAlign:"center",fontSize:"0.95rem",fontWeight:"700",color:"white",animation:"slideDown 0.3s ease"}}>
          🎉 All tasks done! Take the quiz to unlock next week →
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1.8rem"}}>
        <Link href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</Link>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:0}}>My Roadmap</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.78rem",margin:0}}>
            {typeof overview==="object"?overview.exam||overview.subject||"AI study plan":"AI study plan"}
          </p>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          {strategy && (
            <button onClick={()=>setShowStrategy(true)} style={{background:"rgba(10,132,255,0.12)",border:"1px solid rgba(10,132,255,0.25)",borderRadius:"var(--radius-md)",color:"var(--accent)",padding:"7px 12px",fontSize:"0.75rem",cursor:"pointer",fontWeight:"600"}}>
              🧠 Strategy
            </button>
          )}
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:"1.3rem",fontWeight:"800",color,margin:0}}>{overallPct}%</p>
            <p style={{fontSize:"0.6rem",color:"var(--text-muted)",margin:0}}>complete</p>
          </div>
          <button onClick={()=>setShowRegen(s=>!s)} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-muted)",padding:"7px 12px",fontSize:"0.72rem",cursor:"pointer"}}>
            {showRegen?"✕":"🔄"}
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.2rem",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
          <div>
            <p style={{fontWeight:"600",fontSize:"0.88rem",margin:"0 0 2px"}}>Overall Progress</p>
            <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0}}>{completedWeeks}/{totalWeeks} weeks complete</p>
          </div>
          <div style={{display:"flex",gap:"16px",textAlign:"center"}}>
            {[{label:"Done",value:completedWeeks,color},{label:"Left",value:totalWeeks-completedWeeks,color:"var(--text-muted)"}].map(s=>(
              <div key={s.label}>
                <p style={{fontSize:"1.4rem",fontWeight:"800",color:s.color,margin:0,lineHeight:1}}>{s.value}</p>
                <p style={{fontSize:"0.6rem",color:"var(--text-muted)",margin:0}}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{width:`${overallPct}%`,background:`linear-gradient(90deg,${color},#30d158)`}}/>
        </div>
      </div>

      {/* Regen form */}
      {showRegen && (
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.5rem",marginBottom:"1.5rem"}}>
          <h3 style={{fontWeight:"700",fontSize:"1rem",margin:"0 0 4px"}}>Change Your Goal</h3>
          <p style={{color:"var(--text-muted)",fontSize:"0.78rem",marginBottom:"1.2rem"}}>⚠️ This will reset your progress</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"1rem"}}>
            {GOAL_TYPES.map(g=>(
              <button key={g.id} onClick={()=>{setRegenGoalType(g.id);setRegenAnswers({})}} style={{padding:"10px",borderRadius:"var(--radius-md)",cursor:"pointer",background:regenGoalType===g.id?"rgba(10,132,255,0.12)":"var(--bg-elevated)",border:`1px solid ${regenGoalType===g.id?"rgba(10,132,255,0.3)":"var(--border)"}`,color:"var(--text-primary)",textAlign:"left",transition:"all 0.2s"}}>
                <div style={{fontSize:"1.2rem",marginBottom:"2px"}}>{g.emoji}</div>
                <div style={{fontSize:"0.78rem",fontWeight:"600"}}>{g.label}</div>
                <div style={{fontSize:"0.65rem",color:"var(--text-muted)"}}>{g.desc}</div>
              </button>
            ))}
          </div>
          {regenGoalType && (
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"1rem"}}>
              {(GOAL_QUESTIONS[regenGoalType]||[]).filter(q=>{
                if (!q.dependsOn) return true
                const depVal=regenAnswers[q.dependsOn]
                if (!depVal) return false
                return q.showWhen?.includes(depVal)??true
              }).map(q=>(
                <div key={q.key}>
                  <label style={{fontSize:"0.75rem",color:"var(--text-secondary)",display:"block",marginBottom:"4px",fontWeight:"500"}}>{q.label}</label>
                  {q.type==="select"&&q.options?(
                    <select value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}>
                      <option value="">Select...</option>
                      {q.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ):q.type==="date"?(
                    <input type="date" value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}/>
                  ):(
                    <input type="text" value={regenAnswers[q.key]||""} onChange={e=>setRegenAnswers(a=>({...a,[q.key]:e.target.value}))} placeholder={`Enter ${q.label.toLowerCase()}`} style={inputStyle}/>
                  )}
                </div>
              ))}
            </div>
          )}
          {regenMsg && (
            <div style={{background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:"var(--radius-md)",padding:"10px",marginBottom:"12px",fontSize:"0.82rem",color:"var(--accent)",textAlign:"center"}}>⚙️ {regenMsg}</div>
          )}
          <button onClick={handleRegen} disabled={regenerating||!regenGoalType} style={{width:"100%",padding:"12px",background:regenerating||!regenGoalType?"var(--bg-elevated)":"var(--accent)",border:"none",borderRadius:"var(--radius-md)",color:regenerating||!regenGoalType?"var(--text-muted)":"white",fontSize:"0.9rem",fontWeight:"600",cursor:regenerating||!regenGoalType?"not-allowed":"pointer",boxShadow:regenerating||!regenGoalType?"none":"0 4px 16px rgba(10,132,255,0.3)"}}>
            {regenerating?"D.K is building your plan... ⚙️":"Generate New Roadmap 🚀"}
          </button>
        </div>
      )}

      {/* Phases + Weeks */}
      {Object.entries(phases).map(([phase,phaseWeeks],phaseIdx)=>{
        const ps=getPhaseStyle(phase)
        const phaseTotal=phaseWeeks.length
        const phaseDone=phaseWeeks.filter(w=>weekPct(w,w.week||w.originalIndex+1)===100).length
        const phasePct=Math.round((phaseDone/phaseTotal)*100)
        const isComplete=phasePct===100

        return (
          <div key={phase} style={{marginBottom:"2rem"}}>
            {/* Phase header */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
              <div style={{width:"32px",height:"32px",borderRadius:"50%",background:isComplete?"#30d158":ps.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",fontWeight:"700",color:"white",flexShrink:0,boxShadow:`0 0 12px ${isComplete?"#30d158":ps.color}44`}}>
                {isComplete?"✓":phaseIdx+1}
              </div>
              <div style={{flex:1}}>
                <p style={{fontWeight:"700",color:ps.color,margin:0,fontSize:"0.9rem"}}>{phase}</p>
                <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>{phaseTotal} weeks · {phaseDone}/{phaseTotal} complete</p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"60px"}}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${phasePct}%`,background:ps.color}}/>
                  </div>
                </div>
                <span style={{fontSize:"0.78rem",fontWeight:"700",color:ps.color,minWidth:"36px",textAlign:"right"}}>{phasePct}%</span>
              </div>
            </div>

            {/* Week cards */}
            <div style={{paddingLeft:"16px",borderLeft:`2px solid ${ps.border}`,marginLeft:"16px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {phaseWeeks.map((week:any)=>{
                const weekNum=week.week||week.originalIndex+1
                const pct=weekPct(week,weekNum)
                const isActive=weekNum===currentWeek
                const isDone=pct===100
                const isLocked=weekNum>currentWeek+2
                const isExpanded=expandedWeek===weekNum
                const tasks=week.tasks||[]

                return (
                  <div key={weekNum} ref={isActive?activeRef:undefined} style={{position:"relative"}}>
                    {/* Timeline dot */}
                    <div style={{position:"absolute",left:"-21px",top:"20px",width:"10px",height:"10px",borderRadius:"50%",background:isDone?"#30d158":isActive?ps.color:"var(--bg-elevated)",border:`2px solid ${isDone?"#30d158":isActive?ps.color:"var(--border)"}`,boxShadow:isActive?`0 0 10px ${ps.color}`:undefined,transition:"all 0.3s"}}/>

                    {/* Week card */}
                    <div onClick={()=>!isLocked&&setExpandedWeek(isExpanded?null:weekNum)} style={{
                      background:isActive?ps.bg:"var(--bg-card)",
                      borderRadius:"var(--radius-xl)",
                      border:`1px solid ${isActive?ps.border:"var(--border)"}`,
                      padding:"14px 16px",
                      cursor:isLocked?"not-allowed":"pointer",
                      opacity:isLocked?0.5:1,
                      transition:"all 0.2s",
                      boxShadow:isActive?`0 4px 20px ${ps.color}22`:undefined
                    }}>
                      {/* Week header */}
                      <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                        <div style={{width:"36px",height:"36px",borderRadius:"var(--radius-md)",background:isDone?"rgba(48,209,88,0.12)":isActive?`${ps.color}15`:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.82rem",fontWeight:"700",color:isDone?"#30d158":isActive?ps.color:"var(--text-muted)",flexShrink:0,border:`1px solid ${isDone?"rgba(48,209,88,0.2)":isActive?ps.border:"var(--border)"}`}}>
                          {isDone?"✓":`W${weekNum}`}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontWeight:"600",fontSize:"0.88rem",margin:0,color:isDone?"var(--text-muted)":isActive?"white":"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {week.focus}
                          </p>
                          {week.hours&&<p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0}}>{week.hours}h this week</p>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                          <div style={{width:"40px"}}>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{width:`${pct}%`,background:isDone?"#30d158":ps.color}}/>
                            </div>
                          </div>
                          <span style={{fontSize:"0.68rem",fontWeight:"600",color:isDone?"#30d158":isActive?ps.color:"var(--text-muted)",minWidth:"28px",textAlign:"right"}}>{pct}%</span>
                          <span style={{color:"var(--text-muted)",fontSize:"0.75rem"}}>{isExpanded?"▲":"▼"}</span>
                        </div>
                      </div>

                      {/* Expanded tasks */}
                      {isExpanded&&!isLocked&&(
                        <div style={{marginTop:"14px",borderTop:"1px solid var(--border)",paddingTop:"14px"}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
                            <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:0,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.5px"}}>Tasks</p>
                            <span style={{fontSize:"0.72rem",color:ps.color,fontWeight:"600"}}>{tasks.filter((_:any,i:number)=>isTaskDone(weekNum,i)).length}/{tasks.length}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {tasks.map((task:string,tIdx:number)=>{
                              const done=isTaskDone(weekNum,tIdx)
                              return (
                                <div key={tIdx} onClick={()=>handleToggle(weekNum,tIdx)} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"12px",borderRadius:"var(--radius-lg)",cursor:"pointer",background:done?"rgba(48,209,88,0.06)":"var(--bg-elevated)",border:`1px solid ${done?"rgba(48,209,88,0.15)":"var(--border)"}`,transition:"all 0.2s"}}>
                                  <div style={{width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,background:done?"#30d158":"transparent",border:`2px solid ${done?"#30d158":"var(--text-subtle)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",color:"white",fontWeight:"700",marginTop:"1px"}}>
                                    {done?"✓":""}
                                  </div>
                                  <p style={{fontSize:"0.85rem",margin:0,lineHeight:1.5,color:done?"var(--text-muted)":"var(--text-primary)",textDecoration:done?"line-through":"none"}}>{task}</p>
                                </div>
                              )
                            })}
                          </div>

                          {pct<100?(
                            <button onClick={async()=>{
                              for(let i=0;i<tasks.length;i++) if(!isTaskDone(weekNum,i)) await toggleTask(userId,weekNum,i,true)
                              setProgress(prev=>{const u=[...prev];tasks.forEach((_:any,i:number)=>{const e=u.find(p=>p.week_number===weekNum&&p.task_index===i);if(e)e.completed=true;else u.push({week_number:weekNum,task_index:i,completed:true})});return u})
                              setCelebrating(true);setTimeout(()=>setCelebrating(false),3000);setExpandedWeek(weekNum)
                            }} style={{width:"100%",marginTop:"12px",padding:"10px",background:`${ps.color}12`,border:`1px solid ${ps.border}`,borderRadius:"var(--radius-md)",color:ps.color,fontSize:"0.82rem",fontWeight:"600",cursor:"pointer"}}>
                              ✓ Mark All Complete
                            </button>
                          ):(
                            <div style={{marginTop:"12px",display:"flex",flexDirection:"column",gap:"10px"}}>
                              <div style={{textAlign:"center",padding:"8px",background:"rgba(48,209,88,0.08)",borderRadius:"var(--radius-md)",color:"#30d158",fontSize:"0.82rem",fontWeight:"600"}}>
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
                                    setCelebrating(true);setTimeout(()=>setCelebrating(false),3000)
                                    const next=weekNum+1;setCurrentWeek(next);setExpandedWeek(next)
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isLocked&&<p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:"8px 0 0",textAlign:"center"}}>🔒 Complete previous weeks to unlock</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {isComplete&&(
              <div style={{background:"rgba(48,209,88,0.08)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:"var(--radius-md)",padding:"10px 16px",display:"flex",alignItems:"center",gap:"10px",marginLeft:"16px",marginTop:"8px"}}>
                <span style={{fontSize:"1.2rem"}}>🏅</span>
                <p style={{fontSize:"0.82rem",color:"#30d158",fontWeight:"600",margin:0}}>{phase} Phase Complete!</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Finish line */}
      <div style={{textAlign:"center",padding:"2.5rem 1rem",background:overallPct===100?"rgba(48,209,88,0.08)":"var(--bg-card)",borderRadius:"var(--radius-2xl)",border:overallPct===100?"1px solid rgba(48,209,88,0.2)":"2px dashed var(--border)",marginLeft:"16px"}}>
        <div style={{fontSize:"3.5rem",marginBottom:"10px"}}>{overallPct===100?"🏆":"🏁"}</div>
        <p style={{fontWeight:"700",fontSize:"1.1rem",margin:0,color:overallPct===100?"#30d158":"var(--text-muted)"}}>
          {overallPct===100?"Roadmap Complete! 🎉":"Finish Line"}
        </p>
        <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:"6px 0 0"}}>
          {overallPct===100?"You've completed your entire study roadmap!":`${totalWeeks-completedWeeks} weeks remaining`}
        </p>
      </div>

      {/* Strategy Modal */}
      {showStrategy&&strategy&&(
        <div onClick={()=>setShowStrategy(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 1.5rem 1.5rem"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-2xl)",width:"100%",maxWidth:"560px",maxHeight:"75vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}}>
            <div style={{padding:"1.2rem 1.5rem",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"10px",background:"rgba(10,132,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>🧠</div>
                <div>
                  <p style={{fontWeight:"700",fontSize:"0.95rem",margin:0}}>Study Strategy</p>
                  <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>Your personalised AI plan</p>
                </div>
              </div>
              <button onClick={()=>setShowStrategy(false)} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-muted)",width:"32px",height:"32px",cursor:"pointer",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.5rem",display:"flex",flexDirection:"column",gap:"12px"}}>
              {typeof strategy==="string"?(
                <p style={{fontSize:"0.95rem",color:"var(--text-secondary)",lineHeight:1.8,margin:0}}>{strategy}</p>
              ):(
                Object.entries(strategy as Record<string,any>).map(([key,value])=>(
                  <div key={key} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1rem"}}>
                    <p style={{fontWeight:"700",fontSize:"0.88rem",color:"var(--accent)",margin:"0 0 8px",textTransform:"capitalize"}}>{key.replace(/_/g," ")}</p>
                    {typeof value==="string"?(
                      <p style={{fontSize:"0.9rem",color:"var(--text-secondary)",lineHeight:1.7,margin:0}}>{value}</p>
                    ):Array.isArray(value)?(
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {(value as any[]).map((item:any,i:number)=>(
                          <div key={i} style={{display:"flex",gap:"8px",alignItems:"flex-start",fontSize:"0.88rem",color:"var(--text-secondary)"}}>
                            <span style={{color:"var(--accent)",flexShrink:0}}>→</span>
                            <span style={{lineHeight:1.6}}>{String(item)}</span>
                          </div>
                        ))}
                      </div>
                    ):typeof value==="object"&&value!==null?(
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {Object.entries(value as Record<string,any>).map(([k,v])=>(
                          <div key={k} style={{display:"flex",gap:"10px",fontSize:"0.88rem",alignItems:"flex-start"}}>
                            <span style={{color:"var(--text-muted)",textTransform:"capitalize",minWidth:"120px",flexShrink:0,fontWeight:"500"}}>{k.replace(/_/g," ")}:</span>
                            <span style={{color:"var(--text-secondary)",lineHeight:1.6}}>{typeof v==="string"?v:JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    ):null}
                  </div>
                ))
              )}
            </div>
            <div style={{padding:"1rem 1.5rem",borderTop:"1px solid var(--border)",flexShrink:0}}>
              <button onClick={()=>setShowStrategy(false)} style={{width:"100%",padding:"12px",background:"var(--accent)",border:"none",borderRadius:"var(--radius-md)",color:"white",fontWeight:"600",fontSize:"0.9rem",cursor:"pointer",boxShadow:"0 4px 16px rgba(10,132,255,0.3)"}}>
                Got it, let's study! 🚀
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
