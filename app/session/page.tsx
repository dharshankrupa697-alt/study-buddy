"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import dynamic from "next/dynamic"
const FocusParticles = dynamic(() => import("@/components/FocusParticles"), { ssr:false })
import { saveSession, getUser, getRoadmap, getCurrentWeek, getProgress, toggleTask } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

const TECHNIQUES = {
  pomodoro:   { name:"Pomodoro",   emoji:"🍅", color:"#ff453a", work:25, shortBreak:5,  longBreak:15, cycles:4, desc:"25min focus, 5min break" },
  deepwork:   { name:"Deep Work",  emoji:"🧠", color:"#bf5af2", work:90, shortBreak:20, longBreak:30, cycles:2, desc:"90min deep focus" },
  timeboxing: { name:"Timeboxing", emoji:"📦", color:"#ff9f0a", work:45, shortBreak:10, longBreak:20, cycles:3, desc:"45min time blocks" },
  spaced:     { name:"Spaced Rep", emoji:"🔁", color:"#30d158", work:20, shortBreak:10, longBreak:20, cycles:3, desc:"20min intervals" },
  feynman:    { name:"Feynman",    emoji:"✍️", color:"#5ac8fa", work:30, shortBreak:10, longBreak:15, cycles:3, desc:"Teach to learn" },
}

type TechKey = keyof typeof TECHNIQUES
type Phase   = "idle"|"loading"|"work"|"break"|"longbreak"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#bf5af2", academic:"#30d158", coding:"#0a84ff", skill:"#ff9f0a"
}

const LEFT_EYE_TOP=[159,160,161], LEFT_EYE_BOT=[145,144,163]
const RIGHT_EYE_TOP=[386,387,388], RIGHT_EYE_BOT=[374,373,380]
const LEFT_EYE_INNER=133,  LEFT_EYE_OUTER=33
const RIGHT_EYE_INNER=362, RIGHT_EYE_OUTER=263

const EXPR_MAP: Record<string,{emoji:string;hint:string}> = {
  happy:     { emoji:"😄", hint:"Great energy! You're in the zone 🎯" },
  surprised: { emoji:"😮", hint:"Interesting! Jot that down 📝" },
  confused:  { emoji:"🤔", hint:"Stuck? Ask the AI Tutor!" },
  frustrated:{ emoji:"😤", hint:"Deep breath — hard topics = real growth 💪" },
  sad:       { emoji:"😢", hint:"You can do this — one step at a time 🌟" },
  yawning:   { emoji:"🥱", hint:"Tired? Take a quick walk!" },
  neutral:   { emoji:"😐", hint:"Focused and steady 🎯" },
}

const ALERTS = {
  phone:      ["📵 Phone detected! Put it away!", "No phones during study time!"],
  distracted: ["Eyes back on screen 👀", "Stay focused! You've got this 🎯"],
  drowsy:     ["Getting drowsy! Wake up 😴", "Splash some water 💧"],
  absent:     ["Come back to your desk! 👻", "Session still running..."],
}
const pick = (k:keyof typeof ALERTS) => { const l=ALERTS[k]; return l[Math.floor(Math.random()*l.length)] }

function calcEAR(lm:any[], topIdx:number[], botIdx:number[], innerIdx:number, outerIdx:number) {
  const avgTop=topIdx.reduce((s,i)=>s+(lm[i]?.y||0),0)/topIdx.length
  const avgBot=botIdx.reduce((s,i)=>s+(lm[i]?.y||0),0)/botIdx.length
  const inner=lm[innerIdx]?.x||0, outer=lm[outerIdx]?.x||0
  const height=Math.abs(avgTop-avgBot), width=Math.abs(inner-outer)
  return width>0?height/width:0.3
}

function calcHeadPose(lm:any[]) {
  const nose=lm[1], le=lm[33], re=lm[263]
  if (!nose||!le||!re) return {yaw:0,pitch:0}
  const midX=(le.x+re.x)/2, midY=(le.y+re.y)/2, eyeW=Math.abs(le.x-re.x)
  return { yaw:eyeW>0?(nose.x-midX)/eyeW:0, pitch:eyeW>0?(nose.y-midY)/eyeW:0 }
}

function detectExpression(bs:any[]) {
  const g=(n:string)=>bs.find((b:any)=>b.categoryName===n)?.score??0
  const jaw=g("jawOpen"), smile=(g("mouthSmileLeft")+g("mouthSmileRight"))/2
  const frown=(g("mouthFrownLeft")+g("mouthFrownRight"))/2, browDn=(g("browDownLeft")+g("browDownRight"))/2
  const browUp=g("browInnerUp"), cheek=(g("cheekSquintLeft")+g("cheekSquintRight"))/2
  const wide=(g("eyeWideLeft")+g("eyeWideRight"))/2
  if (jaw>0.5)                  return { type:"yawning",    ...EXPR_MAP.yawning }
  if (smile>0.4&&cheek>0.1)    return { type:"happy",      ...EXPR_MAP.happy }
  if (browUp>0.5&&wide>0.2)    return { type:"surprised",  ...EXPR_MAP.surprised }
  if (browDn>0.4&&frown>0.25)  return { type:"frustrated", ...EXPR_MAP.frustrated }
  if (browDn>0.38&&smile<0.12) return { type:"confused",   ...EXPR_MAP.confused }
  if (frown>0.35)               return { type:"sad",        ...EXPR_MAP.sad }
  return                               { type:"neutral",    ...EXPR_MAP.neutral }
}

