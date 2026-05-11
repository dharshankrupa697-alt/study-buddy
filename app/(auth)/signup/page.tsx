"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp, getUser, saveRoadmap } from "@/lib/supabase"

const GOAL_TYPES = [
  { id:"competitive", label:"Competitive Exam", emoji:"🏆", desc:"UPSC, JEE, NEET, CAT, SSC" },
  { id:"academic",    label:"Academic",          emoji:"📚", desc:"School or college subjects" },
  { id:"coding",      label:"Coding / Tech",     emoji:"💻", desc:"Programming, web dev, DSA" },
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

async function generateRoadmap(goalType:string, goalDetails:any, name:string) {
  const a=goalDetails as any
  const prompts: Record<string,string> = {
    competitive:`Create a study roadmap for ${name} preparing for ${a.exam} with ${a.months} months left, ${a.hours} hours daily. Level: ${a.level}. Return JSON: overview (string), weeks (array max 20: week, phase, focus, tasks array 4 items, hours), strategy (string).`,
    academic:(()=>{
      const level=a.eduLevel||""
      const isSchool=["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard"].includes(level)
      const isHigh=["11th Standard","12th Standard"].includes(level)
      const isUG=level==="Undergraduate (UG)", isPG=level==="Postgraduate (PG)", isPhD=level==="PhD"
      if (isSchool) return `Create NCERT-based roadmap for ${name} in ${level}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
      if (isHigh)   return `Create board exam roadmap for ${name} in ${level}, ${a.stream} stream. NCERT focus. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 20: week, phase, focus, tasks 4 items, hours), strategy.`
      if (isUG)     return `Create semester roadmap for ${name} studying ${a.subject} at ${a.college}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
      if (isPG)     return `Create PG roadmap for ${name} studying ${a.subject} at ${a.college}. Exam: ${a.examDate}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 16: week, phase, focus, tasks 4 items, hours), strategy.`
      if (isPhD)    return `Create PhD roadmap for ${name} researching ${a.research} at ${a.college}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 20: week, phase, focus, tasks 4 items, hours), strategy.`
      return `Create study roadmap for ${name} at ${level}. Exam: ${a.examDate}. Weak: ${a.weakness}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`
    })(),
    coding:`Create coding roadmap for ${name} learning ${a.topic}. Level: ${a.level}. Goal: ${a.goal}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`,
    skill:`Create skill roadmap for ${name} learning ${a.skill}. Level: ${a.level}. Reason: ${a.reason}. Hours: ${a.hours}/day. Return JSON: overview, weeks (max 12: week, phase, focus, tasks 4 items, hours), strategy.`,
  }
  const res=await fetch("/api/roadmap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:prompts[goalType]})})
  const data=await res.json()
  try { let clean=data.reply.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim(); return JSON.parse(clean) }
  catch { return {overview:data.reply,weeks:[],strategy:""} }
}

export default function SignupPage() {
  const [step,        setStep]        = useState(1)
  const [name,        setName]        = useState("")
  const [email,       setEmail]       = useState("")
  const [password,    setPassword]    = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [goalType,    setGoalType]    = useState("")
  const [answers,     setAnswers]     = useState<Record<string,string>>({})
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [genMsg,      setGenMsg]      = useState("")
  const router = useRouter()

  const steps=["Account","Goal","Details","Launch 🚀"]
  const pct=(step/4)*100

  const visibleQuestions=(GOAL_QUESTIONS[goalType]||[]).filter(q=>{
    if (!q.dependsOn) return true
    const depVal=answers[q.dependsOn]; if (!depVal) return false
    return q.showWhen?.includes(depVal)??true
  })

  const next=()=>{
    setError("")
    if (step===1) {
      if (!name.trim())          { setError("Please enter your name"); return }
      if (!email.includes("@")) { setError("Please enter a valid email"); return }
      if (password.length<6)    { setError("Password must be at least 6 characters"); return }
      if (password!==confirmPass){ setError("Passwords do not match"); return }
    }
    if (step===2&&!goalType) { setError("Please select your goal"); return }
    if (step===3) { for (const q of visibleQuestions) { if (q.type!=="date"&&!answers[q.key]) { setError(`Please answer: ${q.label}`); return } } }
    setStep(s=>s+1)
  }

  const handleSignup=async()=>{
    setLoading(true); setError("")
    try {
      const {error:signUpErr}=await signUp(email,password,name,goalType,Number(answers.hours||2))
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
      setGenMsg("D.K is building your personalised roadmap...")
      const roadmap=await generateRoadmap(goalType,answers,name)
      setGenMsg("Saving your roadmap...")
      const user=await getUser()
      if (user) await saveRoadmap(user.id,roadmap,goalType,answers)
      setGenMsg("All done! Taking you to sign in...")
      await new Promise(r=>setTimeout(r,1000))
      router.push("/login")
    } catch { setError("Something went wrong. Please try again."); setLoading(false) }
  }

  const strengthScore=password.length===0?0:password.length<6?1:password.length<10?2:password.match(/[A-Z]/)&&password.match(/[0-9]/)?4:3
  const strengthColors=["transparent","#ff453a","#ff9f0a","#0a84ff","#30d158"]
  const strengthLabels=["","Weak","Fair","Good","Strong"]

  const inputStyle={width:"100%",padding:"13px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"var(--radius-xl)",color:"white",fontSize:"0.9rem",outline:"none",fontFamily:"inherit",transition:"border-color 0.2s, box-shadow 0.2s",boxSizing:"border-box" as const,colorScheme:"dark" as const}

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000000",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:"420px"}}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:"1.8rem"}}>
          <div style={{width:"52px",height:"52px",borderRadius:"14px",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",margin:"0 auto 1rem",boxShadow:"0 8px 24px rgba(10,132,255,0.4)"}}>🧠</div>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",margin:"0 0 4px"}}>Create Account</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",margin:0}}>Your AI study journey starts here</p>
        </div>

        {/* Progress */}
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
            {steps.map((s,i)=>(
              <span key={s} style={{fontSize:"0.68rem",color:i+1<step?"var(--accent)":i+1===step?"white":"var(--text-muted)",fontWeight:i+1===step?"600":"400"}}>{s}</span>
            ))}
          </div>
          <div style={{height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,var(--accent),#30d158)",borderRadius:"99px",transition:"width 0.4s ease"}}/>
          </div>
        </div>

        {/* Card */}
        <div style={{background:"#111111",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"var(--radius-2xl)",padding:"1.8rem"}}>

          {error&&(
            <div style={{background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.25)",borderRadius:"var(--radius-xl)",padding:"10px 14px",color:"#ff453a",fontSize:"0.83rem",marginBottom:"1rem",display:"flex",gap:"8px"}}>
              <span>⚠️</span>{error}
            </div>
          )}

          {/* Step 1 */}
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {[{label:"Full Name",type:"text",value:name,onChange:setName,placeholder:"Your name"},{label:"Email",type:"email",value:email,onChange:setEmail,placeholder:"you@example.com"}].map(f=>(
                <div key={f.label}>
                  <label style={{fontSize:"0.78rem",color:"var(--text-muted)",display:"block",marginBottom:"6px",fontWeight:"500"}}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e=>f.onChange(e.target.value)} placeholder={f.placeholder} style={inputStyle} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
                </div>
              ))}
              {[{label:"Password",value:password,onChange:setPassword,show:showPass,setShow:setShowPass,placeholder:"At least 6 characters"},{label:"Confirm Password",value:confirmPass,onChange:setConfirmPass,show:showConfirm,setShow:setShowConfirm,placeholder:"Re-enter your password"}].map(f=>(
                <div key={f.label}>
                  <label style={{fontSize:"0.78rem",color:"var(--text-muted)",display:"block",marginBottom:"6px",fontWeight:"500"}}>{f.label}</label>
                  <div style={{position:"relative"}}>
                    <input type={f.show?"text":"password"} value={f.value} onChange={e=>f.onChange(e.target.value)} placeholder={f.placeholder} style={{...inputStyle,paddingRight:"48px"}} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
                    <button type="button" onClick={()=>f.setShow((s:boolean)=>!s)} style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:"1.1rem",padding:0}}>{f.show?"🙈":"👁️"}</button>
                  </div>
                  {f.label==="Password"&&password.length>0&&(
                    <div style={{marginTop:"8px"}}>
                      <div style={{display:"flex",gap:"4px",marginBottom:"4px"}}>
                        {[1,2,3,4].map(i=>(<div key={i} style={{flex:1,height:"3px",borderRadius:"99px",background:i<=strengthScore?strengthColors[strengthScore]:"rgba(255,255,255,0.08)",transition:"background 0.3s"}}/>))}
                      </div>
                      <p style={{fontSize:"0.7rem",color:strengthColors[strengthScore],margin:0}}>{strengthLabels[strengthScore]}</p>
                    </div>
                  )}
                  {f.label==="Confirm Password"&&confirmPass&&(
                    <p style={{fontSize:"0.7rem",marginTop:"6px",color:password===confirmPass?"#30d158":"#ff453a",margin:"6px 0 0"}}>{password===confirmPass?"✓ Passwords match":"✗ Passwords do not match"}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 2 */}
          {step===2&&(
            <div>
              <p style={{fontWeight:"600",marginBottom:"4px",fontSize:"0.95rem"}}>What's your main goal?</p>
              <p style={{color:"var(--text-muted)",fontSize:"0.82rem",marginBottom:"1.2rem"}}>D.K will build a personalised roadmap for you 🧠</p>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {GOAL_TYPES.map(g=>(
                  <button key={g.id} onClick={()=>setGoalType(g.id)} style={{padding:"14px 16px",borderRadius:"var(--radius-xl)",cursor:"pointer",background:goalType===g.id?"rgba(10,132,255,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${goalType===g.id?"rgba(10,132,255,0.4)":"rgba(255,255,255,0.08)"}`,color:"white",textAlign:"left",transition:"all 0.2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                      <span style={{fontSize:"1.6rem"}}>{g.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:"600",fontSize:"0.9rem"}}>{g.label}</div>
                        <div style={{fontSize:"0.75rem",color:"var(--text-muted)",marginTop:"2px"}}>{g.desc}</div>
                      </div>
                      {goalType===g.id&&<span style={{color:"var(--accent)",fontSize:"1.1rem"}}>✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step===3&&goalType&&(
            <div>
              <p style={{fontWeight:"600",marginBottom:"4px",fontSize:"0.95rem"}}>Tell us more</p>
              <p style={{color:"var(--text-muted)",fontSize:"0.82rem",marginBottom:"1.2rem"}}>Helps D.K build your perfect roadmap 🧠</p>
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                {visibleQuestions.map(q=>(
                  <div key={q.key}>
                    <label style={{fontSize:"0.78rem",color:"var(--text-muted)",display:"block",marginBottom:"6px",fontWeight:"500"}}>{q.label}</label>
                    {q.type==="select"&&q.options?(
                      <select value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}>
                        <option value="">Select...</option>
                        {q.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    ):q.type==="date"?(
                      <input type="date" value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}/>
                    ):(
                      <input type="text" value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} placeholder={`Enter ${q.label.toLowerCase()}`} style={inputStyle} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step===4&&(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"3.5rem",marginBottom:"12px"}}>{GOAL_TYPES.find(g=>g.id===goalType)?.emoji}</div>
              <h2 style={{fontSize:"1.2rem",fontWeight:"700",marginBottom:"8px"}}>Ready, {name.split(" ")[0]}! 🎉</h2>
              <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginBottom:"1.5rem",lineHeight:1.6}}>
                Goal: <strong style={{color:"var(--accent)"}}>{GOAL_TYPES.find(g=>g.id===goalType)?.label}</strong><br/>D.K will generate your personalised roadmap now!
              </p>
              {genMsg&&(
                <div style={{background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:"var(--radius-xl)",padding:"14px",marginBottom:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:"center",marginBottom:"8px"}}>
                    <div style={{width:"14px",height:"14px",border:"2px solid rgba(10,132,255,0.3)",borderTop:"2px solid #0a84ff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                    <span style={{fontSize:"0.85rem",color:"var(--accent)",fontWeight:"500"}}>{genMsg}</span>
                  </div>
                  <div style={{height:"3px",background:"rgba(255,255,255,0.06)",borderRadius:"99px",overflow:"hidden"}}>
                    <div style={{height:"100%",background:"linear-gradient(90deg,var(--accent),#30d158)",borderRadius:"99px",animation:"loading 30s linear forwards"}}/>
                  </div>
                </div>
              )}
              <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"var(--radius-xl)",border:"1px solid rgba(255,255,255,0.08)",padding:"1rem",textAlign:"left",marginBottom:"1.5rem"}}>
                {[{icon:"🗺️",text:"AI personalised roadmap"},{icon:"🎯",text:"Webcam focus monitoring"},{icon:"📝",text:"Week quiz system"},{icon:"📅",text:"Daily task planner"}].map(f=>(
                  <div key={f.text} style={{display:"flex",gap:"10px",alignItems:"center",padding:"5px 0"}}>
                    <span>{f.icon}</span><span style={{fontSize:"0.85rem",color:"var(--text-secondary)"}}>{f.text}</span>
                    <span style={{marginLeft:"auto",color:"#30d158",fontSize:"0.85rem"}}>✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{display:"flex",gap:"8px",marginTop:"1.5rem"}}>
            {step>1&&!loading&&(
              <button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"13px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"var(--radius-xl)",color:"var(--text-secondary)",cursor:"pointer",fontWeight:"500",fontSize:"0.9rem"}}>← Back</button>
            )}
            {step<4&&(
              <button onClick={next} style={{flex:2,padding:"13px",background:"var(--accent)",border:"none",borderRadius:"var(--radius-xl)",color:"white",fontSize:"0.95rem",fontWeight:"700",cursor:"pointer",boxShadow:"0 4px 20px rgba(10,132,255,0.35)"}}>
                {step===3?"Almost done →":"Next →"}
              </button>
            )}
            {step===4&&(
              <button onClick={handleSignup} disabled={loading} style={{flex:1,padding:"14px",background:loading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,var(--accent),#30d158)",border:"none",borderRadius:"var(--radius-xl)",color:loading?"var(--text-muted)":"white",fontSize:"0.95rem",fontWeight:"700",cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":"0 4px 20px rgba(10,132,255,0.35)"}}>
                {loading?"Building...":"Generate My Roadmap 🚀"}
              </button>
            )}
          </div>

          {step===1&&(
            <p style={{textAlign:"center",marginTop:"1rem",fontSize:"0.85rem",color:"var(--text-muted)"}}>
              Have an account?{" "}<Link href="/login" style={{color:"var(--accent)",fontWeight:"600",textDecoration:"none"}}>Sign in →</Link>
            </p>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes loading{from{width:0%}to{width:100%}}`}</style>
    </div>
  )
}
