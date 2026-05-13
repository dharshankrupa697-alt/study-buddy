"use client"
import { useEffect } from "react"
export default function LandingPage() {
  useEffect(() => {
    // Scroll fade-in
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target) }
      }),
      { threshold: 0.08 }
    )
    document.querySelectorAll(".fade").forEach(el => obs.observe(el))

    // Focus score count-up
    let s = 0
    const scoreEl = document.getElementById("fscore")
    const tick = setInterval(() => {
      s += 3
      if (s >= 92) { if (scoreEl) scoreEl.textContent = "92"; clearInterval(tick); return }
      if (scoreEl) scoreEl.textContent = String(s)
    }, 30)

    // Typing animation
    const reply = "Exactly right. That's called the base case — the person at the front who knows they're #1. Without it the asking never ends. In code, every recursive function needs an exit condition or it crashes. That's a stack overflow."
    let i = 0
    const typedEl = document.getElementById("typed")
    const cursorEl = document.getElementById("cursor")
    const typeChar = () => {
      if (i < reply.length) {
        if (typedEl) typedEl.textContent += reply[i++]
        setTimeout(typeChar, Math.random() * 18 + 16)
      } else {
        if (cursorEl) cursorEl.style.display = "none"
      }
    }
    setTimeout(typeChar, 1600)

    return () => clearInterval(tick)
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:#07070c; --bg1:#0c0c15; --bg2:#111120; --bg3:#181830;
          --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.13);
          --text:#eeeef5; --muted:#7070a0;
          --teal:#3ecf8e; --purple:#7c6dfa;
          --teal-dim:rgba(62,207,142,0.10); --purple-dim:rgba(124,109,250,0.10);
          --r:14px; --r-lg:22px;
        }
        .lp { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--text); line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:hidden; }

        /* Nav */
        .lp-nav { position:fixed;top:0;left:0;right:0;z-index:100;height:64px;padding:0 48px;display:flex;align-items:center;justify-content:space-between;background:rgba(7,7,12,0.8);backdrop-filter:blur(20px);border-bottom:1px solid var(--border); }
        .logo { display:flex;align-items:center;gap:10px;font-family:'Syne',sans-serif;font-weight:800;font-size:1.05rem;color:var(--text);text-decoration:none; }
        .logo-mark { width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--purple),var(--teal));display:flex;align-items:center;justify-content:center;font-size:1rem; }
        .nav-links { display:flex;gap:32px;list-style:none; }
        .nav-links a { color:var(--muted);text-decoration:none;font-size:.88rem;transition:color .2s; }
        .nav-links a:hover { color:var(--text); }
        .nav-right { display:flex;align-items:center;gap:12px; }
        .btn-ghost { padding:8px 20px;border:1px solid var(--border2);border-radius:100px;color:var(--muted);background:transparent;font-size:.85rem;cursor:pointer;text-decoration:none;transition:all .2s; }
        .btn-ghost:hover { color:var(--text);border-color:rgba(255,255,255,.22); }
        .btn-pill { padding:9px 22px;border:none;border-radius:100px;background:var(--teal);color:#07070c;font-size:.85rem;font-weight:500;cursor:pointer;text-decoration:none;transition:all .25s; }
        .btn-pill:hover { background:#52dfa0;transform:translateY(-1px);box-shadow:0 0 40px rgba(62,207,142,.3); }

        /* Hero */
        .hero { min-height:100vh;padding:120px 48px 100px;display:flex;align-items:center;position:relative;overflow:hidden; }
        .glow-purple { position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(124,109,250,.11) 0%,transparent 65%);top:-200px;right:-150px;pointer-events:none; }
        .glow-teal { position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(62,207,142,.07) 0%,transparent 65%);bottom:-100px;left:-100px;pointer-events:none; }
        .hero-inner { max-width:1220px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;position:relative;z-index:1; }
        .hero-badge { display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:100px;background:var(--teal-dim);border:1px solid rgba(62,207,142,.22);font-size:.78rem;color:var(--teal);font-weight:500;margin-bottom:28px; }
        .pulse { width:6px;height:6px;background:var(--teal);border-radius:50%;animation:pulse-dot 2s ease-in-out infinite; }
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        .lp h1 { font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(2.6rem,4.5vw,3.9rem);line-height:1.04;letter-spacing:-.03em;margin-bottom:24px; }
        .lp h1 em, .lp h2 em { font-style:normal;color:var(--teal); }
        .hero-sub { font-size:1.05rem;color:var(--muted);line-height:1.75;margin-bottom:40px;max-width:430px; }
        .hero-ctas { display:flex;gap:14px;align-items:center;flex-wrap:wrap; }
        .btn-hero { padding:14px 30px;border-radius:100px;background:var(--teal);color:#07070c;font-weight:500;font-size:.95rem;text-decoration:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .25s; }
        .btn-hero:hover { transform:translateY(-2px);box-shadow:0 0 60px rgba(62,207,142,.35); }
        .btn-outline { padding:14px 28px;border-radius:100px;border:1px solid var(--border2);color:var(--muted);background:transparent;font-size:.95rem;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s; }
        .btn-outline:hover { color:var(--text);border-color:rgba(255,255,255,.25); }

        /* Webcam */
        .cam-wrap { position:relative;display:flex;justify-content:center; }
        .cam-float { animation:float 6s ease-in-out infinite; }
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
        .cam-card { width:400px;background:var(--bg2);border:1px solid var(--border2);border-radius:20px;overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,.7),0 0 0 1px var(--border); }
        .cam-bar { display:flex;align-items:center;gap:7px;padding:12px 16px;background:var(--bg1);border-bottom:1px solid var(--border); }
        .dot { width:10px;height:10px;border-radius:50%; }
        .dr{background:#ff5f57} .dy{background:#ffbd2e} .dg{background:#28c840}
        .cam-bar span { margin-left:auto;font-size:.72rem;color:var(--muted); }
        .cam-feed { height:286px;background:#040408;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center; }
        .cam-grid { position:absolute;inset:0;background-image:linear-gradient(rgba(62,207,142,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(62,207,142,.035) 1px,transparent 1px);background-size:28px 28px;z-index:1; }
        .scan { position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(62,207,142,.7),transparent);animation:scan 2.8s linear infinite;z-index:3; }
        @keyframes scan{0%{top:-4px}100%{top:100%}}
        .face-svg { width:190px;height:230px;position:relative;z-index:2; }
        .det-box { position:absolute;width:190px;height:210px;top:50%;left:50%;transform:translate(-50%,-52%);z-index:4; }
        .crn { position:absolute;width:18px;height:18px;border-color:var(--teal);border-style:solid;animation:crn-pulse 2.2s ease-in-out infinite; }
        @keyframes crn-pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .crn-tl{top:0;left:0;border-width:2px 0 0 2px}
        .crn-tr{top:0;right:0;border-width:2px 2px 0 0}
        .crn-bl{bottom:0;left:0;border-width:0 0 2px 2px}
        .crn-br{bottom:0;right:0;border-width:0 2px 2px 0}
        .statusbar { display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--bg1);border-top:1px solid var(--border); }
        .focused-badge { display:flex;align-items:center;gap:6px;font-size:.75rem;font-weight:500;color:var(--teal); }
        .fdot { width:6px;height:6px;background:var(--teal);border-radius:50%;animation:pulse-dot 1.5s ease-in-out infinite; }
        .score-lbl { font-family:'Syne',sans-serif;font-size:.88rem;font-weight:700; }
        .score-lbl em { font-style:normal;color:var(--teal);font-size:1rem; }
        .chip { position:absolute;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:10px 14px;box-shadow:0 10px 40px rgba(0,0,0,.5);z-index:10;white-space:nowrap; }
        .chip-top { font-size:.7rem;color:var(--muted);margin-bottom:2px; }
        .chip-val { font-family:'Syne',sans-serif;font-weight:700;font-size:.92rem; }
        .chip-l { left:-90px;top:28%;animation:cf 5s ease-in-out infinite; }
        .chip-r { right:-80px;bottom:22%;animation:cf 5s ease-in-out infinite 1.2s; }
        @keyframes cf{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-12px) rotate(0deg)}}

        /* Stats */
        .stats-bar { padding:44px 48px;background:var(--bg1);border-top:1px solid var(--border);border-bottom:1px solid var(--border); }
        .stats-inner { max-width:1220px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:40px;text-align:center; }
        .stat-num { font-family:'Syne',sans-serif;font-weight:800;font-size:2.1rem;display:block;color:var(--text); }
        .stat-desc { font-size:.83rem;color:var(--muted);margin-top:4px; }

        /* Sections */
        .lp section { padding:100px 48px; }
        .wrap { max-width:1220px;margin:0 auto; }
        .tag { font-size:.75rem;font-weight:500;color:var(--teal);letter-spacing:.1em;text-transform:uppercase;display:block;margin-bottom:14px; }
        .lp h2 { font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(1.9rem,3vw,2.9rem);line-height:1.08;letter-spacing:-.025em;margin-bottom:14px; }
        .sec-sub { font-size:1rem;color:var(--muted);line-height:1.75;max-width:500px;margin-bottom:60px; }

        /* Features */
        .feat-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:20px; }
        .feat-card { background:var(--bg1);border:1px solid var(--border);border-radius:var(--r-lg);padding:30px;transition:all .3s;position:relative;overflow:hidden; }
        .feat-card::before { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--teal),transparent);opacity:0;transition:opacity .3s; }
        .feat-card:hover { border-color:var(--border2);transform:translateY(-5px);background:var(--bg2); }
        .feat-card:hover::before { opacity:.7; }
        .feat-icon { width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:18px; }
        .ic-t{background:var(--teal-dim)} .ic-p{background:var(--purple-dim)} .ic-a{background:rgba(251,191,36,.1)}
        .feat-card h3 { font-family:'Syne',sans-serif;font-weight:700;font-size:1.05rem;margin-bottom:10px;letter-spacing:-.01em; }
        .feat-card p { font-size:.88rem;color:var(--muted);line-height:1.75; }

        /* Focus section */
        .focus-bg { background:var(--bg1);border-top:1px solid var(--border);border-bottom:1px solid var(--border); }
        .two-col { display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center; }
        .focus-card { background:var(--bg2);border:1px solid var(--border2);border-radius:20px;overflow:hidden; }
        .focus-top { padding:13px 18px;background:var(--bg1);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted); }
        .live { background:var(--teal-dim);color:var(--teal);padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:500; }
        .metrics { display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border); }
        .metric { background:var(--bg2);padding:18px;text-align:center; }
        .m-val { font-family:'Syne',sans-serif;font-weight:700;font-size:1.7rem;display:block;margin-bottom:3px; }
        .m-key { font-size:.72rem;color:var(--muted); }
        .bars-wrap { padding:18px 18px 4px; }
        .bar-row { margin-bottom:12px; }
        .bar-lbl { display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-bottom:6px; }
        .bar-lbl em { font-style:normal;color:var(--teal); }
        .bar-track { height:5px;background:var(--bg3);border-radius:100px;overflow:hidden; }
        .bar-fill { height:100%;border-radius:100px;background:var(--teal);animation:bar-in 1.4s ease-out both; }
        @keyframes bar-in{from{width:0!important}}
        .alert-row { display:flex;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid var(--border);font-size:.82rem;color:var(--muted); }
        .alert-ic { width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0; }
        .alert-row time { margin-left:auto;font-size:.72rem; }
        .check-list { list-style:none;display:flex;flex-direction:column;gap:18px;margin-top:32px; }
        .check-list li { display:flex;align-items:flex-start;gap:12px;color:var(--muted);font-size:.92rem;line-height:1.65; }
        .chk { width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:2px;background:var(--teal-dim);border:1px solid rgba(62,207,142,.28);display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--teal); }

        /* Chat */
        .chat-card { background:var(--bg1);border:1px solid var(--border2);border-radius:20px;overflow:hidden; }
        .chat-header { padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px; }
        .ai-av { width:32px;height:32px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,var(--purple),var(--teal));display:flex;align-items:center;justify-content:center;font-size:.88rem; }
        .chat-name { font-weight:500;font-size:.88rem; }
        .chat-status { font-size:.72rem;color:var(--teal); }
        .messages { padding:20px;display:flex;flex-direction:column;gap:14px;min-height:280px; }
        .msg { display:flex;gap:9px; }
        .bubble { padding:11px 15px;border-radius:16px;font-size:.86rem;line-height:1.65;max-width:82%; }
        .ai-bubble { background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:4px 16px 16px 16px; }
        .user-msg { flex-direction:row-reverse; }
        .user-bubble { background:var(--purple-dim);border:1px solid rgba(124,109,250,.18);color:var(--text);border-radius:16px 4px 16px 16px; }
        .chat-footer { padding:14px 18px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:center; }
        .fake-input { flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:100px;padding:9px 16px;font-size:.82rem;color:var(--muted); }
        .send-btn { width:36px;height:36px;border-radius:50%;border:none;background:var(--teal);color:#07070c;font-size:1rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center; }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

        /* Roadmap */
        .roadmap-bg { background:var(--bg1);border-top:1px solid var(--border); }
        .weeks { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:60px; }
        .wk { background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:22px;transition:all .25s;position:relative;overflow:hidden; }
        .wk:hover { border-color:var(--border2);transform:translateY(-4px); }
        .wk.current { border-color:rgba(62,207,142,.38); }
        .wk.current::before { content:'';position:absolute;inset:0;background:linear-gradient(145deg,rgba(62,207,142,.05),transparent 60%);pointer-events:none; }
        .wk-num { font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;font-weight:500; }
        .wk-title { font-family:'Syne',sans-serif;font-weight:700;font-size:.92rem;line-height:1.3;margin-bottom:14px; }
        .wk-tasks { list-style:none;display:flex;flex-direction:column;gap:7px; }
        .wk-task { font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:7px; }
        .wk-task::before { content:'';width:4px;height:4px;border-radius:50%;background:var(--muted);flex-shrink:0; }
        .wk-task.done { color:var(--teal); }
        .wk-task.done::before { background:var(--teal); }
        .wk-bar { margin-top:14px;height:3px;background:var(--bg);border-radius:100px;overflow:hidden; }
        .wk-prog { height:100%;border-radius:100px;background:var(--teal); }

        /* CTA */
        .cta-sec { text-align:center;position:relative;overflow:hidden;border-top:1px solid var(--border); }
        .cta-glow { position:absolute;width:700px;height:350px;background:radial-gradient(ellipse,rgba(62,207,142,.09) 0%,transparent 70%);top:0;left:50%;transform:translateX(-50%);pointer-events:none; }

        /* Footer */
        .lp-footer { padding:36px 48px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between; }
        .lp-footer p { font-size:.82rem;color:var(--muted); }

        /* Scroll fade */
        .fade { opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease; }
        .fade.in { opacity:1;transform:none; }

        @media(max-width:1000px){
          .hero-inner,.two-col { grid-template-columns:1fr; }
          .cam-wrap { order:-1; }
          .chip-l,.chip-r { display:none; }
          .feat-grid,.weeks { grid-template-columns:1fr 1fr; }
          .stats-inner { grid-template-columns:1fr 1fr; }
        }
        @media(max-width:640px){
          .nav-links { display:none; }
          .lp section,.stats-bar,.lp-footer { padding-left:20px;padding-right:20px; }
          .hero { padding:100px 20px 80px; }
          .feat-grid,.weeks,.stats-inner { grid-template-columns:1fr; }
          .lp h1 { font-size:2.3rem; }
        }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap" rel="stylesheet"/>

      <div className="lp">
        {/* Nav */}
        <nav className="lp-nav">
          <a href="/" className="logo">
            <div className="logo-mark">🧠</div>
            StudyBuddy
          </a>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#focus">Focus AI</a></li>
            <li><a href="#tutor">AI Tutor</a></li>
            <li><a href="#roadmap">Roadmap</a></li>
          </ul>
          <div className="nav-right">
            <a href="/login" className="btn-ghost">Sign in</a>
            <a href="/signup" className="btn-pill">Get started free</a>
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="glow-purple"/>
          <div className="glow-teal"/>
          <div className="hero-inner">
            <div>
              <div className="hero-badge"><span className="pulse"/>Free to start · No credit card</div>
              <h1>The AI tutor<br/>that <em>watches</em><br/>you study</h1>
              <p className="hero-sub">Real-time webcam focus monitoring catches the moment your attention drifts — and gently pulls you back. Pair it with an AI roadmap and streaming tutor, and you have everything you need to actually learn.</p>
              <div className="hero-ctas">
                <a href="/signup" className="btn-hero">Generate my study plan →</a>
                <a href="#focus" className="btn-outline">▶ See how it works</a>
              </div>
            </div>
            <div className="cam-wrap">
              <div className="cam-float">
                <div className="chip chip-l"><div className="chip-top">Session focus</div><div className="chip-val" style={{color:"var(--teal)"}}>94% 🎯</div></div>
                <div className="chip chip-r"><div className="chip-top">Current streak</div><div className="chip-val">🔥 12 days</div></div>
                <div className="cam-card">
                  <div className="cam-bar">
                    <div className="dot dr"/><div className="dot dy"/><div className="dot dg"/>
                    <span>StudyBuddy · Focus Mode</span>
                  </div>
                  <div className="cam-feed">
                    <div className="cam-grid"/>
                    <div className="scan"/>
                    <svg className="face-svg" viewBox="0 0 190 230" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="95" cy="106" rx="62" ry="78" stroke="rgba(62,207,142,0.22)" strokeWidth="1.5"/>
                      <ellipse cx="72" cy="97" rx="11" ry="8.5" stroke="rgba(62,207,142,0.28)" strokeWidth="1"/>
                      <ellipse cx="118" cy="97" rx="11" ry="8.5" stroke="rgba(62,207,142,0.28)" strokeWidth="1"/>
                      <circle cx="72" cy="97" r="2.5" fill="rgba(62,207,142,0.65)"/>
                      <circle cx="118" cy="97" r="2.5" fill="rgba(62,207,142,0.65)"/>
                      <path d="M61 85 Q72 80 84 85" stroke="rgba(62,207,142,0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M106 85 Q118 80 130 85" stroke="rgba(62,207,142,0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M80 146 Q95 156 110 146" stroke="rgba(62,207,142,0.28)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                    <div className="det-box">
                      <div className="crn crn-tl"/><div className="crn crn-tr"/>
                      <div className="crn crn-bl"/><div className="crn crn-br"/>
                    </div>
                  </div>
                  <div className="statusbar">
                    <div className="focused-badge"><div className="fdot"/>FOCUSED</div>
                    <div className="score-lbl">Focus score: <em id="fscore">0</em></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="stats-bar">
          <div className="stats-inner">
            <div><span className="stat-num">2,400+</span><div className="stat-desc">Students using StudyBuddy</div></div>
            <div><span className="stat-num">1.8M</span><div className="stat-desc">Minutes studied and tracked</div></div>
            <div><span className="stat-num">89%</span><div className="stat-desc">Report better focus after 2 weeks</div></div>
            <div><span className="stat-num">4.9 ★</span><div className="stat-desc">Average user rating</div></div>
          </div>
        </div>

        {/* Features */}
        <section id="features">
          <div className="wrap">
            <span className="tag">Everything you need</span>
            <h2>Built for students<br/>who mean business</h2>
            <p className="sec-sub">Three powerful systems working together — so you don't just sit at your desk, you actually absorb what you're studying.</p>
            <div className="feat-grid">
              {[
                {icon:"👁️",cls:"ic-t",title:"Webcam Focus Tracking",desc:"MediaPipe detects your eyes, head pose, and expressions in real time. Know your exact focus score and distraction count across every session."},
                {icon:"🗺️",cls:"ic-p",title:"AI Study Roadmap",desc:"Claude generates a personalised week-by-week curriculum with daily tasks, quizzes, and checkpoints — built around your goal and schedule."},
                {icon:"🤖",cls:"ic-a",title:"Streaming AI Tutor",desc:"Answers stream in live, token by token. It knows your roadmap and current week, and adapts every explanation to your level."},
                {icon:"📊",cls:"ic-t",title:"Session Analytics",desc:"Beautiful reports showing your daily focus score, session streaks, distraction count, and expression trends over time."},
                {icon:"📋",cls:"ic-p",title:"Weekly Quiz System",desc:"Adaptive quizzes generated from your roadmap. Pass each week to unlock the next — spaced repetition baked in."},
                {icon:"📅",cls:"ic-a",title:"Daily Task Planner",desc:"Each morning your roadmap tasks are surfaced automatically. Check them off and carry forward anything incomplete."},
              ].map((f,i) => (
                <div className="feat-card fade" key={i} style={{transitionDelay:`${i*0.08}s`}}>
                  <div className={`feat-icon ${f.cls}`}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Focus tracking */}
        <section id="focus" className="focus-bg">
          <div className="wrap">
            <div className="two-col">
              <div className="focus-card fade">
                <div className="focus-top"><span className="live">LIVE</span>Session analytics · Python Fundamentals</div>
                <div className="metrics">
                  <div className="metric"><span className="m-val" style={{color:"var(--teal)"}}>94%</span><div className="m-key">Focus score</div></div>
                  <div className="metric"><span className="m-val">3</span><div className="m-key">Distractions</div></div>
                  <div className="metric"><span className="m-val">47m</span><div className="m-key">Deep focus</div></div>
                </div>
                <div className="bars-wrap">
                  {[["Overall focus","94%","94%"],["Attention depth","88%","88%"],["Eye tracking","76%","76%"]].map(([label,val,w],i)=>(
                    <div className="bar-row" key={i}>
                      <div className="bar-lbl"><span>{label}</span><em>{val}</em></div>
                      <div className="bar-track"><div className="bar-fill" style={{width:w,animationDelay:`${i*.2}s`}}/></div>
                    </div>
                  ))}
                </div>
                <div className="alert-row"><div className="alert-ic" style={{background:"var(--teal-dim)"}}>👁️</div><span>Eyes closed 3s — gentle nudge sent</span><time>2m ago</time></div>
                <div className="alert-row"><div className="alert-ic" style={{background:"rgba(251,191,36,.1)"}}>😕</div><span>Confused expression — consider a break</span><time>9m ago</time></div>
              </div>
              <div className="fade" style={{transitionDelay:".15s"}}>
                <span className="tag">Webcam intelligence</span>
                <h2>Know exactly when<br/>you lose focus</h2>
                <p style={{color:"var(--muted)",lineHeight:1.75,marginTop:4}}>Your webcam becomes a study coach. MediaPipe tracks your face, eyes, and expressions — building a real-time picture of your concentration, second by second.</p>
                <ul className="check-list">
                  <li><div className="chk">✓</div><span>Eye closure detection alerts you when drowsiness sets in before it ruins a whole session</span></li>
                  <li><div className="chk">✓</div><span>Head pose tracking notices when you look away from the screen too long</span></li>
                  <li><div className="chk">✓</div><span>Expression analysis distinguishes confused frowning from relaxed deep focus</span></li>
                  <li><div className="chk">✓</div><span>100% private — all video processing happens locally, nothing leaves your device</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* AI Tutor */}
        <section id="tutor">
          <div className="wrap">
            <div className="two-col">
              <div className="fade">
                <span className="tag">AI Tutor</span>
                <h2>Your personal tutor.<br/><em>Always available.</em></h2>
                <p style={{color:"var(--muted)",lineHeight:1.75,marginTop:4}}>Powered by Claude Sonnet. D.K explains concepts, quizzes you, debugs your thinking, and adapts to your learning style. Streaming responses mean you start reading while it's still composing.</p>
                <ul className="check-list">
                  <li><div className="chk">✓</div><span>Knows your roadmap, goal, and current week — contextual answers, not generic ones</span></li>
                  <li><div className="chk">✓</div><span>Streaming responses so answers appear live, token by token</span></li>
                  <li><div className="chk">✓</div><span>Ask it to quiz you, explain differently, or create practice problems on demand</span></li>
                </ul>
              </div>
              <div className="chat-card fade" style={{transitionDelay:".15s"}}>
                <div className="chat-header">
                  <div className="ai-av">🤖</div>
                  <div><div className="chat-name">D.K — AI Tutor</div><div className="chat-status">● Online · Roadmap: Python</div></div>
                </div>
                <div className="messages">
                  <div className="msg user-msg"><div className="bubble user-bubble">I don't get recursion. Like at all.</div></div>
                  <div className="msg"><div className="ai-av" style={{width:26,height:26,fontSize:".72rem"}}>🤖</div><div className="bubble ai-bubble">Perfect — let's fix that. Imagine you're in a queue at the cinema and can't see the front. You ask the person ahead: <em>"What number are you?"</em> They don't know either, so they ask the person ahead of them…</div></div>
                  <div className="msg user-msg"><div className="bubble user-bubble">Oh — so it keeps asking until someone knows?</div></div>
                  <div className="msg"><div className="ai-av" style={{width:26,height:26,fontSize:".72rem"}}>🤖</div>
                    <div className="bubble ai-bubble"><span id="typed"/><span id="cursor" style={{borderRight:"2px solid var(--teal)",animation:"blink .7s step-end infinite"}}>&nbsp;</span></div>
                  </div>
                </div>
                <div className="chat-footer">
                  <div className="fake-input">Ask anything about your roadmap…</div>
                  <button className="send-btn">→</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="roadmap-bg">
          <div className="wrap">
            <span className="tag">AI Roadmap</span>
            <h2>Your full study plan.<br/>Generated in seconds.</h2>
            <p className="sec-sub">Enter your goal and StudyBuddy designs a complete week-by-week curriculum with daily tasks, quizzes, and checkpoints — personalised to your pace.</p>
            <div className="weeks">
              <div className="wk current fade">
                <div className="wk-num">Week 1 · In progress</div>
                <div className="wk-title">Python Fundamentals</div>
                <ul className="wk-tasks">
                  <li className="wk-task done">Variables &amp; data types</li>
                  <li className="wk-task done">Control flow &amp; loops</li>
                  <li className="wk-task done">Functions &amp; scope</li>
                  <li className="wk-task">Lists and dictionaries</li>
                </ul>
                <div className="wk-bar"><div className="wk-prog" style={{width:"75%"}}/></div>
              </div>
              {[
                {n:"Week 2",t:"OOP & File Handling",tasks:["Classes and objects","Inheritance","Reading & writing files","Error handling"]},
                {n:"Week 3",t:"Data Structures",tasks:["Stacks & queues","Linked lists","Trees & graphs","Hash tables"]},
                {n:"Week 4",t:"Algorithms & Projects",tasks:["Sorting algorithms","Big O notation","Search strategies","Final project"]},
              ].map((w,i)=>(
                <div className="wk fade" key={i} style={{transitionDelay:`${(i+1)*.1}s`}}>
                  <div className="wk-num">{w.n}</div>
                  <div className="wk-title">{w.t}</div>
                  <ul className="wk-tasks">{w.tasks.map(t=><li className="wk-task" key={t}>{t}</li>)}</ul>
                  <div className="wk-bar"><div className="wk-prog" style={{width:"0%"}}/></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-sec">
          <div className="cta-glow"/>
          <div className="wrap">
            <span className="tag">Free to start</span>
            <h2>Stop studying hard.<br/>Start studying <em>right.</em></h2>
            <p style={{color:"var(--muted)",marginBottom:40,maxWidth:420,marginLeft:"auto",marginRight:"auto"}}>No credit card. No setup. Just tell StudyBuddy your goal and it takes it from there.</p>
            <a href="/signup" className="btn-hero" style={{display:"inline-flex"}}>Generate my free study plan →</a>
          </div>
        </section>

        {/* Footer */}
        <footer className="lp-footer">
          <a href="/" className="logo"><div className="logo-mark">🧠</div>StudyBuddy</a>
          <p>Built with Claude AI · Focus tracking by MediaPipe · © 2026</p>
        </footer>
      </div>
    </>
  )
}