export default function StudyRoom() {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const faceRef     = useRef<any>(null)
  const phoneDetRef = useRef<any>(null)
  const animRef     = useRef<number>(0)
  const timerRef    = useRef<NodeJS.Timeout|null>(null)
  const alertTime   = useRef(0)
  const smoothed    = useRef(100)
  const bgModeRef   = useRef(false)
  const frameCount  = useRef(0)
  const absentFrames= useRef(0)
  const lookAwayFrames=useRef(0)
  const drowsyFrames= useRef(0)
  const blinkFrames = useRef(0)
  const phoneBox    = useRef<any>(null)
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [showAI,      setShowAI]      = useState(false)
  const [aiMessages,  setAiMessages]  = useState<{role:string;content:string}[]>([])
  const [aiInput,     setAiInput]     = useState("")
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiStreaming, setAiStreaming]  = useState(false)
  const [weekDone,    setWeekDone]    = useState(false)
  const aiEndRef = useRef<HTMLDivElement>(null)

  const [phase,           setPhase]           = useState<Phase>("idle")
  const [loadMsg,         setLoadMsg]         = useState("")
  const [score,           setScore]           = useState(100)
  const [expr,            setExpr]            = useState(EXPR_MAP.neutral)
  const [phoneOn,         setPhoneOn]         = useState(false)
  const [alertMsg,        setAlertMsg]        = useState("")
  const [totalSecs,       setTotalSecs]       = useState(0)
  const [distCount,       setDistCount]       = useState(0)
  const [eyeState,        setEyeState]        = useState({left:1,right:1})
  const [history,         setHistory]         = useState<number[]>(Array(60).fill(100))
  const [techKey,         setTechKey]         = useState<TechKey>("pomodoro")
  const [timerSecs,       setTimerSecs]       = useState(TECHNIQUES.pomodoro.work*60)
  const [timerPhase,      setTimerPhase]      = useState<"work"|"break"|"longbreak">("work")
  const [cycle,           setCycle]           = useState(1)
  const [completedCycles, setCompletedCycles] = useState(0)
  const [roadmapWeeks,    setRoadmapWeeks]    = useState<any[]>([])
  const [selectedWeek,    setSelectedWeek]    = useState(1)
  const [selectedTask,    setSelectedTask]    = useState<number|null>(null)
  const [goalType,        setGoalType]        = useState("")
  const [weekProgress,    setWeekProgress]    = useState<any[]>([])
  const [showReport,      setShowReport]      = useState(false)
  const [reportData,      setReportData]      = useState<any>(null)
  const [bgMode,          setBgMode]          = useState(false)

  const tech  = TECHNIQUES[techKey]

  useEffect(() => {
    // Read URL params from dashboard → session link
    const wp = searchParams.get("week")
    const tp = searchParams.get("task")
    const load = async () => {
      const user = await getUser()
      if (!user) { window.location.href="/dashboard"; return }
      const [roadmapData, weekData, progressData] = await Promise.all([
        getRoadmap(user.id), getCurrentWeek(user.id), getProgress(user.id)
      ])
      if (roadmapData) {
        let rm=roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try { const p=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()); if(p.weeks?.length>0) rm=p } catch {}
        }
        setRoadmapWeeks(rm?.weeks||[])
        setGoalType(roadmapData.goal_type||"")
        // Use URL param if provided, else default to current week
        setSelectedWeek(wp ? Number(wp) : weekData)
        if (tp !== null) setSelectedTask(Number(tp))
      }
      setWeekProgress(progressData)
    }
    load()
  }, [])

  useEffect(() => { bgModeRef.current=bgMode }, [bgMode])

  const notify = useCallback((msg:string) => {
    if (typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted")
      new Notification("StudyBuddy 🎯",{body:msg,icon:"/favicon.ico",tag:"studybuddy"})
  }, [])

  const enableBgMode = async () => {
    const perm=await Notification.requestPermission()
    if (perm!=="granted") { alert("Please allow notifications!"); return }
    try { if (videoRef.current&&document.pictureInPictureEnabled) { await videoRef.current.requestPictureInPicture(); videoRef.current.addEventListener("leavepictureinpicture",()=>{setBgMode(false);bgModeRef.current=false},{once:true}) } } catch {}
    setBgMode(true); bgModeRef.current=true
    new Notification("StudyBuddy 🎯",{body:"Background mode ON 👀",icon:"/favicon.ico"})
  }

  const disableBgMode = async () => {
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); bgModeRef.current=false
  }

  const loadModels = useCallback(async () => {
    const {FaceLandmarker,ObjectDetector,FilesetResolver}=await import("@mediapipe/tasks-vision")
    setLoadMsg("Setting up AI vision...")
    const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm")
    setLoadMsg("Loading face mesh model...")
    faceRef.current=await FaceLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",delegate:"CPU"},
      outputFaceBlendshapes:true, runningMode:"VIDEO", numFaces:1,
      minFaceDetectionConfidence:0.4, minFacePresenceConfidence:0.4, minTrackingConfidence:0.4
    })
    setLoadMsg("Loading phone detector...")
    phoneDetRef.current=await ObjectDetector.createFromOptions(vision,{
      baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",delegate:"CPU"},
      scoreThreshold:0.4, runningMode:"VIDEO"
    })
  }, [])

  const startSession = async () => {
    setPhase("loading")
    try {
      await loadModels()
      setLoadMsg("Starting camera...")
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"}})
      if (videoRef.current) { videoRef.current.srcObject=stream; await videoRef.current.play() }
      setPhase("work"); setTimerPhase("work"); setTimerSecs(tech.work*60)
      setTotalSecs(0); setDistCount(0); setCycle(1); setCompletedCycles(0)
      smoothed.current=100; frameCount.current=0; phoneBox.current=null
      absentFrames.current=0; lookAwayFrames.current=0; drowsyFrames.current=0; blinkFrames.current=0
      setHistory(Array(60).fill(100))
      timerRef.current=setInterval(()=>{ setTotalSecs(s=>s+1); setHistory(h=>[...h.slice(1),Math.round(smoothed.current)]) },1000)
    } catch { setPhase("idle"); alert("Camera access denied.") }
  }

  useEffect(() => {
    if (phase==="idle"||phase==="loading") return
    const interval=setInterval(()=>{
      setTimerSecs(s=>{
        if (s<=1) {
          if (timerPhase==="work") {
            const nc=cycle+1; setCycle(nc); setCompletedCycles(c=>c+1)
            if (nc>tech.cycles) { setCycle(1); setTimerPhase("longbreak"); setPhase("longbreak"); if(bgModeRef.current) notify("🌿 Long break!"); return tech.longBreak*60 }
            setTimerPhase("break"); setPhase("break"); if(bgModeRef.current) notify("☕ Break time!"); return tech.shortBreak*60
          }
          setTimerPhase("work"); setPhase("work"); if(bgModeRef.current) notify("🎯 Focus time!"); return tech.work*60
        }
        return s-1
      })
    },1000)
    return ()=>clearInterval(interval)
  },[phase,timerPhase,cycle,tech,notify])

  const stopCamera = () => {
    if (faceRef.current) { try{faceRef.current.close()}catch{} faceRef.current=null }
    if (phoneDetRef.current) { try{phoneDetRef.current.close()}catch{} phoneDetRef.current=null }
    if (videoRef.current) {
      videoRef.current.pause()
      if (videoRef.current.srcObject) { ;(videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); videoRef.current.srcObject=null; videoRef.current.src=""; videoRef.current.load() }
    }
    const ctx=canvasRef.current?.getContext("2d")
    if (ctx&&canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
  }

  const endSession = async () => {
    cancelAnimationFrame(animRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); bgModeRef.current=false; stopCamera()
    const avgScore=Math.round(history.filter(h=>h>0).reduce((a,b)=>a+b,0)/Math.max(1,history.filter(h=>h>0).length))
    const report={duration:Math.round(totalSecs/60),focusScore:avgScore,distractions:distCount,technique:tech.name,cycles:completedCycles}
    setReportData(report); setShowReport(true)
    try {
      const user=await getUser()
      if (user) {
        await saveSession({user_id:user.id,duration_minutes:report.duration,focus_score:avgScore,distractions:distCount,avg_expression:"neutral",subject:goalType})
        if (selectedTask!==null&&totalSecs>=300) {
          await toggleTask(user.id,selectedWeek,selectedTask,true)
          // Check if this completes the whole week
          const weekTasks = roadmapWeeks.find((w:any)=>(w.week||0)===selectedWeek)?.tasks||[]
          const updatedProgress = [...weekProgress, {week_number:selectedWeek,task_index:selectedTask,completed:true}]
          const allDone = weekTasks.length>0 && weekTasks.every((_:any,i:number)=>
            updatedProgress.some(p=>p.week_number===selectedWeek&&p.task_index===i&&p.completed)
          )
          if (allDone) {
            const existing = await getLastPassedAttempt(user.id, selectedWeek)
            if (!existing) setWeekDone(true)
          }
        }
      }
    } catch(e){console.error(e)}
  }

  const triggerAlert = useCallback((type:keyof typeof ALERTS)=>{
    const now=Date.now()
    if (now-alertTime.current>20000) {
      alertTime.current=now; setDistCount(d=>d+1)
      const msg=pick(type); setAlertMsg(msg)
      setTimeout(()=>setAlertMsg(""),5000)
      if (bgModeRef.current) notify(msg)
    }
  },[notify])

  useEffect(()=>{
    if (phase==="idle"||phase==="loading") return
    let lastTime=-1
    const detect=()=>{
      const video=videoRef.current,canvas=canvasRef.current,face=faceRef.current,phdet=phoneDetRef.current
      if (!video||!canvas||!face||video.readyState<2){animRef.current=requestAnimationFrame(detect);return}
      if (video.currentTime===lastTime){animRef.current=requestAnimationFrame(detect);return}
      lastTime=video.currentTime; frameCount.current++
      const now=performance.now()
      const ctx=canvas.getContext("2d")!
      const W=canvas.width=video.videoWidth||640, H=canvas.height=video.videoHeight||480
      ctx.clearRect(0,0,W,H)
      const mx=(x:number)=>W-x*W, my=(y:number)=>y*H

      // Phone detection
      if (phdet&&frameCount.current%25===0) {
        try {
          const res=phdet.detectForVideo(video,now)
          const found=res.detections?.some((d:any)=>d.categories?.some((c:any)=>c.categoryName==="cell phone"&&c.score>0.4))
          setPhoneOn(!!found)
          phoneBox.current=found?res.detections?.find((d:any)=>d.categories?.some((c:any)=>c.categoryName==="cell phone"))?.boundingBox||null:null
        } catch {}
      }

      // Draw phone box
      if (phoneBox.current) {
        const b=phoneBox.current, bx=W-(b.originX+b.width)
        ctx.strokeStyle="#ff453a"; ctx.lineWidth=2
        ctx.strokeRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="rgba(255,69,58,0.08)"; ctx.fillRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="#ff453a"; ctx.font="bold 12px -apple-system"
        ctx.fillText("📵 Phone",bx+6,b.originY+18)
      }

      // Face detection
      let faceRes:any
      try { faceRes=faceRef.current.detectForVideo(video,now) } catch { animRef.current=requestAnimationFrame(detect); return }

      const lm=faceRes.faceLandmarks?.[0]
      const bs=faceRes.faceBlendshapes?.[0]?.categories||[]

      if (!lm||lm.length===0) {
        absentFrames.current++
        if (absentFrames.current>15) {
          smoothed.current=Math.max(0,smoothed.current*0.92)
          setScore(Math.round(smoothed.current)); setEyeState({left:0,right:0})
          if (absentFrames.current>30) triggerAlert("absent")
        }
        animRef.current=requestAnimationFrame(detect); return
      }
      absentFrames.current=0

      const currentExpr=detectExpression(bs)
      setExpr({emoji:currentExpr.emoji,hint:currentExpr.hint})

      const leftEAR=calcEAR(lm,LEFT_EYE_TOP,LEFT_EYE_BOT,LEFT_EYE_INNER,LEFT_EYE_OUTER)
      const rightEAR=calcEAR(lm,RIGHT_EYE_TOP,RIGHT_EYE_BOT,RIGHT_EYE_INNER,RIGHT_EYE_OUTER)
      const avgEAR=(leftEAR+rightEAR)/2, eyesClosed=avgEAR<0.18
      setEyeState({left:Math.min(1,leftEAR/0.3),right:Math.min(1,rightEAR/0.3)})

      const {yaw,pitch}=calcHeadPose(lm)
      const lookingAway=Math.abs(yaw)>0.28||pitch<-0.22||pitch>0.55

      let raw=100
      if (phoneBox.current) { raw-=70; phoneBox.current&&triggerAlert("phone") }
      else if (eyesClosed) { blinkFrames.current++; if(blinkFrames.current>10){drowsyFrames.current++;raw-=40;if(drowsyFrames.current>30)triggerAlert("drowsy")} else{blinkFrames.current=0} }
      else { blinkFrames.current=0; drowsyFrames.current=0
        if (lookingAway) { lookAwayFrames.current++; if(lookAwayFrames.current>25){raw-=35;if(lookAwayFrames.current>50)triggerAlert("distracted")} else raw-=5 }
        else { lookAwayFrames.current=0; setAlertMsg("") }
        if (currentExpr.type==="yawning") raw-=20
      }
      raw=Math.max(0,Math.min(100,raw))
      smoothed.current=smoothed.current*0.88+raw*0.12
      setScore(Math.round(smoothed.current))

      // Draw overlays
      const sc=smoothed.current>=70?"#30d158":smoothed.current>=40?"#ff9f0a":"#ff453a"
      const drawContour=(indices:number[],color:string,lw=1.5,close=false)=>{
        const pts=indices.map(i=>lm[i]).filter(Boolean); if(pts.length<2) return
        ctx.beginPath(); ctx.moveTo(mx(pts[0].x),my(pts[0].y))
        pts.slice(1).forEach(p=>ctx.lineTo(mx(p.x),my(p.y)))
        if(close) ctx.closePath(); ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.stroke()
      }
      const OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
      drawContour(OVAL,sc+"44",1.5,true)
      const lEyeC=leftEAR>0.18?"#30d158aa":"#ff453aaa", rEyeC=rightEAR>0.18?"#30d158aa":"#ff453aaa"
      drawContour([33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],lEyeC,1.5,true)
      drawContour([362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382],rEyeC,1.5,true)
      const browC=bs.find((b:any)=>b.categoryName==="browDownLeft")?.score>0.35?"#ff453aBB":"rgba(255,255,255,0.3)"
      drawContour([70,63,105,66,107,55,65,52,53,46],browC,1.5)
      drawContour([300,293,334,296,336,285,295,282,283,276],browC,1.5)
      const lipC=currentExpr.type==="happy"?"#30d158BB":currentExpr.type==="frustrated"?"#ff453aBB":"rgba(255,255,255,0.25)"
      drawContour([61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146],lipC,1.5,true)
      ;[468,473].forEach(i=>{
        if(!lm[i]) return
        ctx.beginPath(); ctx.arc(mx(lm[i].x),my(lm[i].y),7,0,Math.PI*2)
        ctx.fillStyle=sc+"CC"; ctx.fill(); ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke()
      })
      // Score label
      ctx.fillStyle=sc; ctx.font="bold 13px -apple-system"
      const nosePt=lm[1]
      if (nosePt) ctx.fillText(`${currentExpr.emoji} ${currentExpr.type}`,mx(nosePt.x)-30,my(lm[10]?.y||0)-20)

      animRef.current=requestAnimationFrame(detect)
    }
    animRef.current=requestAnimationFrame(detect)
    return ()=>cancelAnimationFrame(animRef.current)
  },[phase,triggerAlert])

  const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`
  const sc=(s:number)=>s>=70?"#30d158":s>=40?"#ff9f0a":"#ff453a"
  const timerTotal=timerPhase==="work"?tech.work*60:timerPhase==="break"?tech.shortBreak*60:tech.longBreak*60
  const timerPct=((timerTotal-timerSecs)/timerTotal)*100
  const isRunning=phase==="work"||phase==="break"||phase==="longbreak"
  const currentWeekTasks=roadmapWeeks.find((w:any)=>(w.week||0)===selectedWeek)?.tasks||[]
  const isTaskDone=(i:number)=>weekProgress.some(p=>p.week_number===selectedWeek&&p.task_index===i&&p.completed)

  // ── Report screen ──────────────────────────────────────────────
  if (showReport&&reportData) {
    const fc=sc(reportData.focusScore)
    return (
      <div style={{minHeight:"100vh",background:"var(--bg-base)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{maxWidth:"400px",width:"100%",textAlign:"center",animation:"fadeInScale 0.4s ease"}}>
          {/* Score ring */}
          <div style={{position:"relative",width:"140px",height:"140px",margin:"0 auto 1.5rem"}}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="58" fill="none" stroke={`${fc}22`} strokeWidth="10"/>
              <circle cx="70" cy="70" r="58" fill="none" stroke={fc} strokeWidth="10"
                strokeDasharray={`${(reportData.focusScore/100)*364} 364`}
                strokeLinecap="round" transform="rotate(-90 70 70)"
                style={{transition:"stroke-dasharray 1.5s ease"}}
              />
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:"2.5rem",fontWeight:"800",color:fc,lineHeight:1}}>{reportData.focusScore}</span>
              <span style={{fontSize:"0.7rem",color:"var(--text-muted)"}}>Focus Score</span>
            </div>
          </div>

          <h1 style={{fontSize:"1.5rem",fontWeight:"700",marginBottom:"4px"}}>Session Complete!</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginBottom:"1.8rem"}}>
            {tech.emoji} {reportData.technique} · {reportData.cycles} cycles · {reportData.duration}min
          </p>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"1.5rem"}}>
            {[
              {label:"Distractions",value:String(reportData.distractions),color:"#ff453a"},
              {label:"Time Studied",value:`${reportData.duration}m`,color:"var(--accent)"},
            ].map(s=>(
              <div key={s.label} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.2rem"}}>
                <p style={{fontSize:"1.8rem",fontWeight:"800",color:s.color,margin:0,lineHeight:1}}>{s.value}</p>
                <p style={{fontSize:"0.72rem",color:"var(--text-muted)",margin:"4px 0 0"}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Focus chart */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1rem",marginBottom:"1.2rem"}}>
            <p style={{fontSize:"0.72rem",color:"var(--text-muted)",marginBottom:"8px",textAlign:"left"}}>Focus trend</p>
            <svg viewBox="0 0 300 50" style={{width:"100%",height:"50px"}}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fc} stopOpacity="0.3"/>
                  <stop offset="100%" stopColor={fc} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polygon points={`0,50 ${history.map((v,i)=>`${(i/59)*300},${50-(v/100)*50}`).join(" ")} 300,50`} fill="url(#rg)"/>
              <polyline points={history.map((v,i)=>`${(i/59)*300},${50-(v/100)*50}`).join(" ")} fill="none" stroke={fc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>

          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1rem",marginBottom:"1.5rem",textAlign:"left"}}>
            <p style={{fontSize:"0.85rem",color:"var(--text-secondary)",margin:0,lineHeight:1.7}}>
              {reportData.focusScore>=80?"🏆 Outstanding! Your focus was exceptional. Keep it up!":
               reportData.focusScore>=60?"👍 Good session! A few distractions but solid overall.":
               "💪 Tough session but you showed up! Try a shorter technique next time."}
            </p>
          </div>

          {/* Week complete — quiz prompt */}
          {weekDone && (
            <div style={{background:"linear-gradient(135deg,rgba(48,209,88,0.12),rgba(10,132,255,0.08))",border:"1px solid rgba(48,209,88,0.3)",borderRadius:"var(--radius-xl)",padding:"1.2rem",marginBottom:"1rem",textAlign:"center",animation:"fadeIn 0.5s ease"}}>
              <p style={{fontSize:"1.5rem",margin:"0 0 6px"}}>🎉</p>
              <p style={{fontWeight:"700",color:"#30d158",margin:"0 0 4px"}}>Week {selectedWeek} Complete!</p>
              <p style={{fontSize:"0.8rem",color:"var(--text-muted)",margin:"0 0 14px"}}>All tasks done! Take the quiz to unlock Week {selectedWeek+1}</p>
              <button onClick={()=>router.push("/roadmap")} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#30d158,#0a84ff)",border:"none",borderRadius:"var(--radius-lg)",color:"white",fontWeight:"700",cursor:"pointer",fontSize:"0.9rem"}}>
                Take Week Quiz 🧠
              </button>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <button onClick={()=>{ setShowReport(false); setPhase("idle"); setTimerSecs(tech.work*60); setTotalSecs(0); setDistCount(0); setWeekDone(false) }}
              style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,var(--accent),#30d158)",border:"none",borderRadius:"var(--radius-xl)",color:"white",fontWeight:"700",cursor:"pointer",fontSize:"0.95rem",boxShadow:"0 8px 24px rgba(10,132,255,0.3)"}}>
              New Session 🔄
            </button>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>router.push("/dashboard")} style={{flex:1,padding:"12px",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",color:"var(--text-secondary)",fontWeight:"600",cursor:"pointer",fontSize:"0.88rem"}}>
                Dashboard 🏠
              </button>
              <button onClick={()=>router.push("/calendar")} style={{flex:1,padding:"12px",background:"rgba(255,159,10,0.1)",border:"1px solid rgba(255,159,10,0.25)",borderRadius:"var(--radius-xl)",color:"#ff9f0a",fontWeight:"600",cursor:"pointer",fontSize:"0.88rem"}}>
                Check-in 📋
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading || aiStreaming) return
    const userMsg = { role:"user", content:aiInput }
    const history = [...aiMessages, userMsg]
    setAiMessages(history)
    setAiInput("")
    setAiLoading(true)
    const taskName = currentWeekTasks[selectedTask??0]?.name || "their studies"
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          messages:history,
          system:`You are StudyBuddy AI Tutor. The student is in a study session right now working on: "${taskName}". Be concise, helpful and encouraging. Keep answers brief (3-5 sentences max) since they're in the middle of studying.`
        })
      })
      if (!res.ok||!res.body) throw new Error("fail")
      const reader=res.body.getReader(), decoder=new TextDecoder()
      let acc="", started=false
      setAiLoading(false); setAiStreaming(true)
      while(true){
        const {done,value}=await reader.read()
        if(done) break
        acc+=decoder.decode(value,{stream:true})
        if(!started){started=true;setAiMessages([...history,{role:"assistant",content:acc}])}
        else setAiMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:acc}])
        if(aiEndRef.current) aiEndRef.current.scrollIntoView({behavior:"smooth"})
      }
      setAiStreaming(false)
    } catch {
      setAiLoading(false); setAiStreaming(false)
      setAiMessages(prev=>[...prev,{role:"assistant",content:"Sorry, something went wrong. Please try again!"}])
    }
  }


  return (
    <div style={{minHeight:"100vh",padding:"1.5rem",maxWidth:"500px",margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1.5rem"}}>
        <Link href="/dashboard" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</Link>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.2rem",fontWeight:"700",margin:0}}>Study Room</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.7rem",margin:0}}>MediaPipe AI · Smart focus tracking</p>
        </div>
        {isRunning && (
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={bgMode?disableBgMode:enableBgMode} style={{background:bgMode?"rgba(10,132,255,0.15)":"var(--bg-elevated)",border:`1px solid ${bgMode?"rgba(10,132,255,0.3)":"var(--border)"}`,borderRadius:"var(--radius-md)",color:bgMode?"var(--accent)":"var(--text-muted)",padding:"6px 12px",fontSize:"0.72rem",cursor:"pointer",fontWeight:"600"}}>
              {bgMode?"● BG":"🔲 BG"}
            </button>
            <div style={{background:timerPhase==="work"?`${tech.color}15`:"rgba(48,209,88,0.12)",border:`1px solid ${timerPhase==="work"?tech.color+"33":"rgba(48,209,88,0.3)"}`,borderRadius:"var(--radius-md)",padding:"5px 10px"}}>
              <p style={{fontSize:"0.72rem",fontWeight:"700",color:timerPhase==="work"?tech.color:"#30d158",margin:0}}>{timerPhase==="work"?"🎯 Focus":"☕ Break"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Alert */}
      {alertMsg&&(
        <div style={{background:phoneOn?"rgba(255,69,58,0.1)":"rgba(255,159,10,0.1)",border:`1px solid ${phoneOn?"rgba(255,69,58,0.3)":"rgba(255,159,10,0.3)"}`,borderRadius:"var(--radius-xl)",padding:"12px 16px",marginBottom:"1rem",fontWeight:"600",textAlign:"center",fontSize:"0.88rem",color:phoneOn?"#ff453a":"#ff9f0a",animation:"slideDown 0.3s ease"}}>
          {alertMsg}
        </div>
      )}

      {/* Technique picker */}
      {phase==="idle"&&(
        <div style={{marginBottom:"1.2rem"}}>
          <p style={{fontSize:"0.7rem",color:"var(--text-muted)",marginBottom:"10px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.8px"}}>Choose Technique</p>
          <div style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px"}}>
            {(Object.entries(TECHNIQUES) as [TechKey,typeof TECHNIQUES[TechKey]][]).map(([key,t])=>(
              <button key={key} onClick={()=>{setTechKey(key);setTimerSecs(t.work*60)}} style={{
                background:techKey===key?`${t.color}15`:"var(--bg-card)",
                border:`1px solid ${techKey===key?t.color+"44":"var(--border)"}`,
                borderRadius:"var(--radius-xl)",color:"var(--text-primary)",
                padding:"10px 14px",cursor:"pointer",flexShrink:0,transition:"all 0.2s",
                boxShadow:techKey===key?`0 4px 16px ${t.color}22`:undefined
              }}>
                <div style={{fontSize:"1.2rem",marginBottom:"4px"}}>{t.emoji}</div>
                <div style={{fontSize:"0.72rem",fontWeight:"600",color:techKey===key?t.color:"var(--text-secondary)"}}>{t.name}</div>
                <div style={{fontSize:"0.6rem",color:"var(--text-muted)",marginTop:"2px"}}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Camera */}
      <div style={{
        position:"relative",borderRadius:"var(--radius-2xl)",overflow:"hidden",
        background:"var(--bg-card)",aspectRatio:"4/3",
        border:`2px solid ${isRunning?(phoneOn?"#ff453a":timerPhase==="work"?sc(score):"#30d158"):"var(--border)"}`,
        marginBottom:"1.2rem",display:"flex",alignItems:"center",justifyContent:"center",
        transition:"border-color 0.5s",
        boxShadow:isRunning?`0 0 30px ${sc(score)}22`:undefined
      }}>
        {/* Three.js focus particle system — sits behind video and face canvas */}
        <FocusParticles score={score} distracted={!!alertMsg} isRunning={isRunning}/>
        <video ref={videoRef} muted playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",display:isRunning?"block":"none",zIndex:1}}/>
        <canvas ref={canvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",display:isRunning?"block":"none",zIndex:2}}/>

        {!isRunning&&(
          <div style={{textAlign:"center",color:"var(--text-muted)"}}>
            <div style={{fontSize:"2.5rem",marginBottom:"10px",opacity:0.5}}>📷</div>
            <p style={{fontSize:"0.85rem",margin:0,fontWeight:"500"}}>{phase==="loading"?loadMsg:"Camera starts with session"}</p>
            {phase==="loading"&&<p style={{fontSize:"0.72rem",color:"var(--text-muted)",marginTop:"4px",animation:"pulse 1s infinite"}}>{loadMsg}</p>}
          </div>
        )}

        {isRunning&&(
          <>
            <div style={{position:"absolute",top:12,left:12,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",borderRadius:"var(--radius-md)",padding:"4px 10px",fontSize:"0.72rem",color:sc(score),fontWeight:"700"}}>
              ● {timerPhase==="work"?"FOCUS":"BREAK"}
            </div>
            {phoneOn&&<div style={{position:"absolute",top:12,right:12,background:"rgba(255,69,58,0.85)",borderRadius:"var(--radius-md)",padding:"4px 10px",fontSize:"0.72rem",fontWeight:"700"}}>📵 PHONE</div>}
            <div style={{position:"absolute",bottom:12,left:12,display:"flex",gap:"6px"}}>
              {[{l:"L",v:eyeState.left},{l:"R",v:eyeState.right}].map(e=>(
                <div key={e.l} style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",borderRadius:"var(--radius-sm)",padding:"3px 8px",fontSize:"0.68rem",color:e.v>0.4?"#30d158":"#ff453a",fontWeight:"600"}}>
                  {e.l} {e.v>0.4?"👁":"—"}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"1.2rem"}}>
        {/* Focus score ring */}
        <div style={{background:`${sc(score)}0d`,border:`1px solid ${sc(score)}22`,borderRadius:"var(--radius-xl)",padding:"12px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
          <div style={{fontSize:"1.5rem"}}>{expr.emoji}</div>
          <div style={{fontSize:"1.5rem",fontWeight:"800",color:sc(score),lineHeight:1}}>{isRunning?score:"--"}</div>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)"}}>Focus</div>
        </div>

        {/* Timer */}
        <div style={{background:`${tech.color}0d`,border:`1px solid ${tech.color}22`,borderRadius:"var(--radius-xl)",padding:"12px 8px",textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",bottom:0,left:0,height:`${timerPct}%`,width:"100%",background:`${tech.color}0a`,transition:"height 1s",pointerEvents:"none"}}/>
          <div style={{fontSize:"0.6rem",color:tech.color,fontWeight:"700",marginBottom:"2px",textTransform:"uppercase",letterSpacing:"0.5px",position:"relative"}}>{timerPhase==="work"?"Work":timerPhase==="break"?"Break":"Long Break"}</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",color:tech.color,letterSpacing:"1px",position:"relative"}}>{fmt(timerSecs)}</div>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)",position:"relative"}}>Cycle {cycle}/{tech.cycles}</div>
        </div>

        {/* Session time */}
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"12px 8px",textAlign:"center"}}>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)",marginBottom:"2px"}}>Session</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",letterSpacing:"1px"}}>{fmt(totalSecs)}</div>
          <div style={{fontSize:"0.6rem",color:"#ff453a"}}>{distCount} distr.</div>
        </div>
      </div>

      {/* Expression hint */}
      {isRunning&&expr.hint&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"10px 14px",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"10px",animation:"fadeIn 0.3s ease"}}>
          <span style={{fontSize:"1.2rem"}}>{expr.emoji}</span>
          <p style={{fontSize:"0.8rem",color:"var(--text-secondary)",margin:0,flex:1}}>{expr.hint}</p>
          {expr.emoji==="🤔"&&<Link href="/chat" style={{background:"var(--accent)",borderRadius:"var(--radius-sm)",padding:"5px 12px",fontSize:"0.72rem",color:"white",textDecoration:"none",fontWeight:"600",flexShrink:0}}>Ask AI</Link>}
        </div>
      )}

      {/* Cycle dots */}
      {isRunning&&(
        <div style={{display:"flex",justifyContent:"center",gap:"8px",marginBottom:"1.2rem"}}>
          {Array.from({length:tech.cycles}).map((_,i)=>(
            <div key={i} style={{width:"8px",height:"8px",borderRadius:"50%",background:i<completedCycles?tech.color:"var(--bg-elevated)",border:`2px solid ${i===cycle-1&&timerPhase==="work"?tech.color:"transparent"}`,boxShadow:i===cycle-1&&timerPhase==="work"?`0 0 8px ${tech.color}`:undefined,transition:"all 0.3s"}}/>
          ))}
        </div>
      )}

      {/* Live chart */}
      {isRunning&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"12px",marginBottom:"1.2rem"}}>
          <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:"0 0 8px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px"}}>Live Focus</p>
          <svg viewBox="0 0 300 40" style={{width:"100%",height:"40px"}}>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sc(score)} stopOpacity="0.3"/>
                <stop offset="100%" stopColor={sc(score)} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <polygon points={`0,40 ${history.map((v,i)=>`${(i/59)*300},${40-(v/100)*40}`).join(" ")} 300,40`} fill="url(#lg)"/>
            <polyline points={history.map((v,i)=>`${(i/59)*300},${40-(v/100)*40}`).join(" ")} fill="none" stroke={sc(score)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Task picker */}
      {phase==="idle"&&roadmapWeeks.length>0&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",padding:"1.2rem",marginBottom:"1.2rem"}}>
          <p style={{fontSize:"0.7rem",color:"var(--text-muted)",marginBottom:"10px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.8px"}}>What are you studying?</p>
          <select value={selectedWeek} onChange={e=>{setSelectedWeek(Number(e.target.value));setSelectedTask(null)}} style={{width:"100%",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-primary)",padding:"10px 12px",fontSize:"0.85rem",outline:"none",marginBottom:"10px",colorScheme:"dark" as any}}>
            {roadmapWeeks.map((w:any,i:number)=>(
              <option key={i} value={w.week||i+1}>Week {w.week||i+1} — {(w.focus||"").substring(0,40)}...</option>
            ))}
          </select>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {currentWeekTasks.map((task:string,i:number)=>{
              const done=isTaskDone(i)
              return (
                <div key={i} onClick={()=>setSelectedTask(selectedTask===i?null:i)} style={{display:"flex",gap:"10px",alignItems:"center",padding:"10px 12px",borderRadius:"var(--radius-lg)",cursor:"pointer",background:selectedTask===i?"rgba(10,132,255,0.1)":done?"rgba(48,209,88,0.06)":"var(--bg-elevated)",border:`1px solid ${selectedTask===i?"rgba(10,132,255,0.3)":done?"rgba(48,209,88,0.2)":"var(--border)"}`,transition:"all 0.2s"}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"50%",flexShrink:0,background:done?"#30d158":selectedTask===i?"var(--accent)":"transparent",border:`2px solid ${done?"#30d158":selectedTask===i?"var(--accent)":"var(--text-subtle)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"white",fontWeight:"700"}}>
                    {done?"✓":selectedTask===i?"✓":""}
                  </div>
                  <p style={{fontSize:"0.82rem",margin:0,color:done?"var(--text-muted)":selectedTask===i?"white":"var(--text-secondary)",textDecoration:done?"line-through":"none"}}>{task}</p>
                </div>
              )
            })}
          </div>
          {selectedTask!==null&&<p style={{fontSize:"0.68rem",color:"#30d158",marginTop:"8px",margin:"8px 0 0"}}>✅ Auto-marked done after 5+ min session</p>}
        </div>
      )}

      {/* Active task */}
      {isRunning&&selectedTask!==null&&currentWeekTasks[selectedTask]&&(
        <div style={{background:"var(--bg-card)",border:`1px solid ${tech.color}22`,borderRadius:"var(--radius-xl)",padding:"10px 14px",marginBottom:"1.2rem"}}>
          <p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0,fontWeight:"500"}}>STUDYING</p>
          <p style={{fontSize:"0.88rem",color:"white",fontWeight:"500",margin:0}}>{currentWeekTasks[selectedTask]}</p>
        </div>
      )}

      {/* Buttons */}
      {phase==="idle"&&(
        <button onClick={startSession} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg,${tech.color},${tech.color}88)`,border:"none",borderRadius:"var(--radius-2xl)",color:"white",fontSize:"1rem",fontWeight:"700",cursor:"pointer",boxShadow:`0 8px 24px ${tech.color}44`,letterSpacing:"0.3px"}}>
          {tech.emoji} Start {tech.name} Session
        </button>
      )}

      {phase==="loading"&&(
        <div style={{textAlign:"center",padding:"16px",color:"var(--text-muted)",fontSize:"0.85rem",animation:"pulse 1s infinite"}}>{loadMsg}</div>
      )}

      {isRunning&&(
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>{if(timerPhase==="work"){setTimerPhase("break");setPhase("break");setTimerSecs(tech.shortBreak*60)}else{setTimerPhase("work");setPhase("work");setTimerSecs(tech.work*60)}}} style={{flex:1,padding:"14px",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-xl)",color:"var(--text-secondary)",cursor:"pointer",fontWeight:"600",fontSize:"0.88rem"}}>
            {timerPhase==="work"?"☕ Break":"🎯 Resume"}
          </button>
          <button onClick={endSession} style={{flex:1,padding:"14px",background:"#ff453a",border:"none",borderRadius:"var(--radius-xl)",color:"white",cursor:"pointer",fontWeight:"700",fontSize:"0.88rem",boxShadow:"0 4px 16px rgba(255,69,58,0.3)"}}>
            End ✓
          </button>
        </div>
      )}

      {/* Floating Ask AI button — visible when session is running */}
      {isRunning && (
        <button
          onClick={()=>{
            setShowAI(true)
            if (aiMessages.length===0) {
              const taskName = currentWeekTasks[selectedTask??0]?.name || "this topic"
              setAiMessages([{role:"assistant",content:`Hey! I see you're studying **${taskName}**. What do you need help with? 🎯`}])
            }
          }}
          style={{position:"fixed",bottom:"90px",right:"20px",width:"52px",height:"52px",borderRadius:"50%",background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)",border:"none",color:"white",fontSize:"1.3rem",cursor:"pointer",zIndex:90,boxShadow:"0 4px 20px rgba(124,109,250,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}
          aria-label="Ask AI tutor"
        >💬</button>
      )}

      {/* AI Tutor slide-up panel */}
      {showAI && (
        <div style={{position:"fixed",inset:0,zIndex:150,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)setShowAI(false)}}>
          <div style={{background:"var(--bg-surface)",borderRadius:"var(--radius-2xl) var(--radius-2xl) 0 0",border:"1px solid var(--border)",borderBottom:"none",maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp 0.3s ease"}}>
            {/* Handle + header */}
            <div style={{padding:"12px 20px 0",textAlign:"center",flexShrink:0}}>
              <div style={{width:"36px",height:"4px",borderRadius:"2px",background:"var(--border)",margin:"0 auto 12px"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem"}}>🤖</div>
                  <div>
                    <p style={{fontWeight:"700",fontSize:"0.88rem",margin:0}}>AI Tutor</p>
                    <p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0}}>Ask anything about your current topic</p>
                  </div>
                </div>
                <button onClick={()=>setShowAI(false)} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",color:"var(--text-muted)",padding:"4px 10px",fontSize:"0.78rem",cursor:"pointer"}}>Done</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:"12px",minHeight:0}}>
              {aiMessages.map((msg,i)=>(
                <div key={i} style={{display:"flex",gap:"8px",flexDirection:msg.role==="user"?"row-reverse":"row"}}>
                  {msg.role==="assistant"&&<div style={{width:"24px",height:"24px",borderRadius:"50%",background:"linear-gradient(135deg,#7c6dfa,#3ecf8e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",flexShrink:0}}>🤖</div>}
                  <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:msg.role==="user"?"var(--accent)":"var(--bg-elevated)",border:msg.role==="assistant"?"1px solid var(--border)":"none",fontSize:"0.85rem",lineHeight:1.6,color:msg.role==="user"?"white":"var(--text-primary)"}}>
                    {msg.content}
                    {aiStreaming && i===aiMessages.length-1 && msg.role==="assistant" && <span style={{borderRight:"2px solid var(--accent)",marginLeft:"2px",animation:"blink 0.7s step-end infinite"}}>&nbsp;</span>}
                  </div>
                </div>
              ))}
              {aiLoading&&<div style={{display:"flex",gap:"4px",padding:"8px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:"var(--text-muted)",animation:`bounce 1s ${i*0.15}s ease-in-out infinite`}}/>)}</div>}
              <div ref={aiEndRef}/>
            </div>

            {/* Input */}
            <div style={{padding:"12px 16px 24px",borderTop:"1px solid var(--border)",display:"flex",gap:"10px",flexShrink:0}}>
              <input
                value={aiInput}
                onChange={e=>setAiInput(e.target.value)}
                onKeyDown={async e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();await sendAI()}}}
                placeholder="Ask about your current topic..."
                style={{flex:1,background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"10px 14px",color:"var(--text-primary)",fontSize:"0.88rem",outline:"none",fontFamily:"inherit"}}
              />
              <button onClick={sendAI} disabled={aiLoading||aiStreaming||!aiInput.trim()} style={{padding:"10px 16px",background:aiLoading||aiStreaming||!aiInput.trim()?"var(--bg-elevated)":"var(--accent)",border:"none",borderRadius:"var(--radius-lg)",color:aiLoading||aiStreaming||!aiInput.trim()?"var(--text-muted)":"white",fontWeight:"700",cursor:aiLoading||aiStreaming||!aiInput.trim()?"not-allowed":"pointer",fontSize:"0.88rem",flexShrink:0}}>
                {aiLoading||aiStreaming?"...":"Send →"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
