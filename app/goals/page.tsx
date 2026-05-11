"use client"
import { useState, useEffect } from "react"
import { getGoals, addGoal, updateGoalHours, deleteGoal, getUser } from "@/lib/supabase"

interface Goal {
  id: string
  title: string
  subject: string
  target_hours: number
  completed_hours: number
  deadline: string
  completed: boolean
  created_at: string
}

const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","History",
  "Geography","English","Computer Science","Economics","Other"]

const COLORS: Record<string, string> = {
  Mathematics:"#534AB7", Physics:"#1D9E75", Chemistry:"#D85A30",
  Biology:"#2E8B57", History:"#BA7517", Geography:"#1E7FA6",
  English:"#9B4DBF", "Computer Science":"#0D7377", Economics:"#C0392B", Other:"#888"
}

export default function GoalsPage() {
  const [goals,     setGoals]     = useState<Goal[]>([])
  const [userId,    setUserId]    = useState<string|null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState<"all"|"active"|"completed">("all")
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState("")
  const [form, setForm] = useState({
    title:"", subject:"Mathematics", targetHours:"5", deadline:""
  })

  // ── Load goals from DB ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const data = await getGoals(user.id)
      setGoals(data as Goal[])
      setLoading(false)
    }
    load()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  // ── Add goal ─────────────────────────────────────────────────
  const handleAddGoal = async () => {
    if (!form.title.trim() || !form.deadline || !userId) return
    setSaving(true)
    const { data, error } = await addGoal({
      user_id:      userId,
      title:        form.title.trim(),
      subject:      form.subject,
      target_hours: Number(form.targetHours),
      deadline:     form.deadline,
    })
    if (!error && data) {
      setGoals(g => [data as Goal, ...g])
      setForm({ title:"", subject:"Mathematics", targetHours:"5", deadline:"" })
      setShowForm(false)
      showToast("✅ Goal added!")
    }
    setSaving(false)
  }

  // ── Log hours ────────────────────────────────────────────────
  const handleLogHours = async (goal: Goal, hours: number) => {
    const newHours    = Math.min(goal.target_hours, goal.completed_hours + hours)
    const isCompleted = newHours >= goal.target_hours
    await updateGoalHours(goal.id, newHours, isCompleted)
    setGoals(gs => gs.map(g =>
      g.id === goal.id
        ? { ...g, completed_hours: newHours, completed: isCompleted }
        : g
    ))
    if (isCompleted) showToast("🎉 Goal completed!")
  }

  // ── Reset goal ────────────────────────────────────────────────
  const handleReset = async (goal: Goal) => {
    await updateGoalHours(goal.id, 0, false)
    setGoals(gs => gs.map(g =>
      g.id === goal.id
        ? { ...g, completed_hours: 0, completed: false }
        : g
    ))
    showToast("🔄 Goal reset — fresh start!")
  }

  // ── Delete goal ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await deleteGoal(id)
    setGoals(gs => gs.filter(g => g.id !== id))
    showToast("🗑️ Goal deleted")
  }

  // ── Toggle complete ───────────────────────────────────────────
  const handleToggle = async (goal: Goal) => {
    const newCompleted = !goal.completed
    await updateGoalHours(goal.id, goal.completed_hours, newCompleted)
    setGoals(gs => gs.map(g =>
      g.id === goal.id ? { ...g, completed: newCompleted } : g
    ))
  }

  const filtered = goals.filter(g =>
    filter === "all" ? true : filter === "active" ? !g.completed : g.completed
  )

  const daysLeft = (deadline: string) =>
    Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)

  const totalHours  = goals.reduce((a, g) => a + g.target_hours, 0)
  const doneHours   = goals.reduce((a, g) => a + g.completed_hours, 0)
  const overallPct  = totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0
  const completed   = goals.filter(g => g.completed).length

  const inputStyle = {
    width:"100%", background:"#111", border:"1px solid #333",
    borderRadius:"8px", color:"white", padding:"10px 14px",
    fontSize:"0.9rem", outline:"none", boxSizing:"border-box" as const
  }

  return (
    <main style={{ minHeight:"100vh", background:"#0f0f0f", color:"white", padding:"1.5rem", maxWidth:"520px", margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <a href="/" style={{ color:"#888", textDecoration:"none", fontSize:"1.2rem" }}>←</a>
          <div>
            <h1 style={{ fontSize:"1.2rem", fontWeight:"600" }}>My Goals</h1>
            <p style={{ color:"#555", fontSize:"0.75rem" }}>Track what matters most</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{
          background:"#534AB7", border:"none", borderRadius:"10px",
          color:"white", padding:"8px 16px", fontSize:"0.9rem",
          fontWeight:"600", cursor:"pointer"
        }}>
          {showForm ? "Cancel" : "+ Add Goal"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          background:"#1D9E7522", border:"1px solid #1D9E7544",
          borderRadius:"10px", padding:"10px 16px",
          marginBottom:"1rem", textAlign:"center",
          fontSize:"0.85rem", color:"#1D9E75", fontWeight:"600"
        }}>{toast}</div>
      )}

      {/* Add Goal Form */}
      {showForm && (
        <div style={{ background:"#1a1a1a", borderRadius:"16px", border:"1px solid #2a2a2a", padding:"1.5rem", marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:"1rem", fontWeight:"600", marginBottom:"1rem" }}>New Goal</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <div>
              <label style={{ fontSize:"0.78rem", color:"#888", display:"block", marginBottom:"4px" }}>Goal Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="e.g. Complete Chapter 5 exercises" style={inputStyle} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div>
                <label style={{ fontSize:"0.78rem", color:"#888", display:"block", marginBottom:"4px" }}>Subject</label>
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject:e.target.value }))} style={inputStyle}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"0.78rem", color:"#888", display:"block", marginBottom:"4px" }}>Target Hours</label>
                <input type="number" min="1" max="200" value={form.targetHours} onChange={e => setForm(f => ({ ...f, targetHours:e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize:"0.78rem", color:"#888", display:"block", marginBottom:"4px" }}>Deadline *</label>
              <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline:e.target.value }))} style={{ ...inputStyle, colorScheme:"dark" }} />
            </div>
            <button onClick={handleAddGoal} disabled={saving} style={{
              background: saving ? "#2a2a2a" : "#1D9E75", border:"none",
              borderRadius:"10px", color:"white", padding:"12px",
              fontSize:"1rem", fontWeight:"600", cursor: saving ? "not-allowed" : "pointer"
            }}>
              {saving ? "Saving..." : "Create Goal 🎯"}
            </button>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.75rem", marginBottom:"1.5rem" }}>
        {[
          { label:"Goals",      value:`${completed}/${goals.length}` },
          { label:"Hours Done", value:`${doneHours.toFixed(1)}h` },
          { label:"Overall",    value:`${overallPct}%` },
        ].map(s => (
          <div key={s.label} style={{ background:"#1a1a1a", borderRadius:"12px", border:"1px solid #2a2a2a", padding:"0.8rem", textAlign:"center" }}>
            <p style={{ color:"#666", fontSize:"0.68rem", marginBottom:"4px" }}>{s.label}</p>
            <p style={{ fontSize:"1.1rem", fontWeight:"700" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div style={{ background:"#1a1a1a", borderRadius:"12px", border:"1px solid #2a2a2a", padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
          <span style={{ fontSize:"0.8rem", color:"#888" }}>Overall progress</span>
          <span style={{ fontSize:"0.8rem", fontWeight:"600", color:"#1D9E75" }}>{overallPct}%</span>
        </div>
        <div style={{ height:"8px", background:"#2a2a2a", borderRadius:"4px", overflow:"hidden" }}>
          <div style={{ width:`${overallPct}%`, height:"100%", background:"linear-gradient(90deg,#534AB7,#1D9E75)", borderRadius:"4px", transition:"width 0.5s" }} />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"1rem" }}>
        {(["all","active","completed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter===f ? "#534AB7" : "#1a1a1a",
            border: filter===f ? "none" : "1px solid #2a2a2a",
            borderRadius:"8px", color:"white", padding:"6px 16px",
            fontSize:"0.82rem", fontWeight:"500", cursor:"pointer",
            textTransform:"capitalize"
          }}>{f}</button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:"center", padding:"3rem", color:"#555" }}>
          <div style={{ fontSize:"2rem", marginBottom:"8px" }}>⏳</div>
          <p>Loading your goals...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"3rem", color:"#444" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:"8px" }}>🎯</div>
          <p>No goals yet. Add your first goal!</p>
        </div>
      )}

      {/* Goals list */}
      <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
        {filtered.map(goal => {
          const pct    = Math.round((goal.completed_hours / goal.target_hours) * 100)
          const days   = daysLeft(goal.deadline)
          const color  = COLORS[goal.subject] || "#888"
          const urgent = days <= 3 && !goal.completed
          const overdue= days < 0 && !goal.completed

          return (
            <div key={goal.id} style={{
              background:"#1a1a1a", borderRadius:"16px",
              border:`1px solid ${goal.completed ? "#1D9E7544" : urgent ? "#D85A3044" : "#2a2a2a"}`,
              padding:"1.2rem", borderLeft:`4px solid ${goal.completed ? "#1D9E75" : color}`
            }}>
              {/* Top row */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px", flexWrap:"wrap" }}>
                    <span style={{ background:color+"22", color, borderRadius:"6px", padding:"2px 8px", fontSize:"0.72rem", fontWeight:"600" }}>{goal.subject}</span>
                    {goal.completed && <span style={{ background:"#1D9E7522", color:"#1D9E75", borderRadius:"6px", padding:"2px 8px", fontSize:"0.72rem", fontWeight:"600" }}>✓ Done</span>}
                    {overdue  && <span style={{ background:"#D85A3022", color:"#D85A30", borderRadius:"6px", padding:"2px 8px", fontSize:"0.72rem", fontWeight:"600" }}>Overdue</span>}
                    {urgent && !overdue && <span style={{ background:"#BA751722", color:"#BA7517", borderRadius:"6px", padding:"2px 8px", fontSize:"0.72rem", fontWeight:"600" }}>⚡ Urgent</span>}
                  </div>
                  <p style={{ fontWeight:"600", fontSize:"0.95rem", margin:0, opacity:goal.completed?0.6:1, textDecoration:goal.completed?"line-through":"none" }}>
                    {goal.title}
                  </p>
                </div>
                <button onClick={() => handleDelete(goal.id)} style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:"1.1rem", padding:"0 0 0 8px" }}>✕</button>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontSize:"0.75rem", color:"#888" }}>{goal.completed_hours}h / {goal.target_hours}h</span>
                  <span style={{ fontSize:"0.75rem", fontWeight:"600", color:goal.completed?"#1D9E75":color }}>{pct}%</span>
                </div>
                <div style={{ height:"6px", background:"#2a2a2a", borderRadius:"4px", overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:goal.completed?"#1D9E75":color, borderRadius:"4px", transition:"width 0.4s" }} />
                </div>
              </div>

              {/* Deadline + actions */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"8px" }}>
                <span style={{ fontSize:"0.75rem", color:overdue?"#D85A30":urgent?"#BA7517":"#666" }}>
                  {overdue ? `⚠️ ${Math.abs(days)}d overdue` : days===0 ? "⚡ Due today!" : `📅 ${days}d left`}
                </span>

                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {!goal.completed && (
                    <>
                      {[0.5,1,2].map(h => (
                        <button key={h} onClick={() => handleLogHours(goal, h)} style={{
                          background:"#2a2a2a", border:"none", borderRadius:"6px",
                          color:"#ccc", padding:"4px 10px", fontSize:"0.75rem",
                          cursor:"pointer", fontWeight:"500"
                        }}>+{h}h</button>
                      ))}
                      <button onClick={() => handleToggle(goal)} style={{
                        background:color+"33", border:`1px solid ${color}44`,
                        borderRadius:"6px", color, padding:"4px 10px",
                        fontSize:"0.75rem", cursor:"pointer", fontWeight:"600"
                      }}>✓ Done</button>
                    </>
                  )}

                  {/* Reset button */}
                  <button onClick={() => handleReset(goal)} style={{
                    background:"#2a2a2a", border:"1px solid #444",
                    borderRadius:"6px", color:"#888", padding:"4px 10px",
                    fontSize:"0.75rem", cursor:"pointer", fontWeight:"500"
                  }}>🔄 Reset</button>

                  {goal.completed && (
                    <button onClick={() => handleToggle(goal)} style={{
                      background:"#2a2a2a", border:"none", borderRadius:"6px",
                      color:"#888", padding:"4px 10px", fontSize:"0.75rem", cursor:"pointer"
                    }}>Undo</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </main>
  )
}