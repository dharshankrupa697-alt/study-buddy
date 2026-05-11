"use client"
import { useState, useRef, useEffect } from "react"
import { getUser, getRoadmap, getCurrentWeek, getMessageCount, incrementMessageCount } from "@/lib/supabase"

const MSG_LIMIT = 8

interface Message {
  role: "user" | "assistant"
  content: string
}

const GOAL_COLORS: Record<string, string> = {
  competitive: "#7c6dfa",
  academic:    "#3ecf8e",
  coding:      "#60a5fa",
  skill:       "#fbbf24",
}

export default function ChatPage() {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [context,     setContext]     = useState<any>(null)
  const [loadingCtx,  setLoadingCtx]  = useState(true)
  const [userId,      setUserId]      = useState("")
  const [msgCount,    setMsgCount]    = useState(0)
  const [limitHit,    setLimitHit]    = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { setLoadingCtx(false); return }
      setUserId(user.id)

      const [roadmapData, weekData, count] = await Promise.all([
        getRoadmap(user.id),
        getCurrentWeek(user.id),
        getMessageCount(user.id),
      ])

      setMsgCount(count)
      if (count >= MSG_LIMIT) setLimitHit(true)

      if (roadmapData) {
        let rm = roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try {
            const parsed=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim())
            if (parsed.weeks?.length>0) rm=parsed
          } catch {}
        }
        const cw = rm?.weeks?.find((w:any)=>w.week===weekData)||rm?.weeks?.[0]
        const ctx = {
          name:        user.user_metadata?.name||"Student",
          goalType:    roadmapData.goal_type,
          goalDetails: roadmapData.goal_details,
          currentWeek: weekData,
          weekFocus:   cw?.focus||"",
          weekTasks:   cw?.tasks||[],
          totalWeeks:  rm?.weeks?.length||0,
          phase:       cw?.phase||"",
        }
        setContext(ctx)
        setMessages([{
          role:"assistant",
          content:`Hi ${ctx.name}! 👋 I'm your AI study tutor.\n\nI can see you're on **Week ${ctx.currentWeek}** of your ${ctx.goalType} preparation — focusing on **${ctx.weekFocus}**.\n\nHow can I help you today?\n\n_Note: You have ${MSG_LIMIT - count} free message${MSG_LIMIT-count!==1?"s":""} remaining._`
        }])
      } else {
        setMessages([{
          role:"assistant",
          content:`Hi! 👋 I'm your AI study tutor. Ask me anything!\n\n_Note: You have ${MSG_LIMIT - count} free message${MSG_LIMIT-count!==1?"s":""} remaining._`
        }])
      }
      setLoadingCtx(false)
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" })
  }, [messages])

  const buildSystem = () => {
    if (!context) return "You are StudyBuddy, a helpful AI tutor. Answer clearly and encourage the user."
    return `You are StudyBuddy, an expert AI tutor for ${context.name}.
STUDENT CONTEXT:
- Goal: ${context.goalType} preparation
- Details: ${JSON.stringify(context.goalDetails)}
- Current Week: ${context.currentWeek} of ${context.totalWeeks}
- Phase: ${context.phase}
- This Week's Focus: ${context.weekFocus}
- This Week's Tasks: ${context.weekTasks.join(", ")}
YOUR ROLE: Answer in context of their ${context.goalType} preparation. Be encouraging, clear and concise.`
  }

  const sendMessage = async () => {
    if (!input.trim()||loading||limitHit) return

    const userMsg: Message = { role:"user", content:input }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    setLoading(true)

    try {
      const res  = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages:updated, system:buildSystem() })
      })
      const data = await res.json()

      // Increment count in Supabase
      const newCount = await incrementMessageCount(userId)
      setMsgCount(newCount)
      if (newCount >= MSG_LIMIT) setLimitHit(true)

      const remaining = MSG_LIMIT - newCount
      const suffix = remaining > 0
        ? `\n\n_${remaining} free message${remaining!==1?"s":""} remaining._`
        : `\n\n_You've used all ${MSG_LIMIT} free messages. Upgrade to Pro for unlimited access!_`

      setMessages([...updated, {
        role:"assistant",
        content: data.reply + suffix
      }])
    } catch {
      setMessages([...updated, { role:"assistant", content:"Sorry, something went wrong. Please try again!" }])
    } finally { setLoading(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const color = GOAL_COLORS[context?.goalType] || "#7c6dfa"
  const remaining = Math.max(0, MSG_LIMIT - msgCount)
  const remainingPct = (remaining / MSG_LIMIT) * 100

  const quickPrompts = context ? [
    `Explain this week's topic: ${context.weekFocus?.substring(0,30)}`,
    "What should I focus on today?",
    "Quiz me on my current week",
    "I'm feeling overwhelmed, help me",
  ] : []

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em style="color:var(--text-muted);font-size:0.8em">$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"var(--bg-base)" }}>

      {/* Header */}
      <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid var(--border)", background:"var(--bg-surface)", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
        <a href="/" style={{ color:"var(--text-muted)", textDecoration:"none", fontSize:"1.2rem", lineHeight:1 }}>←</a>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:"1.1rem", fontWeight:"600", margin:0 }}>AI Tutor</h1>
          {context && (
            <p style={{ color:"var(--text-muted)", fontSize:"0.72rem", margin:0 }}>
              {context.goalType} prep · Week {context.currentWeek} · {context.phase}
            </p>
          )}
        </div>

        {/* Message counter */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <span style={{ fontSize:"0.72rem", color:limitHit?"#f87171":remaining<=2?"#fbbf24":"var(--text-muted)" }}>
              {limitHit ? "Limit reached" : `${remaining} left`}
            </span>
            <div style={{ width:"60px", height:"4px", background:"rgba(255,255,255,0.08)", borderRadius:"99px", overflow:"hidden" }}>
              <div style={{
                width:`${remainingPct}%`, height:"100%", borderRadius:"99px",
                background:limitHit?"#f87171":remaining<=2?"#fbbf24":color,
                transition:"width 0.5s"
              }}/>
            </div>
          </div>
          {context && (
            <div style={{ display:"flex", alignItems:"center", gap:"6px", background:`${color}15`, border:`1px solid ${color}33`, borderRadius:"var(--radius-md)", padding:"3px 8px" }}>
              <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:color, boxShadow:`0 0 4px ${color}` }}/>
              <span style={{ fontSize:"0.68rem", color, fontWeight:"600" }}>Roadmap aware</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
        {loadingCtx ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ width:"32px", height:"32px", border:"3px solid rgba(124,109,250,0.2)", borderTop:"3px solid #7c6dfa", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 8px" }}/>
              <p style={{ color:"var(--text-muted)", fontSize:"0.82rem" }}>Loading your tutor...</p>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", gap:"10px" }}>
                {msg.role==="assistant" && (
                  <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem", flexShrink:0, alignSelf:"flex-end" }}>🤖</div>
                )}
                <div style={{
                  maxWidth:"75%", padding:"12px 16px",
                  borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                  background:msg.role==="user"?"var(--accent)":"var(--bg-card)",
                  border:msg.role==="assistant"?"1px solid var(--border)":"none",
                  fontSize:"0.9rem", lineHeight:1.6, color:"var(--text-primary)",
                  animation:"fadeIn 0.2s ease"
                }} dangerouslySetInnerHTML={{ __html:formatMessage(msg.content) }}/>
                {msg.role==="user" && (
                  <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.85rem", flexShrink:0, alignSelf:"flex-end", border:"1px solid var(--border)" }}>👤</div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display:"flex", gap:"10px", alignItems:"flex-end" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem" }}>🤖</div>
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"18px 18px 18px 4px", padding:"12px 16px", display:"flex", gap:"4px", alignItems:"center" }}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:"var(--text-muted)", animation:`bounce 0.8s ${i*0.15}s infinite alternate` }}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </>
        )}
      </div>

      {/* Quick prompts */}
      {!loadingCtx && messages.length<=1 && quickPrompts.length>0 && !limitHit && (
        <div style={{ padding:"0 1.5rem 10px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {quickPrompts.map(prompt=>(
            <button key={prompt} onClick={()=>setInput(prompt)} style={{
              background:"var(--bg-card)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-md)", color:"var(--text-secondary)",
              padding:"6px 12px", fontSize:"0.75rem", cursor:"pointer", transition:"all 0.2s"
            }}>
              {prompt.length>40?prompt.substring(0,40)+"...":prompt}
            </button>
          ))}
        </div>
      )}

      {/* Limit hit banner */}
      {limitHit && (
        <div style={{ padding:"0 1.5rem 12px" }}>
          <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"var(--radius-lg)", padding:"1rem", textAlign:"center" }}>
            <p style={{ fontSize:"1.5rem", margin:"0 0 6px" }}>🔒</p>
            <p style={{ fontWeight:"700", color:"#f87171", margin:"0 0 4px", fontSize:"0.9rem" }}>Free Limit Reached</p>
            <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", margin:0 }}>
              You've used all {MSG_LIMIT} free AI tutor messages. Upgrade to Pro for unlimited access!
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid var(--border)", background:"var(--bg-surface)", display:"flex", gap:"10px", alignItems:"flex-end", flexShrink:0 }}>
        <textarea
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={limitHit}
          placeholder={limitHit?"Upgrade to Pro for unlimited messages...":context?`Ask about Week ${context.currentWeek}: ${context.weekFocus?.substring(0,30)}...`:"Ask any doubt..."}
          rows={1}
          style={{
            flex:1, background:limitHit?"var(--bg-elevated)":"var(--bg-elevated)",
            border:"1px solid var(--border)", borderRadius:"var(--radius-lg)",
            color:limitHit?"var(--text-muted)":"var(--text-primary)",
            padding:"12px 16px", fontSize:"0.9rem", resize:"none",
            outline:"none", fontFamily:"inherit", lineHeight:1.5,
            maxHeight:"120px", opacity:limitHit?0.6:1,
            cursor:limitHit?"not-allowed":"text"
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading||!input.trim()||limitHit}
          style={{
            padding:"12px 20px",
            background:loading||!input.trim()||limitHit?"var(--bg-elevated)":"var(--accent)",
            border:"none", borderRadius:"var(--radius-lg)",
            color:loading||!input.trim()||limitHit?"var(--text-muted)":"white",
            fontSize:"0.9rem", fontWeight:"600",
            cursor:loading||!input.trim()||limitHit?"not-allowed":"pointer",
            transition:"all 0.2s", flexShrink:0
          }}
        >
          {loading?"...":"Send →"}
        </button>
      </div>

      <style>{`
        @keyframes bounce { to { transform:translateY(-4px); opacity:0.5; } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
