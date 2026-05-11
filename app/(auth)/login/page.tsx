"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, resetPassword } from "@/lib/supabase"

export default function LoginPage() {
  const [email,         setEmail]         = useState("")
  const [password,      setPassword]      = useState("")
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState("")
  const [showPass,      setShowPass]      = useState(false)
  const [showForgot,    setShowForgot]    = useState(false)
  const [forgotEmail,   setForgotEmail]   = useState("")
  const [forgotSent,    setForgotSent]    = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) { setError(err.message); setLoading(false); return }
    router.push("/")
  }

  const handleForgot = async () => {
    if (!forgotEmail.includes("@")) { setError("Please enter a valid email"); return }
    setForgotLoading(true); setError("")
    const { error: err } = await resetPassword(forgotEmail)
    if (err) { setError(err.message); setForgotLoading(false); return }
    setForgotSent(true); setForgotLoading(false)
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", background:"var(--bg-base)" }}>

      {/* Background gradient */}
      <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"600px", height:"600px", background:"radial-gradient(circle, rgba(124,109,250,0.08) 0%, transparent 70%)", borderRadius:"50%" }}/>
        <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"500px", height:"500px", background:"radial-gradient(circle, rgba(62,207,142,0.06) 0%, transparent 70%)", borderRadius:"50%" }}/>
      </div>

      <div style={{ width:"100%", maxWidth:"420px", position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:"52px", height:"52px", borderRadius:"16px", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem", margin:"0 auto 1rem", boxShadow:"0 8px 24px rgba(124,109,250,0.3)" }}>🧠</div>
          <h1 style={{ fontSize:"1.6rem", fontWeight:"700", margin:"0 0 6px" }}>Welcome back</h1>
          <p style={{ color:"var(--text-muted)", fontSize:"0.88rem", margin:0 }}>Sign in to continue your study journey</p>
        </div>

        {/* Card */}
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:"2rem" }}>

          {error && (
            <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:"var(--radius-md)", padding:"10px 14px", color:"#f87171", fontSize:"0.82rem", marginBottom:"1.2rem", display:"flex", gap:"8px", alignItems:"center" }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            <div>
              <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>Email address</label>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={{ width:"100%", padding:"11px 14px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-primary)", fontSize:"0.9rem", outline:"none", transition:"border-color 0.2s", boxSizing:"border-box" as const }}
                onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                onBlur={e=>e.target.style.borderColor="var(--border)"}
              />
            </div>

            <div>
              <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>Password</label>
              <div style={{ position:"relative" }}>
                <input
                  type={showPass?"text":"password"} value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="Your password" required
                  style={{ width:"100%", padding:"11px 44px 11px 14px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-primary)", fontSize:"0.9rem", outline:"none", transition:"border-color 0.2s", boxSizing:"border-box" as const }}
                  onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                  onBlur={e=>e.target.style.borderColor="var(--border)"}
                />
                <button type="button" onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:"1rem", padding:0, lineHeight:1 }}>
                  {showPass?"🙈":"👁"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              padding:"12px", marginTop:"4px",
              background:loading?"var(--bg-elevated)":"linear-gradient(135deg,#7c6dfa,#6b5ce7)",
              border:"none", borderRadius:"var(--radius-md)",
              color:loading?"var(--text-muted)":"white",
              fontSize:"0.95rem", fontWeight:"600",
              cursor:loading?"not-allowed":"pointer",
              boxShadow:loading?"none":"0 4px 16px rgba(124,109,250,0.3)",
              transition:"all 0.2s"
            }}>
              {loading ? (
                <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                  <span style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>
                  Signing in...
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop:"1.5rem", paddingTop:"1.5rem", borderTop:"1px solid var(--border)" }}>
            {!showForgot ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px", textAlign:"center" }}>
                <button onClick={()=>{ setShowForgot(true); setError("") }} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:"0.82rem", cursor:"pointer", textDecoration:"underline" }}>
                  Forgot password?
                </button>
                <p style={{ fontSize:"0.85rem", color:"var(--text-muted)", margin:0 }}>
                  Don't have an account?{" "}
                  <Link href="/signup" style={{ color:"#7c6dfa", fontWeight:"600", textDecoration:"none" }}>Create one</Link>
                </p>
              </div>
            ) : forgotSent ? (
              <div style={{ background:"rgba(62,207,142,0.08)", border:"1px solid rgba(62,207,142,0.2)", borderRadius:"var(--radius-md)", padding:"14px", textAlign:"center" }}>
                <p style={{ fontSize:"1.2rem", margin:"0 0 6px" }}>✅</p>
                <p style={{ fontSize:"0.88rem", color:"#3ecf8e", fontWeight:"600", margin:"0 0 4px" }}>Reset email sent!</p>
                <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", margin:"0 0 10px" }}>Check your inbox and click the reset link</p>
                <button onClick={()=>{ setShowForgot(false); setForgotSent(false); setForgotEmail("") }} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:"0.82rem", cursor:"pointer" }}>
                  ← Back to login
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                <p style={{ fontSize:"0.85rem", fontWeight:"600", margin:0 }}>Reset your password</p>
                <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", margin:0 }}>Enter your email and we'll send a reset link</p>
                <input
                  type="email" value={forgotEmail}
                  onChange={e=>setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{ width:"100%", padding:"10px 14px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-primary)", fontSize:"0.88rem", outline:"none", boxSizing:"border-box" as const }}
                  onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                  onBlur={e=>e.target.style.borderColor="var(--border)"}
                />
                <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={()=>{ setShowForgot(false); setError("") }} style={{ flex:1, padding:"10px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-secondary)", fontSize:"0.85rem", cursor:"pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleForgot} disabled={forgotLoading} style={{ flex:1, padding:"10px", background:"var(--accent)", border:"none", borderRadius:"var(--radius-md)", color:"white", fontSize:"0.85rem", fontWeight:"600", cursor:forgotLoading?"not-allowed":"pointer" }}>
                    {forgotLoading?"Sending...":"Send Reset Link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features hint */}
        <div style={{ marginTop:"1.5rem", display:"flex", justifyContent:"center", gap:"1.5rem" }}>
          {["🧠 AI Roadmap","📷 Focus AI","🗺️ Smart Plan"].map(f=>(
            <span key={f} style={{ fontSize:"0.72rem", color:"var(--text-muted)" }}>{f}</span>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}