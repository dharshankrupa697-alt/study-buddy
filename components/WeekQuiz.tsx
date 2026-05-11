"use client"
import { useState, useEffect, useRef } from "react"
import { getUser, getWeekQuiz, saveWeekQuiz, getTodayAttempts, saveQuizAttempt, getLastPassedAttempt, toggleTask, updateCurrentWeek } from "@/lib/supabase"

interface Question {
  id:          number
  question:    string
  topic:       string
  difficulty:  "easy"|"medium"|"hard"
  options:     { A:string; B:string; C:string; D:string }
  correct:     string
  explanation: string
}

interface Props {
  weekNumber:  number
  weekFocus:   string
  weekTasks:   string[]
  goalType:    string
  color:       string
  userId:      string
  onPassed:    () => void
}

const DIFF_COLORS = { easy:"#3ecf8e", medium:"#fbbf24", hard:"#f87171" }

export default function WeekQuiz({ weekNumber, weekFocus, weekTasks, goalType, color, userId, onPassed }: Props) {
  const [stage,        setStage]        = useState<"locked"|"ready"|"loading"|"quiz"|"result">("ready")
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [current,      setCurrent]      = useState(0)
  const [selected,     setSelected]     = useState<string|null>(null)
  const [answers,      setAnswers]      = useState<Record<number,string>>({})
  const [showExpl,     setShowExpl]     = useState(false)
  const [timeLeft,     setTimeLeft]     = useState(30)
  const [generating,   setGenerating]   = useState(false)
  const [loadMsg,      setLoadMsg]      = useState("")
  const [attemptsLeft, setAttemptsLeft] = useState(2)
  const [alreadyPassed,setAlreadyPassed]= useState(false)
  const [score,        setScore]        = useState(0)
  const [weakAreas,    setWeakAreas]    = useState<string[]>([])
  const [strongAreas,  setStrongAreas]  = useState<string[]>([])
  const timerRef = useRef<NodeJS.Timeout|null>(null)

  useEffect(() => {
    const init = async () => {
      const [attempts, passed] = await Promise.all([
        getTodayAttempts(userId, weekNumber),
        getLastPassedAttempt(userId, weekNumber),
      ])
      if (passed) { setAlreadyPassed(true); setStage("result"); return }
      setAttemptsLeft(Math.max(0, 2 - attempts.length))
      if (2 - attempts.length <= 0) setStage("locked")
    }
    init()
  }, [userId, weekNumber])

  // Timer per question
  useEffect(() => {
    if (stage !== "quiz") return
    setTimeLeft(30)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleNext(null) // Auto advance on timeout
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [current, stage])

  const generateQuiz = async () => {
    setGenerating(true)
    setLoadMsg("Generating your quiz questions...")
    try {
      // Check if quiz already exists for this week
      const existing = await getWeekQuiz(userId, weekNumber)
      if (existing?.questions) {
        setQuestions(existing.questions)
        setCurrent(0); setAnswers({}); setSelected(null); setShowExpl(false)
        setStage("quiz"); setGenerating(false); return
      }

      setLoadMsg("D.K. is creating personalised questions...")
      const res  = await fetch("/api/quiz", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify({ weekFocus, weekTasks, goalType, weekNumber })
      })
      const data = await res.json()
      if (data.questions) {
        await saveWeekQuiz(userId, weekNumber, data.questions)
        setQuestions(data.questions)
        setCurrent(0); setAnswers({}); setSelected(null); setShowExpl(false)
        setStage("quiz")
      }
    } catch(e) {
      setLoadMsg("Failed to generate quiz. Please try again.")
    } finally { setGenerating(false) }
  }

  const handleSelect = (option: string) => {
    if (selected) return // Already answered
    setSelected(option)
    setShowExpl(true)
    clearInterval(timerRef.current!)
    setAnswers(prev => ({ ...prev, [questions[current].id]: option }))
  }

  const handleNext = async (override: string|null) => {
    const finalSelected = override !== undefined ? override : selected
    if (finalSelected !== null || override === null) {
      const newAnswers = { ...answers, [questions[current].id]: finalSelected || "skipped" }
      setAnswers(newAnswers)
      if (current < questions.length - 1) {
        setCurrent(c => c+1)
        setSelected(null)
        setShowExpl(false)
      } else {
        // Calculate results
        await finishQuiz(newAnswers)
      }
    }
  }

  const finishQuiz = async (finalAnswers: Record<number,string>) => {
    clearInterval(timerRef.current!)
    let correct = 0
    const weak:   Record<string,{correct:number;total:number}> = {}
    const strong: Record<string,{correct:number;total:number}> = {}

    questions.forEach(q => {
      const topic = q.topic
      if (!weak[topic]) weak[topic] = { correct:0, total:0 }
      weak[topic].total++
      if (finalAnswers[q.id] === q.correct) {
        correct++
        weak[topic].correct++
      }
    })

    const pct    = Math.round((correct/questions.length)*100)
    const passed = pct >= 75

    // Analyse weak/strong areas
    const weakTopics   = Object.entries(weak).filter(([,v])=>v.correct/v.total < 0.5).map(([k])=>k)
    const strongTopics = Object.entries(weak).filter(([,v])=>v.correct/v.total >= 0.75).map(([k])=>k)

    setScore(pct)
    setWeakAreas(weakTopics)
    setStrongAreas(strongTopics)

    // Save attempt
    await saveQuizAttempt(userId, weekNumber, pct, finalAnswers, passed)
    setAttemptsLeft(prev => Math.max(0, prev-1))

    if (passed) {
      setAlreadyPassed(true)
      // Mark all tasks done + advance week
      for (let i=0; i<weekTasks.length; i++) {
        await import("@/lib/supabase").then(m=>m.toggleTask(userId,weekNumber,i,true))
      }
      await updateCurrentWeek(userId, weekNumber+1)
      onPassed()
    }

    setStage("result")
  }

  const retake = () => {
    if (attemptsLeft <= 0) return
    setCurrent(0); setSelected(null); setAnswers({}); setShowExpl(false)
    setStage("quiz")
  }

  const q = questions[current]
  const timerPct = (timeLeft/30)*100
  const timerColor = timeLeft>15?"#3ecf8e":timeLeft>8?"#fbbf24":"#f87171"

  // ── Already passed ─────────────────────────────────────────────
  if (alreadyPassed && stage==="result" && score===0) {
    return (
      <div style={{ background:"rgba(62,207,142,0.08)", border:"1px solid rgba(62,207,142,0.25)", borderRadius:"var(--radius-lg)", padding:"1rem", textAlign:"center" }}>
        <p style={{ fontSize:"1.2rem", marginBottom:"4px" }}>✅</p>
        <p style={{ fontWeight:"600", color:"#3ecf8e", margin:0, fontSize:"0.88rem" }}>Week {weekNumber} Quiz Passed!</p>
        <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:0 }}>You've already passed this week's quiz</p>
      </div>
    )
  }

  // ── Locked ─────────────────────────────────────────────────────
  if (stage==="locked") {
    return (
      <div style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"var(--radius-lg)", padding:"1rem", textAlign:"center" }}>
        <p style={{ fontSize:"1.2rem", marginBottom:"4px" }}>🔒</p>
        <p style={{ fontWeight:"600", color:"#f87171", margin:0, fontSize:"0.88rem" }}>No attempts left today</p>
        <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:0 }}>Come back tomorrow for 2 fresh attempts</p>
      </div>
    )
  }

  // ── Ready ──────────────────────────────────────────────────────
  if (stage==="ready") {
    return (
      <div style={{ background:`${color}08`, border:`1px solid ${color}22`, borderRadius:"var(--radius-lg)", padding:"1.2rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px" }}>
          <div style={{ width:"40px", height:"40px", borderRadius:"12px", background:`${color}15`, border:`1px solid ${color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>📝</div>
          <div>
            <p style={{ fontWeight:"700", fontSize:"0.95rem", margin:0 }}>Week {weekNumber} Quiz</p>
            <p style={{ fontSize:"0.72rem", color:"var(--text-muted)", margin:0 }}>5 questions · 30s each · Score 75%+ to pass</p>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"center", flexShrink:0 }}>
            <p style={{ fontSize:"0.9rem", fontWeight:"700", color, margin:0 }}>{attemptsLeft}</p>
            <p style={{ fontSize:"0.62rem", color:"var(--text-muted)", margin:0 }}>attempts left</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:"8px", marginBottom:"10px" }}>
          {["5 MCQs","Topic analysis","Weak areas","Instant results"].map(f=>(
            <span key={f} style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"3px 8px", fontSize:"0.65rem", color:"var(--text-muted)" }}>{f}</span>
          ))}
        </div>
        <button
          onClick={generateQuiz}
          disabled={generating}
          style={{ width:"100%", padding:"12px", background: generating?"var(--bg-elevated)":color, border:"none", borderRadius:"var(--radius-md)", color:generating?"var(--text-muted)":"white", fontWeight:"700", fontSize:"0.9rem", cursor:generating?"not-allowed":"pointer", transition:"all 0.2s", boxShadow:generating?"none":`0 4px 16px ${color}44` }}
        >
          {generating ? (
            <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
              <span style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>
              {loadMsg}
            </span>
          ) : "Start Week Quiz →"}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Quiz ───────────────────────────────────────────────────────
  if (stage==="quiz" && q) {
    return (
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"1rem 1.2rem", borderBottom:"1px solid var(--border)", background:"var(--bg-elevated)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <span style={{ background:`${color}15`, color, border:`1px solid ${color}33`, borderRadius:"var(--radius-sm)", padding:"2px 8px", fontSize:"0.68rem", fontWeight:"700" }}>
                Q{current+1}/{questions.length}
              </span>
              <span style={{ background:`${DIFF_COLORS[q.difficulty]}15`, color:DIFF_COLORS[q.difficulty], border:`1px solid ${DIFF_COLORS[q.difficulty]}33`, borderRadius:"var(--radius-sm)", padding:"2px 8px", fontSize:"0.65rem", fontWeight:"600" }}>
                {q.difficulty}
              </span>
              <span style={{ background:"var(--bg-card)", color:"var(--text-muted)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"2px 8px", fontSize:"0.65rem" }}>
                {q.topic}
              </span>
            </div>
            {/* Timer */}
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"32px", height:"32px", position:"relative" }}>
                <svg viewBox="0 0 36 36" style={{ width:"100%", height:"100%", transform:"rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15" fill="none" stroke={timerColor} strokeWidth="3"
                    strokeDasharray={`${timerPct * 0.942} 94.2`}
                    strokeLinecap="round"
                    style={{ transition:"stroke-dasharray 1s linear, stroke 0.5s" }}
                  />
                </svg>
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:"0.6rem", fontWeight:"700", color:timerColor }}>{timeLeft}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div style={{ display:"flex", gap:"4px" }}>
            {questions.map((_,i)=>(
              <div key={i} style={{ flex:1, height:"3px", borderRadius:"99px", background:i<current?"#3ecf8e":i===current?color:"rgba(255,255,255,0.08)", transition:"background 0.3s" }}/>
            ))}
          </div>
        </div>

        {/* Question */}
        <div style={{ padding:"1.2rem" }}>
          <p style={{ fontSize:"0.95rem", fontWeight:"600", lineHeight:1.6, marginBottom:"1.2rem", color:"var(--text-primary)" }}>
            {q.question}
          </p>

          {/* Options */}
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"1rem" }}>
            {(Object.entries(q.options) as [string,string][]).map(([key, val])=>{
              const isSelected = selected===key
              const isCorrect  = key===q.correct
              const isWrong    = isSelected && !isCorrect

              let bg     = "var(--bg-elevated)"
              let border = "var(--border)"
              let textC  = "var(--text-secondary)"

              if (selected) {
                if (isCorrect)       { bg="#3ecf8e0d"; border="rgba(62,207,142,0.4)"; textC="#3ecf8e" }
                else if (isWrong)    { bg="#f871710d"; border="rgba(248,113,113,0.4)"; textC="#f87171" }
              } else {
                if (isSelected)      { bg=`${color}0d`; border=`${color}44`; textC=color }
              }

              return (
                <div
                  key={key}
                  onClick={()=>handleSelect(key)}
                  style={{
                    display:"flex", gap:"12px", alignItems:"flex-start",
                    padding:"12px 14px", borderRadius:"var(--radius-md)",
                    background:bg, border:`1px solid ${border}`,
                    cursor:selected?"default":"pointer",
                    transition:"all 0.2s"
                  }}
                >
                  <div style={{
                    width:"26px", height:"26px", borderRadius:"50%", flexShrink:0,
                    background:selected && isCorrect?"#3ecf8e":selected && isWrong && isSelected?"#f87171":`${color}15`,
                    border:`2px solid ${selected && isCorrect?"#3ecf8e":selected && isWrong && isSelected?"#f87171":border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.75rem", fontWeight:"700",
                    color:selected && isCorrect?"white":selected && isWrong && isSelected?"white":textC
                  }}>
                    {selected && isCorrect?"✓":selected && isWrong && isSelected?"✗":key}
                  </div>
                  <p style={{ fontSize:"0.85rem", margin:0, lineHeight:1.5, color:textC, flex:1 }}>{val}</p>
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {showExpl && (
            <div style={{ background:selected===q.correct?"rgba(62,207,142,0.08)":"rgba(248,113,113,0.08)", border:`1px solid ${selected===q.correct?"rgba(62,207,142,0.25)":"rgba(248,113,113,0.25)"}`, borderRadius:"var(--radius-md)", padding:"10px 14px", marginBottom:"1rem" }}>
              <p style={{ fontSize:"0.72rem", fontWeight:"700", color:selected===q.correct?"#3ecf8e":"#f87171", margin:"0 0 4px" }}>
                {selected===q.correct?"✓ Correct!":"✗ Incorrect"}
              </p>
              <p style={{ fontSize:"0.82rem", color:"var(--text-secondary)", margin:0, lineHeight:1.6 }}>{q.explanation}</p>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={()=>handleNext(selected)}
            disabled={!selected}
            style={{
              width:"100%", padding:"12px",
              background:selected?color:"var(--bg-elevated)",
              border:"none", borderRadius:"var(--radius-md)",
              color:selected?"white":"var(--text-muted)",
              fontWeight:"700", fontSize:"0.9rem",
              cursor:selected?"pointer":"not-allowed",
              transition:"all 0.2s",
              boxShadow:selected?`0 4px 16px ${color}44`:"none"
            }}
          >
            {current<questions.length-1?"Next Question →":"See Results →"}
          </button>
        </div>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────
  if (stage==="result") {
    const passed = score>=75
    return (
      <div style={{ background:"var(--bg-card)", border:`1px solid ${passed?"rgba(62,207,142,0.3)":"rgba(248,113,113,0.3)"}`, borderRadius:"var(--radius-xl)", overflow:"hidden" }}>

        {/* Score header */}
        <div style={{ padding:"1.5rem", textAlign:"center", background:passed?"rgba(62,207,142,0.06)":"rgba(248,113,113,0.06)", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontSize:"3rem", marginBottom:"8px" }}>{passed?"🏆":score>=50?"😐":"😟"}</div>
          <div style={{ fontSize:"3rem", fontWeight:"800", color:passed?"#3ecf8e":"#f87171", lineHeight:1, marginBottom:"4px" }}>{score}%</div>
          <p style={{ fontWeight:"700", color:passed?"#3ecf8e":"#f87171", margin:"0 0 4px", fontSize:"1rem" }}>
            {passed?"Quiz Passed! 🎉":"Quiz Failed"}
          </p>
          <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", margin:0 }}>
            {passed?"Week complete! Moving to next week.":attemptsLeft>0?`${attemptsLeft} attempt${attemptsLeft!==1?"s":""} remaining today`:"No attempts left today"}
          </p>
        </div>

        <div style={{ padding:"1.2rem", display:"flex", flexDirection:"column", gap:"12px" }}>

          {/* Score breakdown */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
            {[
              { label:"Correct",   value:`${Math.round(score/20)}/5`,    color:"#3ecf8e" },
              { label:"Score",     value:`${score}%`,                    color:passed?"#3ecf8e":"#f87171" },
              { label:"Pass mark", value:"75%",                          color:"var(--text-muted)" },
            ].map(s=>(
              <div key={s.label} style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"8px", textAlign:"center" }}>
                <p style={{ fontSize:"1.1rem", fontWeight:"800", color:s.color, margin:0 }}>{s.value}</p>
                <p style={{ fontSize:"0.62rem", color:"var(--text-muted)", margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Weak areas */}
          {weakAreas.length>0 && (
            <div style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"var(--radius-lg)", padding:"1rem" }}>
              <p style={{ fontWeight:"700", color:"#f87171", fontSize:"0.85rem", margin:"0 0 8px", display:"flex", alignItems:"center", gap:"6px" }}>
                📌 Weak Areas — Revise these topics
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {weakAreas.map(area=>(
                  <div key={area} style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <span style={{ color:"#f87171", fontSize:"0.8rem" }}>→</span>
                    <span style={{ fontSize:"0.82rem", color:"var(--text-secondary)" }}>{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strong areas */}
          {strongAreas.length>0 && (
            <div style={{ background:"rgba(62,207,142,0.06)", border:"1px solid rgba(62,207,142,0.2)", borderRadius:"var(--radius-lg)", padding:"1rem" }}>
              <p style={{ fontWeight:"700", color:"#3ecf8e", fontSize:"0.85rem", margin:"0 0 8px" }}>
                ✅ Strong Areas — You know these well!
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {strongAreas.map(area=>(
                  <div key={area} style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <span style={{ color:"#3ecf8e", fontSize:"0.8rem" }}>✓</span>
                    <span style={{ fontSize:"0.82rem", color:"var(--text-secondary)" }}>{area}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question review */}
          <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"1rem" }}>
            <p style={{ fontWeight:"600", fontSize:"0.85rem", margin:"0 0 10px" }}>Question Review</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {questions.map((q,i)=>{
                const userAns = answers[q.id]
                const correct = userAns===q.correct
                return (
                  <div key={q.id} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"8px 10px", background:correct?"rgba(62,207,142,0.06)":"rgba(248,113,113,0.06)", borderRadius:"var(--radius-md)", border:`1px solid ${correct?"rgba(62,207,142,0.15)":"rgba(248,113,113,0.15)"}` }}>
                    <span style={{ fontSize:"0.8rem", color:correct?"#3ecf8e":"#f87171", flexShrink:0, marginTop:"1px" }}>{correct?"✓":"✗"}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:"0.78rem", color:"var(--text-secondary)", margin:"0 0 2px", lineHeight:1.4 }}>{q.question}</p>
                      {!correct && (
                        <p style={{ fontSize:"0.7rem", color:"#3ecf8e", margin:0 }}>Correct: {q.correct}. {q.options[q.correct as keyof typeof q.options]}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          {!passed && attemptsLeft>0 && (
            <button onClick={retake} style={{ width:"100%", padding:"12px", background:color, border:"none", borderRadius:"var(--radius-md)", color:"white", fontWeight:"700", fontSize:"0.9rem", cursor:"pointer", boxShadow:`0 4px 16px ${color}44` }}>
              Retake Quiz ({attemptsLeft} attempt{attemptsLeft!==1?"s":""} left today)
            </button>
          )}

          {passed && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ background:"rgba(62,207,142,0.08)", border:"1px solid rgba(62,207,142,0.25)", borderRadius:"var(--radius-md)", padding:"14px", textAlign:"center" }}>
                <p style={{ fontSize:"1.5rem", margin:"0 0 4px" }}>🎉</p>
                <p style={{ color:"#3ecf8e", fontWeight:"700", margin:"0 0 4px", fontSize:"0.95rem" }}>Week {weekNumber} Quiz Passed!</p>
                <p style={{ color:"var(--text-muted)", fontSize:"0.78rem", margin:"0 0 10px" }}>You scored {score}% — Week {weekNumber+1} is now unlocked!</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                    <div style={{ background:"rgba(62,207,142,0.1)", borderRadius:"var(--radius-md)", padding:"8px" }}>
                    <p style={{ fontSize:"1.2rem", fontWeight:"800", color:"#3ecf8e", margin:0 }}>{score}%</p>
                    <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", margin:0 }}>Your score</p>
                    </div>
                    <div style={{ background:"rgba(124,109,250,0.1)", borderRadius:"var(--radius-md)", padding:"8px" }}>
                    <p style={{ fontSize:"1.2rem", fontWeight:"800", color:"var(--accent)", margin:0 }}>Week {weekNumber+1}</p>
                    <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", margin:0 }}>Now unlocked</p>
                    </div>
                </div>
                </div>
                <button
                onClick={onPassed}
                style={{ width:"100%", padding:"12px", background:"linear-gradient(135deg,var(--accent),#3ecf8e)", border:"none", borderRadius:"var(--radius-md)", color:"white", fontWeight:"700", fontSize:"0.9rem", cursor:"pointer", boxShadow:"0 4px 16px rgba(62,207,142,0.3)" }}
                >
                Continue to Week {weekNumber+1} →
                </button>
            </div>
            )}
        </div>
      </div>
    )
  }

  return null
}
