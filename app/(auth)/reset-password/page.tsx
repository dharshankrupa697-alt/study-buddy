"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const [password,    setPassword]    = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [done,        setDone]        = useState(false)
  const [validToken,  setValidToken]  = useState(false)
  const [checking,    setChecking]    = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Handle the token from Supabase email link
    const handleToken = async () => {
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken  = params.get("access_token")
        const refreshToken = params.get("refresh_token")
        const type         = params.get("type")

        if (accessToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken || "",
          })
          if (!error) {
            setValidToken(true)
          } else {
            setError("Invalid or expired reset link. Please request a new one.")
          }
        } else {
          setError("Invalid reset link. Please request a new one.")
        }
      } else {
        // Check if already has session
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setValidToken(true)
        } else {
          setError("Invalid reset link. Please request a new one.")
        }
      }
      setChecking(false)
    }
    handleToken()
  }, [])

  const handleReset = async () => {
    if (password.length < 6)      { setError("Password must be at least 6 characters"); return }
    if (password !== confirmPass)  { setError("Passwords do not match"); return }
    setLoading(true); setError("")

    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    // Sign out after reset so user logs in fresh
    await supabase.auth.signOut()
    setDone(true)
    setTimeout(() => router.push("/login"), 2500)
  }

  const inputStyle = {
    width:"100%", padding:"11px 14px",
    background:"var(--bg-elevated)",
    border:"1px solid var(--border)",
    borderRadius:"var(--radius-md)",
    color:"var(--text-primary)",
    fontSize:"0.9rem", outline:"none",
    boxSizing:"border-box" as const,
    transition:"border-color 0.2s"
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", background:"var(--bg-base)" }}>

      {/* Background */}
      <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"600px", height:"600px", background:"radial-gradient(circle,rgba(124,109,250,0.08) 0%,transparent 70%)", borderRadius:"50%" }}/>
        <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:"500px", height:"500px", background:"radial-gradient(circle,rgba(62,207,142,0.06) 0%,transparent 70%)", borderRadius:"50%" }}/>
      </div>

      <div style={{ width:"100%", maxWidth:"400px", position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", margin:"0 auto 1rem", boxShadow:"0 8px 24px rgba(124,109,250,0.3)" }}>🔐</div>
          <h1 style={{ fontSize:"1.4rem", fontWeight:"700", margin:"0 0 4px" }}>Set New Password</h1>
          <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", margin:0 }}>Enter your new password below</p>
        </div>

        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:"1.8rem" }}>

          {/* Checking token */}
          {checking && (
            <div style={{ textAlign:"center", padding:"1rem" }}>
              <div style={{ width:"32px", height:"32px", border:"3px solid rgba(124,109,250,0.2)", borderTop:"3px solid #7c6dfa", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
              <p style={{ color:"var(--text-muted)", fontSize:"0.85rem" }}>Verifying reset link...</p>
            </div>
          )}

          {/* Success */}
          {!checking && done && (
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:"2.5rem", marginBottom:"8px" }}>✅</p>
              <p style={{ fontWeight:"700", color:"#3ecf8e", marginBottom:"4px", fontSize:"1rem" }}>Password Updated!</p>
              <p style={{ color:"var(--text-muted)", fontSize:"0.85rem" }}>Redirecting to login...</p>
            </div>
          )}

          {/* Invalid token */}
          {!checking && !validToken && !done && (
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:"2rem", marginBottom:"8px" }}>❌</p>
              <p style={{ fontWeight:"700", color:"#f87171", marginBottom:"8px" }}>Invalid Reset Link</p>
              <p style={{ color:"var(--text-muted)", fontSize:"0.82rem", marginBottom:"1rem" }}>
                {error || "This link has expired. Please request a new one."}
              </p>
              <Link href="/login" style={{ background:"var(--accent)", borderRadius:"var(--radius-md)", padding:"10px 20px", color:"white", textDecoration:"none", fontWeight:"600", fontSize:"0.88rem" }}>
                Back to Login
              </Link>
            </div>
          )}

          {/* Reset form */}
          {!checking && validToken && !done && (
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {error && (
                <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"var(--radius-md)", padding:"10px 14px", color:"#f87171", fontSize:"0.82rem" }}>
                  ⚠️ {error}
                </div>
              )}

              <div>
                <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>New Password</label>
                <input
                  type="password" value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                  onBlur={e=>e.target.style.borderColor="var(--border)"}
                />
              </div>

              <div>
                <label style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"block", marginBottom:"6px", fontWeight:"500" }}>Confirm Password</label>
                <input
                  type="password" value={confirmPass}
                  onChange={e=>setConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                  style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="#7c6dfa"}
                  onBlur={e=>e.target.style.borderColor="var(--border)"}
                />
                {confirmPass && (
                  <p style={{ fontSize:"0.7rem", marginTop:"4px", color:password===confirmPass?"#3ecf8e":"#f87171" }}>
                    {password===confirmPass?"✓ Passwords match":"✗ Passwords do not match"}
                  </p>
                )}
              </div>

              <button
                onClick={handleReset}
                disabled={loading||password!==confirmPass||password.length<6}
                style={{
                  padding:"12px", marginTop:"4px",
                  background:loading||password!==confirmPass||password.length<6
                    ?"var(--bg-elevated)"
                    :"linear-gradient(135deg,#7c6dfa,#3ecf8e)",
                  border:"none", borderRadius:"var(--radius-md)",
                  color:loading||password!==confirmPass||password.length<6
                    ?"var(--text-muted)":"white",
                  fontSize:"0.95rem", fontWeight:"600",
                  cursor:loading||password!==confirmPass||password.length<6
                    ?"not-allowed":"pointer",
                  transition:"all 0.2s"
                }}
              >
                {loading ? (
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                    <span style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>
                    Updating...
                  </span>
                ) : "Update Password →"}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign:"center", marginTop:"1rem", fontSize:"0.82rem", color:"var(--text-muted)" }}>
          <Link href="/login" style={{ color:"var(--accent)" }}>← Back to Login</Link>
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}