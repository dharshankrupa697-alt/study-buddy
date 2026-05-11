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

  const handleLogin = async (e:React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true)
    const {error:err}=await signIn(email,password)
    if (err) { setError(err.message); setLoading(false); return }
    router.push("/")
  }

  const handleForgot = async () => {
    if (!forgotEmail.includes("@")) { setError("Please enter a valid email"); return }
    setForgotLoading(true); setError("")
    const {error:err}=await resetPassword(forgotEmail)
    if (err) { setError(err.message); setForgotLoading(false); return }
    setForgotSent(true); setForgotLoading(false)
  }

  const inputStyle={width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"var(--radius-xl)",color:"white",fontSize:"0.95rem",outline:"none",fontFamily:"inherit",transition:"border-color 0.2s, box-shadow 0.2s",boxSizing:"border-box" as const}

  return (
    <div style={{minHeight:"100vh",display:"flex",background:"#000000"}}>

      {/* Left side — branding (desktop only) */}
      <div className="desktop-only" style={{width:"45%",background:"linear-gradient(135deg,#0a0a0a,#111111)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"3rem",borderRight:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{textAlign:"center",maxWidth:"320px"}}>
          <div style={{width:"72px",height:"72px",borderRadius:"20px",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem",margin:"0 auto 2rem",boxShadow:"0 8px 32px rgba(10,132,255,0.4)"}}>🧠</div>
          <h1 style={{fontSize:"2rem",fontWeight:"700",margin:"0 0 12px"}}>StudyBuddy</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.95rem",lineHeight:1.7,margin:"0 0 2rem"}}>Your AI-powered study companion. Personalised roadmaps, focus tracking, and smart quizzes.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",textAlign:"left"}}>
            {[
              {icon:"🗺️",label:"AI Roadmap",   desc:"Personalised study plan"},
              {icon:"🎯",label:"Focus AI",       desc:"Webcam-powered tracking"},
              {icon:"📝",label:"Week Quizzes",   desc:"Udemy-style assessments"},
              {icon:"📅",label:"Daily Planner",  desc:"Smart task management"},
            ].map(f=>(
              <div key={f.label} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"rgba(255,255,255,0.04)",borderRadius:"var(--radius-lg)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:"1.3rem"}}>{f.icon}</span>
                <div>
                  <p style={{fontWeight:"600",fontSize:"0.88rem",margin:0}}>{f.label}</p>
                  <p style={{fontSize:"0.75rem",color:"var(--text-muted)",margin:0}}>{f.desc}</p>
                </div>
                <span style={{marginLeft:"auto",color:"#30d158",fontSize:"0.85rem"}}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{width:"100%",maxWidth:"380px"}}>

          {/* Mobile logo */}
          <div className="mobile-only" style={{textAlign:"center",marginBottom:"2rem"}}>
            <div style={{width:"56px",height:"56px",borderRadius:"16px",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",margin:"0 auto 1rem",boxShadow:"0 8px 24px rgba(10,132,255,0.4)"}}>🧠</div>
            <h1 style={{fontSize:"1.6rem",fontWeight:"700",margin:0}}>StudyBuddy</h1>
          </div>

          <h2 style={{fontSize:"1.8rem",fontWeight:"700",margin:"0 0 6px"}}>Welcome back</h2>
          <p style={{color:"var(--text-muted)",fontSize:"0.9rem",margin:"0 0 2rem"}}>Sign in to continue your study journey</p>

          {error&&(
            <div style={{background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.25)",borderRadius:"var(--radius-xl)",padding:"12px 16px",color:"#ff453a",fontSize:"0.85rem",marginBottom:"1.2rem",display:"flex",gap:"8px",alignItems:"center"}}>
              <span>⚠️</span>{error}
            </div>
          )}

          {!showForgot?(
            <>
              <form onSubmit={handleLogin} style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"1.5rem"}}>
                <div>
                  <label style={{fontSize:"0.78rem",color:"var(--text-muted)",display:"block",marginBottom:"6px",fontWeight:"500"}}>Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
                </div>
                <div>
                  <label style={{fontSize:"0.78rem",color:"var(--text-muted)",display:"block",marginBottom:"6px",fontWeight:"500"}}>Password</label>
                  <div style={{position:"relative"}}>
                    <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required style={{...inputStyle,paddingRight:"48px"}} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
                    <button type="button" onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:"1.1rem",padding:0,lineHeight:1}}>
                      {showPass?"🙈":"👁️"}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{padding:"15px",marginTop:"4px",background:loading?"rgba(255,255,255,0.06)":"var(--accent)",border:"none",borderRadius:"var(--radius-xl)",color:loading?"var(--text-muted)":"white",fontSize:"1rem",fontWeight:"700",cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":"0 4px 20px rgba(10,132,255,0.35)",transition:"all 0.2s",letterSpacing:"0.3px"}}>
                  {loading?(<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}><span style={{width:"16px",height:"16px",border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Signing in...</span>):"Sign in →"}
                </button>
              </form>

              <div style={{display:"flex",flexDirection:"column",gap:"10px",alignItems:"center"}}>
                <button onClick={()=>{setShowForgot(true);setError("")}} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:"0.85rem",cursor:"pointer"}}>
                  Forgot password?
                </button>
                <p style={{fontSize:"0.88rem",color:"var(--text-muted)",margin:0}}>
                  No account?{" "}<Link href="/signup" style={{color:"var(--accent)",fontWeight:"600",textDecoration:"none"}}>Create one →</Link>
                </p>
              </div>
            </>
          ):forgotSent?(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"3rem",marginBottom:"12px"}}>✅</div>
              <p style={{fontWeight:"700",color:"#30d158",marginBottom:"6px",fontSize:"1rem"}}>Reset email sent!</p>
              <p style={{fontSize:"0.85rem",color:"var(--text-muted)",marginBottom:"1.5rem"}}>Check your inbox and click the reset link</p>
              <button onClick={()=>{setShowForgot(false);setForgotSent(false);setForgotEmail("")}} style={{background:"none",border:"none",color:"var(--accent)",fontSize:"0.88rem",cursor:"pointer"}}>← Back to login</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              <div>
                <h3 style={{fontWeight:"600",fontSize:"1.1rem",margin:"0 0 4px"}}>Reset password</h3>
                <p style={{fontSize:"0.82rem",color:"var(--text-muted)",margin:"0 0 16px"}}>Enter your email and we'll send a reset link</p>
                <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} onFocus={e=>{e.target.style.borderColor="rgba(10,132,255,0.5)";e.target.style.boxShadow="0 0 0 3px rgba(10,132,255,0.1)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";e.target.style.boxShadow="none"}}/>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{setShowForgot(false);setError("")}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"var(--radius-xl)",color:"var(--text-secondary)",fontSize:"0.9rem",cursor:"pointer",fontWeight:"500"}}>Cancel</button>
                <button onClick={handleForgot} disabled={forgotLoading} style={{flex:2,padding:"13px",background:"var(--accent)",border:"none",borderRadius:"var(--radius-xl)",color:"white",fontSize:"0.9rem",fontWeight:"700",cursor:forgotLoading?"not-allowed":"pointer",boxShadow:"0 4px 16px rgba(10,132,255,0.3)"}}>
                  {forgotLoading?"Sending...":"Send Reset Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
