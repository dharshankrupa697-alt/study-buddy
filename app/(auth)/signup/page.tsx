"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp, getUser, saveRoadmap } from "@/lib/supabase"

const GOAL_TYPES = [
  { id:"competitive", label:"Competitive Exam", emoji:"🏆", desc:"UPSC, JEE, NEET, CAT, SSC" },
  { id:"academic",    label:"Academic",          emoji:"📚", desc:"School or college subjects" },
  { id:"coding",      label:"Coding / Tech",     emoji:"💻", desc:"Programming, web dev, DSA" },
  { id:"skill",       label:"Skill Building",    emoji:"🎯", desc:"Language, music, design, etc" },
]

const GOAL_QUESTIONS: Record<string, { label:string; options?:string[]; type:string; key:string; dependsOn?:string; showWhen?:string[] }[]> = {
  competitive: [
    { label:"Which exam?",          key:"exam",   type:"select", options:["UPSC","JEE","NEET","CAT","SSC","GATE","Other"] },
    { label:"Months left?",         key:"months", type:"select", options:["1","2","3","4","5","6","9","12","18","24"] },
    { label:"Current level?",       key:"level",  type:"select", options:["Just started","3-6 months in","More than 6 months"] },
    { label:"Daily hours available?",key:"hours", type:"select", options:["2","4","6","8","10","12"] },
  ],
  academic: [
    { label:"What is your education level?", key:"eduLevel", type:"select", options:["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard","11th Standard","12th Standard","Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"Which stream?",         key:"stream",  type:"select", options:["Science (PCM)","Science (PCB)","Science (PCMB)","Commerce","Arts / Humanities","Other"], dependsOn:"eduLevel", showWhen:["11th Standard","12th Standard"] },
    { label:"Which subject/course?", key:"subject", type:"text",   dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"University/College?",   key:"college", type:"text",   dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)","PhD"] },
    { label:"Semester/Year?",        key:"semester",type:"select", options:["1st Sem","2nd Sem","3rd Sem","4th Sem","5th Sem","6th Sem","7th Sem","8th Sem","1st Year","2nd Year","3rd Year"], dependsOn:"eduLevel", showWhen:["Undergraduate (UG)","Postgraduate (PG)"] },
    { label:"Research topic?",       key:"research",type:"text",   dependsOn:"eduLevel", showWhen:["PhD"] },
    { label:"Exam date?",            key:"examDate",type:"date" },
    { label:"Weakest area?",         key:"weakness",type:"text" },
    { label:"Daily hours available?",key:"hours",   type:"select", options:["1","2","3","4","5","6","8"] },
  ],
  coding: [
    { label:"What to learn?",    key:"topic", type:"select", options:["Python","JavaScript","React","DSA","Java","C++","Machine Learning","Web Dev","App Dev","Other"] },
    { label:"Current level?",    key:"level", type:"select", options:["Complete beginner","Know basics","Intermediate","Advanced"] },
    { label:"Your goal?",        key:"goal",  type:"select", options:["Get a job","Build a project","Crack interviews","Learn for fun","Freelancing"] },
    { label:"Hours per day?",    key:"hours", type:"select", options:["1","2","3","4","5","6"] },
  ],
  skill: [
    { label:"What skill?",       key:"skill",  type:"text" },
    { label:"Current level?",    key:"level",  type:"select", options:["Complete beginner","Some experience","Intermediate","Advanced"] },
    { label:"Why this skill?",   key:"reason", type:"select", options:["Career change","Personal interest","Side income","Academic requirement","Other"] },
    { label:"Hours per day?",    key:"hours",  type:"select", options:["0.5","1","2","3","4"] },
  ],
}


async function generateRoadmap(goalType: string, goalDetails: any, name: string) {
  const prompts: Record<string, string> = {
    competitive: `Create a study roadmap for ${name} preparing for ${goalDetails.exam} with ${goalDetails.months} months left, studying ${goalDetails.hours} hours daily. Level: ${goalDetails.level}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
    academic: (() => {
      const level = goalDetails.eduLevel || ""
      const isSchool = ["6th Standard","7th Standard","8th Standard","9th Standard","10th Standard"].includes(level)
      const isHighSchool = ["11th Standard","12th Standard"].includes(level)
      const isUG = level === "Undergraduate (UG)"
      const isPG = level === "Postgraduate (PG)"
      const isPhD = level === "PhD"

      if (isSchool) {
        return `Create a NCERT-based study roadmap for ${name} who is in ${level}. Focus ONLY on NCERT syllabus. Exam date: ${goalDetails.examDate}. Weakest area: ${goalDetails.weakness}. Daily hours: ${goalDetails.hours}. Include chapter-wise weekly plan based on NCERT books for all subjects. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
      }
      if (isHighSchool) {
        return `Create a board exam roadmap for ${name} in ${level}, ${goalDetails.stream} stream. Focus on NCERT syllabus with reference books. Exam date: ${goalDetails.examDate}. Weakest area: ${goalDetails.weakness}. Daily hours: ${goalDetails.hours}. Include subject-wise weekly plan. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
      }
      if (isUG) {
        return `Create a semester study roadmap for ${name} studying ${goalDetails.subject} at ${goalDetails.college}, ${goalDetails.semester}. Exam date: ${goalDetails.examDate}. Weakest area: ${goalDetails.weakness}. Daily hours: ${goalDetails.hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
      }
      if (isPG) {
        return `Create a postgraduate study roadmap for ${name} studying ${goalDetails.subject} at ${goalDetails.college}, ${goalDetails.semester}. Focus on advanced concepts and research. Exam date: ${goalDetails.examDate}. Weakest area: ${goalDetails.weakness}. Daily hours: ${goalDetails.hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 16 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
      }
      if (isPhD) {
        return `Create a PhD research roadmap for ${name} researching ${goalDetails.research} at ${goalDetails.college}. Include literature review, methodology, writing phases. Daily hours: ${goalDetails.hours}. Return JSON with exactly these keys: overview (string summary), weeks (array of max 20 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
      }
      return `Create a study roadmap for ${name} at ${level}. Subject: ${goalDetails.subject}. Exam: ${goalDetails.examDate}. Weakest: ${goalDetails.weakness}. Hours: ${goalDetails.hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`
    })(),
    coding:      `Create a coding roadmap for ${name} learning ${goalDetails.topic}. Level: ${goalDetails.level}. Goal: ${goalDetails.goal}. Hours: ${goalDetails.hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
    skill:       `Create a skill roadmap for ${name} learning ${goalDetails.skill}. Level: ${goalDetails.level}. Reason: ${goalDetails.reason}. Hours: ${goalDetails.hours}/day. Return JSON with exactly these keys: overview (string summary), weeks (array of max 12 objects with keys: week, phase, focus, tasks array of 4 items, hours), strategy (string). Keep it concise.`,
  }
  const res  = await fetch("/api/roadmap", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt:prompts[goalType] }) })
  const data = await res.json()
  try {
    let clean = data.reply.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
    return JSON.parse(clean)
  } catch {
    return { overview:data.reply, weeks:[], strategy:"" }
  }
}

const inputStyle = {
  width:"100%", padding:"10px 14px",
  background:"#1a1a2e", border:"1px solid rgba(255,255,255,0.08)",
  borderRadius:"10px", color:"white", fontSize:"0.88rem",
  outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit",
  transition:"border-color 0.2s",
  colorScheme:"dark" as const,
}

export default function SignupPage() {
  const [step,     setStep]     = useState(1)
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [goalType, setGoalType] = useState("")
  const [answers,  setAnswers]  = useState<Record<string,string>>({})
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [showPass, setShowPass] = useState(false)
  const [genMsg,   setGenMsg]   = useState("")
  const router = useRouter()
  const [confirmPass, setConfirmPass] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  const steps = ["Your info","Your goal","Details","All set!"]
  const pct   = (step/4)*100

  const next = () => {
    setError("")
    if (step===1) {
      if (!name.trim())          { setError("Please enter your name"); return }
      if (!email.includes("@")) { setError("Please enter a valid email"); return }
      if (password.length < 6)        { setError("Password must be at least 6 characters"); return }
      if (password !== confirmPass)   { setError("Passwords do not match"); return }
    }
    if (step===2 && !goalType)   { setError("Please select your goal"); return }
    if (step===3) {
      const visibleQuestions = (GOAL_QUESTIONS[goalType]||[]).filter(q => {
        if (!q.dependsOn) return true
        const depVal = answers[q.dependsOn]
        if (!depVal) return false
        return q.showWhen?.includes(depVal) ?? true
      })
      for (const q of visibleQuestions) {
        if (q.type!=="date"&&!answers[q.key]) { setError(`Please answer: ${q.label}`); return }
      }
    }
    setStep(s=>s+1)
  }

  const handleSignup = async () => {
    setLoading(true); setError("")
    try {
      const { error: signUpErr } = await signUp(email, password, name, goalType, Number(answers.hours||2))
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
      setGenMsg("D.K is building your personalised roadmap...")
      const roadmap = await generateRoadmap(goalType, answers, name)
      setGenMsg("Saving your roadmap...")
      const user = await getUser()
      if (user) await saveRoadmap(user.id, roadmap, goalType, answers)
      setGenMsg("All done! Taking you to sign in...")
      await new Promise(r=>setTimeout(r,1000))
      router.push("/login")
    } catch { setError("Something went wrong. Please try again."); setLoading(false) }
  }

  const strengthScore = password.length===0?0:password.length<6?1:password.length<10?2:password.match(/[A-Z]/)&&password.match(/[0-9]/)?4:3
  const strengthColors = ["transparent","#f87171","#fbbf24","#60a5fa","#3ecf8e"]
  const strengthLabels = ["","Weak","Fair","Good","Strong"]

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", background:"var(--bg-base)" }}>

      {/* Background */}
      <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-20%", right:"-10%", width:"600px", height:"600px", background:"radial-gradient(circle,rgba(124,109,250,0.07) 0%,transparent 70%)", borderRadius:"50%" }}/>
        <div style={{ position:"absolute", bottom:"-20%", left:"-10%", width:"500px", height:"500px", background:"radial-gradient(circle,rgba(62,207,142,0.05) 0%,transparent 70%)", borderRadius:"50%" }}/>
      </div>

      <div style={{ width:"100%", maxWidth:"460px", position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", margin:"0 auto 0.8rem", boxShadow:"0 8px 24px rgba(124,109,250,0.3)" }}>🧠</div>
          <h1 style={{ fontSize:"1.4rem", fontWeight:"700", margin:"0 0 4px" }}>Create your account</h1>
          <p style={{ color:"var(--text-muted)", fontSize:"0.82rem", margin:0 }}>Your personalised AI study journey starts here</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom:"1.2rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
            {steps.map((s,i)=>(
              <span key={s} style={{ fontSize:"0.68rem", color:step>i?"#7c6dfa":step===i+1?"var(--text-primary)":"var(--text-muted)", fontWeight:step===i+1?"600":"400" }}>{s}</span>
            ))}
          </div>
          <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"99px", overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:"linear-gradient(90deg,#7c6dfa,#3ecf8e)", borderRadius:"99px", transition:"width 0.4s ease" }}/>
          </div>
        </div>

        {/* Card */}
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:"1.8rem" }}>

          {error && (
            <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"var(--radius-md)", padding:"10px 14px", color:"#f87171", fontSize:"0.82rem", marginBottom:"1rem", display:"flex", gap:"8px" }}>
              <span>⚠️</span>{error}
            </div>
          )}

          {/* Step 1 — Account info */}
          {step===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {[
                { label:"Full Name", type:"text", value:name, onChange:setName, placeholder:"Your name" },
                { label:"Email address", type:"email", value:email, onChange:setEmail, placeholder:"you@example.com" },
              ].map(f=>(
                <div key={f.label}>
                  <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e=>f.onChange(e.target.value)} placeholder={f.placeholder} style={inputStyle} onFocus={e=>e.target.style.borderColor="#7c6dfa"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>Password</label>
                <div style={{ position:"relative" }}>
                  <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" style={{...inputStyle,paddingRight:"44px"}} onFocus={e=>e.target.style.borderColor="#7c6dfa"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}/>
                  <button type="button" onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:"1rem", padding:0 }}>
                    {showPass?"🙈":"👁"}
                  </button>
                </div>
                {password.length>0 && (
                  <div style={{ marginTop:"8px" }}>
                    <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
                      {[1,2,3,4].map(i=>(
                        <div key={i} style={{ flex:1, height:"3px", borderRadius:"99px", background:i<=strengthScore?strengthColors[strengthScore]:"rgba(255,255,255,0.06)", transition:"background 0.3s" }}/>
                      ))}
                    </div>
                    <div>
                      <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>Confirm Password</label>
                      <div style={{ position:"relative" }}>
                        <input
                          type={showConfirm?"text":"password"}
                          value={confirmPass}
                          onChange={e=>setConfirmPass(e.target.value)}
                          placeholder="Re-enter your password"
                          style={{...inputStyle, paddingRight:"44px"}}
                          onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
                        />
                        <button type="button" onClick={()=>setShowConfirm(s=>!s)} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:"1rem", padding:0 }}>
                          {showConfirm?"🙈":"👁"}
                        </button>
                      </div>
                      {confirmPass && (
                        <p style={{ fontSize:"0.7rem", marginTop:"4px", color:password===confirmPass?"#3ecf8e":"#f87171" }}>
                          {password===confirmPass?"✓ Passwords match":"✗ Passwords do not match"}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize:"0.7rem", color:strengthColors[strengthScore], margin:0 }}>{strengthLabels[strengthScore]}</p>
                  </div>
                  
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Goal type */}
          {step===2 && (
            <div>
              <p style={{ fontWeight:"600", marginBottom:"4px" }}>What's your main goal?</p>
              <p style={{ color:"var(--text-muted)", fontSize:"0.8rem", marginBottom:"1rem" }}>We'll build a personalised AI roadmap for you</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {GOAL_TYPES.map(g=>(
                  <button key={g.id} onClick={()=>setGoalType(g.id)} style={{
                    padding:"13px 14px", borderRadius:"var(--radius-md)", cursor:"pointer",
                    background:goalType===g.id?"var(--accent-soft)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${goalType===g.id?"var(--accent-border)":"rgba(255,255,255,0.06)"}`,
                    color:"white", textAlign:"left", transition:"all 0.2s"
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                      <span style={{ fontSize:"1.4rem" }}>{g.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:"600", fontSize:"0.88rem" }}>{g.label}</div>
                        <div style={{ fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"1px" }}>{g.desc}</div>
                      </div>
                      {goalType===g.id && <span style={{ color:"var(--accent)", fontSize:"1rem" }}>✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Goal details */}
          {step===3 && goalType && (
            <div>
              <p style={{ fontWeight:"600", marginBottom:"4px" }}>Tell us more</p>
              <p style={{ color:"var(--text-muted)", fontSize:"0.8rem", marginBottom:"1.2rem" }}>This helps D.K build your perfect roadmap 🧠</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                {GOAL_QUESTIONS[goalType].filter(q => {
                  if (!q.dependsOn) return true
                  const depVal = answers[q.dependsOn]
                  if (!depVal) return false
                  return q.showWhen?.includes(depVal) ?? true
                }).map(q => (
                  <div key={q.key}>
                    <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>{q.label}</label>
                    {q.type==="select"&&q.options ? (
                      <select value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} style={inputStyle}>
                        <option value="">Select...</option>
                        {q.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : q.type==="date" ? (
                      <input type="date" value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} style={{...inputStyle,colorScheme:"dark"}}/>
                    ) : (
                      <input type="text" value={answers[q.key]||""} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} placeholder={`Enter ${q.label.toLowerCase()}`} style={inputStyle} onFocus={e=>e.target.style.borderColor="#7c6dfa"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Ready */}
          {step===4 && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:"3.5rem", marginBottom:"12px" }}>{GOAL_TYPES.find(g=>g.id===goalType)?.emoji}</div>
              <h2 style={{ fontSize:"1.2rem", fontWeight:"700", marginBottom:"6px" }}>Ready, {name.split(" ")[0]}!</h2>
              <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", marginBottom:"1.5rem", lineHeight:1.6 }}>
                Goal: <strong style={{ color:"var(--accent)" }}>{GOAL_TYPES.find(g=>g.id===goalType)?.label}</strong>
                <br/>D.K will generate your personalised roadmap now!
              </p>

              {genMsg && (
                <div style={{ background:"var(--accent-soft)", border:"1px solid var(--accent-border)", borderRadius:"var(--radius-md)", padding:"14px", marginBottom:"1rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", justifyContent:"center", marginBottom:"8px" }}>
                    <div style={{ width:"14px", height:"14px", border:"2px solid rgba(124,109,250,0.3)", borderTop:"2px solid #7c6dfa", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                    <span style={{ fontSize:"0.85rem", color:"var(--accent)", fontWeight:"500" }}>{genMsg}</span>
                  </div>
                  <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"99px", overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"linear-gradient(90deg,#7c6dfa,#3ecf8e)", borderRadius:"99px", animation:"loading 30s linear forwards" }}/>
                  </div>
                </div>
              )}

              <div style={{ background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", border:"1px solid var(--border)", padding:"1rem", textAlign:"left" }}>
                {[
                  { icon:"🗺️", text:"AI personalised roadmap" },
                  { icon:"📷", text:"Webcam focus monitoring" },
                  { icon:"💬", text:"AI tutor for any doubt" },
                  { icon:"📊", text:"Smart study analytics" },
                ].map(f=>(
                  <div key={f.text} style={{ display:"flex", gap:"10px", alignItems:"center", padding:"5px 0" }}>
                    <span>{f.icon}</span>
                    <span style={{ fontSize:"0.82rem", color:"var(--text-secondary)" }}>{f.text}</span>
                    <span style={{ marginLeft:"auto", color:"#3ecf8e", fontSize:"0.8rem" }}>✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:"flex", gap:"8px", marginTop:"1.5rem" }}>
            {step>1 && !loading && (
              <button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:"11px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-secondary)", cursor:"pointer", fontWeight:"500", fontSize:"0.88rem" }}>
                ← Back
              </button>
            )}
            {step<4 && (
              <button onClick={next} style={{ flex:2, padding:"11px", background:"linear-gradient(135deg,#7c6dfa,#6b5ce7)", border:"none", borderRadius:"var(--radius-md)", color:"white", fontSize:"0.95rem", fontWeight:"600", cursor:"pointer", boxShadow:"0 4px 16px rgba(124,109,250,0.3)" }}>
                {step===3?"Almost done →":"Next →"}
              </button>
            )}
            {step===4 && (
              <button onClick={handleSignup} disabled={loading} style={{ flex:1, padding:"12px", background:loading?"var(--bg-elevated)":"linear-gradient(135deg,#7c6dfa,#3ecf8e)", border:"none", borderRadius:"var(--radius-md)", color:loading?"var(--text-muted)":"white", fontSize:"0.95rem", fontWeight:"600", cursor:loading?"not-allowed":"pointer", boxShadow:loading?"none":"0 4px 16px rgba(124,109,250,0.3)" }}>
                {loading?"Building...":"Generate My Roadmap 🚀"}
              </button>
            )}
          </div>

          {step===1 && (
            <p style={{ textAlign:"center", marginTop:"1rem", fontSize:"0.82rem", color:"var(--text-muted)" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color:"var(--accent)", fontWeight:"600", textDecoration:"none" }}>Sign in</Link>
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes loading { from{width:0%} to{width:100%} }
      `}</style>
    </div>
  )
}
