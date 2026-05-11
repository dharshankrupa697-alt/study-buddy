"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { saveSession, getUser, getRoadmap, getCurrentWeek, getProgress, toggleTask } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const TECHNIQUES = {
  pomodoro:  { name:"Pomodoro",   emoji:"🍅", color:"#D85A30", work:25, shortBreak:5,  longBreak:15, cycles:4 },
  deepwork:  { name:"Deep Work",  emoji:"🧠", color:"#534AB7", work:90, shortBreak:20, longBreak:30, cycles:2 },
  timeboxing:{ name:"Timeboxing", emoji:"📦", color:"#BA7517", work:45, shortBreak:10, longBreak:20, cycles:3 },
  spaced:    { name:"Spaced Rep", emoji:"🔁", color:"#1D9E75", work:20, shortBreak:10, longBreak:20, cycles:3 },
  feynman:   { name:"Feynman",    emoji:"✍️", color:"#9B4DBF", work:30, shortBreak:10, longBreak:15, cycles:3 },
}

type TechKey         = keyof typeof TECHNIQUES
type Phase           = "idle"|"loading"|"work"|"break"|"longbreak"
type DistractionType = "focused"|"looking_away"|"drowsy"|"absent"|"phone"|"idle"
type ExprType        = "neutral"|"happy"|"confused"|"frustrated"|"surprised"|"sad"|"yawning"
interface Expr       { type:ExprType; emoji:string; label:string; color:string; hint:string }

const EYE_L  = [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7]
const EYE_R  = [362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382]
const BROW_L = [70,63,105,66,107,55,65,52,53,46]
const BROW_R = [300,293,334,296,336,285,295,282,283,276]
const LIPS   = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]
const OVAL   = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]

const EMA_ALPHA   = 0.12
const ALERT_CD    = 8000
const HISTORY_LEN = 60
const PHONE_EVERY = 20

function detectExpression(bs: any[]): Expr {
  const g  = (n:string) => bs.find((b:any) => b.categoryName===n)?.score ?? 0
  const smile  = (g("mouthSmileLeft")+g("mouthSmileRight"))/2
  const browDn = (g("browDownLeft")+g("browDownRight"))/2
  const frown  = (g("mouthFrownLeft")+g("mouthFrownRight"))/2
  const cheek  = (g("cheekSquintLeft")+g("cheekSquintRight"))/2
  const wide   = (g("eyeWideLeft")+g("eyeWideRight"))/2
  const browUp = g("browInnerUp")
  const jaw    = g("jawOpen")
  if (jaw>0.55)                return {type:"yawning",    emoji:"🥱",label:"Yawning",    color:"#BA7517",hint:"Tired? Take a 5-min walk!"}
  if (smile>0.45&&cheek>0.15) return {type:"happy",      emoji:"😄",label:"Happy",      color:"#1D9E75",hint:"Great energy! You are in the zone 🎯"}
  if (browUp>0.55&&wide>0.25) return {type:"surprised",  emoji:"😮",label:"Surprised",  color:"#534AB7",hint:"Interesting! Jot that down 📝"}
  if (browDn>0.45&&frown>0.28)return {type:"frustrated", emoji:"😤",label:"Frustrated", color:"#D85A30",hint:"Deep breath — hard = growth 💪"}
  if (browDn>0.42&&smile<0.15)return {type:"confused",   emoji:"🤔",label:"Confused",   color:"#BA7517",hint:"Ask the AI Tutor!"}
  if (frown>0.38)              return {type:"sad",        emoji:"😢",label:"Sad",        color:"#D85A30",hint:"You can do this 🌟"}
  return                              {type:"neutral",    emoji:"😐",label:"Focused",    color:"#666",   hint:""}
}

const ALERTS = {
  phone:      ["📵 Phone detected! Put it away!", "No phones during study time!"],
  distracted: ["You are distracted — focus! 🎯",  "Eyes back on screen 👀"],
  drowsy:     ["Getting drowsy — wake up! 😴",     "Splash some water 💧"],
  absent:     ["You left your desk 👻",             "Come back to your session!"],
}
const pick = (k:keyof typeof ALERTS) => {
  const l = ALERTS[k]; return l[Math.floor(Math.random()*l.length)]
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
  const frameCount  = useRef(0)
  const phoneBox    = useRef<any>(null)
  const bgModeRef   = useRef(false)
  const router      = useRouter()

  const [phase,           setPhase]           = useState<Phase>("idle")
  const [loadMsg,         setLoadMsg]         = useState("")
  const [score,           setScore]           = useState(100)
  const [distType,        setDistType]        = useState<DistractionType>("idle")
  const [expr,            setExpr]            = useState<Expr>({type:"neutral",emoji:"😐",label:"Focused",color:"#666",hint:""})
  const [phoneOn,         setPhoneOn]         = useState(false)
  const [alertMsg,        setAlertMsg]        = useState("")
  const [totalSecs,       setTotalSecs]       = useState(0)
  const [distCount,       setDistCount]       = useState(0)
  const [eyeState,        setEyeState]        = useState({left:1,right:1})
  const [history,         setHistory]         = useState<number[]>(Array(HISTORY_LEN).fill(100))
  const [exprHistory,     setExprHistory]     = useState<string[]>(Array(HISTORY_LEN).fill("😐"))
  const [techKey,         setTechKey]         = useState<TechKey>("pomodoro")
  const [timerSecs,       setTimerSecs]       = useState(TECHNIQUES.pomodoro.work*60)
  const [timerPhase,      setTimerPhase]      = useState<"work"|"break"|"longbreak">("work")
  const [cycle,           setCycle]           = useState(1)
  const [completedCycles, setCompletedCycles] = useState(0)
  const [roadmapWeeks,    setRoadmapWeeks]    = useState<any[]>([])
  const [selectedWeek,    setSelectedWeek]    = useState<number>(1)
  const [selectedTask,    setSelectedTask]    = useState<number|null>(null)
  const [goalType,        setGoalType]        = useState("")
  const [weekProgress,    setWeekProgress]    = useState<any[]>([])
  const [showReport,      setShowReport]      = useState(false)
  const [reportData,      setReportData]      = useState<any>(null)
  const [bgMode,          setBgMode]          = useState(false)
  const [pipActive,       setPipActive]       = useState(false)

  const tech  = TECHNIQUES[techKey]
  const color = tech.color

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) return
      const [roadmapData, weekData, progressData] = await Promise.all([
        getRoadmap(user.id),
        getCurrentWeek(user.id),
        getProgress(user.id),
      ])
      if (roadmapData) {
        let rm = roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try {
            let clean=rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
            const parsed=JSON.parse(clean)
            if (parsed.weeks?.length>0) rm=parsed
          } catch {}
        }
        setRoadmapWeeks(rm?.weeks||[])
        setGoalType(roadmapData.goal_type||"")
        setSelectedWeek(weekData)
      }
      setWeekProgress(progressData)
    }
    load()
  }, [])

  useEffect(() => { bgModeRef.current = bgMode }, [bgMode])

  const sendNotification = useCallback((msg:string) => {
    if (typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted") {
      new Notification("StudyBuddy 🎯", {body:msg, icon:"/favicon.ico", tag:"studybuddy"})
    }
  }, [])

  const enableBgMode = async () => {
    if (!("Notification" in window)) { alert("Notifications not supported"); return }
    const perm = await Notification.requestPermission()
    if (perm!=="granted") { alert("Please allow notifications!"); return }
    try {
      if (videoRef.current&&document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture()
        setPipActive(true)
        videoRef.current.addEventListener("leavepictureinpicture", ()=>{
          setPipActive(false); setBgMode(false); bgModeRef.current=false
        }, {once:true})
      }
    } catch {}
    setBgMode(true)
    bgModeRef.current=true
    new Notification("StudyBuddy 🎯", {body:"Background mode ON — watching you! 👀", icon:"/favicon.ico"})
  }

  const disableBgMode = async () => {
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); setPipActive(false); bgModeRef.current=false
  }

  const loadModels = useCallback(async () => {
    const {FaceLandmarker,ObjectDetector,FilesetResolver} = await import("@mediapipe/tasks-vision")
    setLoadMsg("Setting up AI vision...")
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    )
    setLoadMsg("Loading face tracker...")
    faceRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",delegate:"CPU"},
      outputFaceBlendshapes:true, runningMode:"VIDEO", numFaces:1,
    })
    setLoadMsg("Loading phone detector...")
    phoneDetRef.current = await ObjectDetector.createFromOptions(vision, {
      baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",delegate:"CPU"},
      scoreThreshold:0.4, runningMode:"VIDEO",
    })
  }, [])

  const startSession = async () => {
    setPhase("loading")
    try {
      await loadModels()
      setLoadMsg("Starting camera...")
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:"user"}})
      if (videoRef.current) { videoRef.current.srcObject=stream; await videoRef.current.play() }
      setPhase("work"); setTimerPhase("work"); setTimerSecs(tech.work*60)
      setTotalSecs(0); setDistCount(0); setCycle(1); setCompletedCycles(0)
      smoothed.current=100; frameCount.current=0; phoneBox.current=null
      setHistory(Array(HISTORY_LEN).fill(100)); setExprHistory(Array(HISTORY_LEN).fill("😐"))
      timerRef.current = setInterval(()=>{
        setTotalSecs(s=>s+1)
        setHistory(h=>[...h.slice(1),Math.round(smoothed.current)])
        setExprHistory(e=>[...e.slice(1),expr.emoji])
      }, 1000)
    } catch { setPhase("idle"); alert("Camera access denied.") }
  }

  useEffect(() => {
    if (phase==="idle"||phase==="loading") return
    const interval = setInterval(()=>{
      setTimerSecs(s=>{
        if (s<=1) {
          if (timerPhase==="work") {
            const nc=cycle+1; setCycle(nc); setCompletedCycles(c=>c+1)
            if (nc>tech.cycles) {
              setCycle(1); setTimerPhase("longbreak"); setPhase("longbreak")
              if (bgModeRef.current) sendNotification("🌿 Long break! Great work!")
              return tech.longBreak*60
            }
            setTimerPhase("break"); setPhase("break")
            if (bgModeRef.current) sendNotification("☕ Short break time!")
            return tech.shortBreak*60
          }
          setTimerPhase("work"); setPhase("work")
          if (bgModeRef.current) sendNotification("🎯 Break over! Focus time!")
          return tech.work*60
        }
        return s-1
      })
    }, 1000)
    return ()=>clearInterval(interval)
  }, [phase, timerPhase, cycle, tech, sendNotification])

  const stopCamera = () => {
    if (faceRef.current)     { try{faceRef.current.close()}     catch{} faceRef.current=null }
    if (phoneDetRef.current) { try{phoneDetRef.current.close()} catch{} phoneDetRef.current=null }
    if (videoRef.current) {
      videoRef.current.pause()
      if (videoRef.current.srcObject) {
        ;(videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop())
        videoRef.current.srcObject=null
        videoRef.current.src=""
        videoRef.current.load()
      }
    }
    const ctx=canvasRef.current?.getContext("2d")
    if (ctx&&canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
  }

  const endSession = async () => {
    cancelAnimationFrame(animRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); setPipActive(false); bgModeRef.current=false
    stopCamera()
    const avgScore = Math.round(history.filter(h=>h>0).reduce((a,b)=>a+b,0)/Math.max(1,history.filter(h=>h>0).length))
    const report = {
      duration:Math.round(totalSecs/60), focusScore:avgScore,
      distractions:distCount, technique:tech.name, cycles:completedCycles,
      expression:expr.type, weekNum:selectedWeek, taskIdx:selectedTask,
    }
    setReportData(report); setShowReport(true)
    try {
      const user = await getUser()
      if (user) {
        await saveSession({user_id:user.id, duration_minutes:report.duration, focus_score:avgScore, distractions:distCount, avg_expression:expr.type, subject:goalType})
        if (selectedTask!==null&&totalSecs>=300) await toggleTask(user.id,selectedWeek,selectedTask,true)
      }
    } catch(e) { console.error(e) }
  }

  const triggerAlert = useCallback((type:keyof typeof ALERTS)=>{
    const now=Date.now()
    if (now-alertTime.current>ALERT_CD) {
      alertTime.current=now
      setDistCount(d=>d+1)
      const msg=pick(type)
      setAlertMsg(msg)
      setTimeout(()=>setAlertMsg(""),5000)
      if (bgModeRef.current) sendNotification(msg)
    }
  }, [sendNotification])

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
      canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480
      ctx.clearRect(0,0,canvas.width,canvas.height)
      const W=canvas.width,H=canvas.height
      const mx=(x:number)=>W-x*W,my=(y:number)=>y*H
      if (phdet&&frameCount.current%PHONE_EVERY===0) {
        try {
          const res=phdet.detectForVideo(video,now)
          const found=res.detections?.some((d:any)=>d.categories?.some((c:any)=>c.categoryName==="cell phone"&&c.score>0.4))
          setPhoneOn(!!found)
          phoneBox.current=found?res.detections?.find((d:any)=>d.categories?.some((c:any)=>c.categoryName==="cell phone"))?.boundingBox||null:null
        } catch {}
      }
      if (phoneBox.current) {
        const b=phoneBox.current,bx=W-(b.originX+b.width)
        ctx.strokeStyle="#D85A30"; ctx.lineWidth=3
        ctx.strokeRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="rgba(216,90,48,0.12)"; ctx.fillRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="#D85A30"; ctx.font="bold 13px sans-serif"
        ctx.fillText("📵 Phone",bx+6,b.originY+20)
      }
      let faceRes:any
      try{faceRes=faceRef.current.detectForVideo(video,now)}
      catch{animRef.current=requestAnimationFrame(detect);return}
      if (!faceRes.faceLandmarks?.length) {
        smoothed.current=smoothed.current*(1-EMA_ALPHA)
        setScore(Math.round(smoothed.current)); setDistType("absent")
        setEyeState({left:0,right:0})
        setExpr({type:"neutral",emoji:"👻",label:"Not at desk",color:"#555",hint:""})
        triggerAlert("absent")
      } else {
        const lm=faceRes.faceLandmarks[0]
        const bs=faceRes.faceBlendshapes?.[0]?.categories||[]
        const g=(n:string)=>bs.find((b:any)=>b.categoryName===n)?.score??0
        const currentExpr=detectExpression(bs)
        setExpr(currentExpr)
        const lb=g("eyeBlinkLeft"),rb=g("eyeBlinkRight")
        const ldl=g("eyeLookDownLeft"),ldr=g("eyeLookDownRight")
        const lol=g("eyeLookOutLeft"),lor=g("eyeLookOutRight")
        const lil=g("eyeLookInLeft"),lir=g("eyeLookInRight")
        setEyeState({left:1-lb,right:1-rb})
        const nose=lm[1],le=lm[33],re=lm[263]
        const midX=(le.x+re.x)/2,midY=(le.y+re.y)/2
        const yaw=Math.abs(nose.x-midX)
        let raw=100; let dt:DistractionType="focused"
        if ((lb+rb)/2>0.65)                      {raw-=55;dt="drowsy"}
        if (yaw>0.07||(lol+lor+lil+lir)/4>0.35) {raw-=35;if(dt==="focused")dt="looking_away"}
        if ((ldl+ldr)/2>0.45&&!phoneBox.current)  {raw-=25;if(dt==="focused")dt="looking_away"}
        if (currentExpr.type==="yawning")          {raw-=30;if(dt==="focused")dt="drowsy"}
        if (phoneBox.current)                      {raw-=60;dt="phone"}
        raw=Math.max(0,raw)
        smoothed.current=smoothed.current*(1-EMA_ALPHA)+raw*EMA_ALPHA
        setScore(Math.round(smoothed.current)); setDistType(dt)
        if (dt==="phone")          triggerAlert("phone")
        else if (dt==="drowsy")    triggerAlert("drowsy")
        else if (dt==="looking_away") triggerAlert("distracted")
        else                       setAlertMsg("")
        const dc=smoothed.current>=70?"#1D9E75":smoothed.current>=40?"#BA7517":"#D85A30"
        const ec=currentExpr.color
        const bc=g("browDownLeft")>0.3?"#D85A30":"#888"
        const drawC=(idx:number[],col:string,w=1,close=false)=>{
          const pts=idx.map(i=>lm[i]).filter(Boolean)
          if(pts.length<2) return
          ctx.beginPath(); ctx.moveTo(mx(pts[0].x),my(pts[0].y))
          pts.slice(1).forEach(p=>ctx.lineTo(mx(p.x),my(p.y)))
          if(close) ctx.closePath()
          ctx.strokeStyle=col; ctx.lineWidth=w; ctx.stroke()
        }
        drawC(OVAL,dc+"44",1.5,true)
        drawC(BROW_L,bc+"CC",2); drawC(BROW_R,bc+"CC",2)
        drawC(EYE_L,dc+"99",1.5,true); drawC(EYE_R,dc+"99",1.5,true)
        drawC(LIPS,ec+"BB",2,true)
        ;[468,473].forEach(i=>{
          if(!lm[i]) return
          ctx.beginPath(); ctx.arc(mx(lm[i].x),my(lm[i].y),9,0,Math.PI*2)
          ctx.fillStyle=dc+"CC"; ctx.fill()
          ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke()
        })
        ctx.beginPath(); ctx.arc(mx(midX),my(midY),68,0,Math.PI*2)
        ctx.strokeStyle=dc+"44"; ctx.lineWidth=2; ctx.stroke()
        ctx.fillStyle=ec; ctx.font="bold 14px sans-serif"
        ctx.fillText(`${currentExpr.emoji} ${currentExpr.label}`,mx(midX)-40,my(midY)+90)
      }
      animRef.current=requestAnimationFrame(detect)
    }
    animRef.current=requestAnimationFrame(detect)
    return ()=>cancelAnimationFrame(animRef.current)
  }, [phase, triggerAlert])

  const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`
  const getColor=()=>score>=70?"#1D9E75":score>=40?"#BA7517":"#D85A30"
  const timerTotal=timerPhase==="work"?tech.work*60:timerPhase==="break"?tech.shortBreak*60:tech.longBreak*60
  const timerPct=Math.round(((timerTotal-timerSecs)/timerTotal)*100)
  const isRunning=phase==="work"||phase==="break"||phase==="longbreak"
  const currentWeekTasks=roadmapWeeks.find((w:any)=>(w.week||0)===selectedWeek)?.tasks||[]
  const isTaskDone=(i:number)=>weekProgress.some(p=>p.week_number===selectedWeek&&p.task_index===i&&p.completed)

  if (showReport&&reportData) {
    const fc=reportData.focusScore>=80?"#1D9E75":reportData.focusScore>=60?"#BA7517":"#D85A30"
    return (
      <main style={{minHeight:"100vh",background:"#0f0f0f",color:"white",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{maxWidth:"400px",width:"100%",textAlign:"center"}}>
          <div style={{fontSize:"4rem",marginBottom:"8px"}}>{reportData.focusScore>=80?"🎯":reportData.focusScore>=60?"😊":"😐"}</div>
          <h1 style={{fontSize:"1.4rem",fontWeight:"700",marginBottom:"4px"}}>Session Complete!</h1>
          <p style={{color:"#666",fontSize:"0.85rem",marginBottom:"1.5rem"}}>{tech.emoji} {reportData.technique} · {reportData.cycles} cycles</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"1.5rem"}}>
            {[
              {label:"Duration",    value:`${reportData.duration}m`,       color:"#534AB7"},
              {label:"Focus Score", value:String(reportData.focusScore),   color:fc},
              {label:"Distractions",value:String(reportData.distractions), color:"#D85A30"},
            ].map(s=>(
              <div key={s.label} style={{background:"#1a1a1a",borderRadius:"12px",border:`1px solid ${s.color}33`,padding:"1rem"}}>
                <p style={{fontSize:"1.6rem",fontWeight:"800",color:s.color,margin:0}}>{s.value}</p>
                <p style={{fontSize:"0.68rem",color:"#666",margin:0}}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{background:"#1a1a1a",borderRadius:"14px",border:"1px solid #2a2a2a",padding:"1rem",marginBottom:"1.5rem"}}>
            <p style={{fontSize:"0.75rem",color:"#666",marginBottom:"6px"}}>Focus trend</p>
            <svg viewBox="0 0 300 60" style={{width:"100%",height:"60px"}}>
              <polyline points={history.map((v,i)=>`${(i/(HISTORY_LEN-1))*300},${60-(v/100)*60}`).join(" ")} fill="none" stroke={fc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          {selectedTask!==null&&(
            <div style={{background:"#1D9E7522",border:"1px solid #1D9E7544",borderRadius:"12px",padding:"12px",marginBottom:"1.5rem"}}>
              <p style={{color:"#1D9E75",fontWeight:"600",margin:0,fontSize:"0.88rem"}}>Task marked complete in roadmap!</p>
            </div>
          )}
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>{setShowReport(false);setPhase("idle");setTimerSecs(tech.work*60);setTotalSecs(0);setDistCount(0);router.refresh()}}
              style={{flex:1,padding:"12px",background:"#534AB7",border:"none",borderRadius:"12px",color:"white",fontWeight:"600",cursor:"pointer",fontSize:"0.9rem"}}>
              New Session
            </button>
            <button onClick={()=>router.push("/")}
              style={{flex:1,padding:"12px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:"12px",color:"#888",fontWeight:"600",cursor:"pointer",fontSize:"0.9rem"}}>
              Dashboard
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{minHeight:"100vh",background:"#0f0f0f",color:"white",padding:"1rem",maxWidth:"520px",margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
        <a href="/" style={{color:"#888",textDecoration:"none",fontSize:"1.2rem"}}>←</a>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.1rem",fontWeight:"600"}}>Study Room</h1>
          <p style={{color:"#555",fontSize:"0.72rem"}}>Focus · Timer · Tasks · All in one</p>
        </div>
        {isRunning&&(
          <div style={{background:phase==="work"?color+"33":"#1D9E7533",borderRadius:"8px",padding:"4px 10px"}}>
            <p style={{fontSize:"0.75rem",fontWeight:"700",color:phase==="work"?color:"#1D9E75",margin:0}}>
              {phase==="work"?"🎯 Focus":"☕ Break"}
            </p>
          </div>
        )}
      </div>

      {alertMsg&&(
        <div style={{background:distType==="phone"?"#8B1A1A":"#7A3010",border:`1px solid ${distType==="phone"?"#D85A30":"#BA7517"}`,borderRadius:"12px",padding:"12px 16px",marginBottom:"1rem",fontWeight:"600",textAlign:"center",fontSize:"0.9rem"}}>
          ⚠️ {alertMsg}
        </div>
      )}

      {bgMode&&(
        <div style={{background:"#534AB722",border:"1px solid #534AB7",borderRadius:"12px",padding:"10px 16px",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#534AB7",boxShadow:"0 0 8px #534AB7"}}/>
            <p style={{fontSize:"0.82rem",color:"#a78bfa",fontWeight:"600",margin:0}}>Background mode active!</p>
          </div>
          <button onClick={disableBgMode} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:"0.8rem"}}>✕</button>
        </div>
      )}

      {phase==="idle"&&(
        <div style={{marginBottom:"1rem"}}>
          <p style={{fontSize:"0.72rem",color:"#666",marginBottom:"8px"}}>Choose technique:</p>
          <div style={{display:"flex",gap:"6px",overflowX:"auto",paddingBottom:"4px"}}>
            {(Object.entries(TECHNIQUES) as [TechKey,typeof TECHNIQUES[TechKey]][]).map(([key,t])=>(
              <button key={key} onClick={()=>{setTechKey(key);setTimerSecs(t.work*60)}} style={{
                background:techKey===key?t.color:"#1a1a1a",
                border:techKey===key?"none":"1px solid #2a2a2a",
                borderRadius:"10px",color:"white",padding:"8px 12px",
                cursor:"pointer",flexShrink:0,transition:"all 0.2s",
                boxShadow:techKey===key?`0 0 16px ${t.color}44`:"none"
              }}>
                <div style={{fontSize:"1.2rem"}}>{t.emoji}</div>
                <div style={{fontSize:"0.68rem",fontWeight:"600",marginTop:"2px"}}>{t.name}</div>
                <div style={{fontSize:"0.6rem",color:techKey===key?"rgba(255,255,255,0.7)":"#666"}}>{t.work}m</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{position:"relative",borderRadius:"16px",overflow:"hidden",background:"#111",border:`2px solid ${isRunning?(phoneOn?"#D85A30":phase==="work"?color:"#1D9E75"):"#2a2a2a"}`,marginBottom:"1rem",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",transition:"border-color 0.4s"}}>
        <video ref={videoRef} muted playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",display:isRunning?"block":"none"}}/>
        <canvas ref={canvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",display:isRunning?"block":"none"}}/>
        {!isRunning&&(
          <div style={{textAlign:"center",color:"#444"}}>
            <div style={{fontSize:"3rem"}}>📷</div>
            <p style={{marginTop:"8px",fontSize:"0.85rem"}}>{phase==="loading"?loadMsg:"Camera starts with session"}</p>
          </div>
        )}
        {isRunning&&(
          <>
            <div style={{position:"absolute",top:10,left:10,background:"rgba(0,0,0,0.75)",borderRadius:"8px",padding:"4px 10px",fontSize:"0.72rem",color:getColor(),fontWeight:"700"}}>
              ● {phase==="work"?"FOCUS":"BREAK"}
            </div>
            {phoneOn&&<div style={{position:"absolute",top:10,right:10,background:"rgba(216,90,48,0.9)",borderRadius:"8px",padding:"4px 10px",fontSize:"0.72rem",fontWeight:"700"}}>📵 PHONE</div>}
            <div style={{position:"absolute",bottom:10,left:10,display:"flex",gap:"6px"}}>
              {[{l:"L",v:eyeState.left},{l:"R",v:eyeState.right}].map(e=>(
                <div key={e.l} style={{background:"rgba(0,0,0,0.75)",borderRadius:"6px",padding:"3px 8px",fontSize:"0.7rem",color:e.v>0.4?"#1D9E75":"#D85A30",fontWeight:"600"}}>
                  {e.l} {e.v>0.4?"👁":"—"}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"1rem"}}>
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:`1px solid ${getColor()}33`,padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"1.5rem"}}>{expr.emoji}</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",color:getColor(),lineHeight:1}}>{isRunning?score:"--"}</div>
          <div style={{fontSize:"0.6rem",color:"#666"}}>Focus</div>
        </div>
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:`1px solid ${color}33`,padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"0.6rem",color:color,fontWeight:"700",marginBottom:"2px",textTransform:"uppercase"}}>
            {timerPhase==="work"?"Work":timerPhase==="break"?"Break":"Long Break"}
          </div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",color:color,letterSpacing:"1px"}}>{fmt(timerSecs)}</div>
          <div style={{height:"3px",background:"#2a2a2a",borderRadius:"2px",overflow:"hidden",marginTop:"4px"}}>
            <div style={{width:`${timerPct}%`,height:"100%",background:color,borderRadius:"2px",transition:"width 1s"}}/>
          </div>
          <div style={{fontSize:"0.6rem",color:"#666",marginTop:"2px"}}>Cycle {cycle}/{tech.cycles}</div>
        </div>
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:"1px solid #2a2a2a",padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"0.6rem",color:"#666",marginBottom:"2px"}}>Session</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",letterSpacing:"1px"}}>{fmt(totalSecs)}</div>
          <div style={{fontSize:"0.6rem",color:"#D85A30",marginTop:"2px"}}>{distCount} distr.</div>
        </div>
      </div>

      {isRunning&&expr.hint&&(
        <div style={{background:"#1a1a1a",borderRadius:"10px",border:`1px solid ${expr.color}33`,padding:"8px 12px",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"1.2rem"}}>{expr.emoji}</span>
          <p style={{fontSize:"0.78rem",color:expr.color,margin:0}}>{expr.hint}</p>
          {expr.type==="confused"&&<a href="/chat" style={{marginLeft:"auto",background:"#534AB7",borderRadius:"6px",padding:"4px 10px",fontSize:"0.72rem",color:"white",textDecoration:"none",fontWeight:"600",whiteSpace:"nowrap"}}>Ask AI</a>}
        </div>
      )}

      {isRunning&&(
        <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"1rem"}}>
          {Array.from({length:tech.cycles}).map((_,i)=>(
            <div key={i} style={{width:"10px",height:"10px",borderRadius:"50%",background:i<completedCycles?color:"#2a2a2a",border:i===cycle-1&&phase==="work"?`2px solid ${color}`:"none",transition:"all 0.3s"}}/>
          ))}
        </div>
      )}

      {isRunning&&(
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:"1px solid #2a2a2a",padding:"0.8rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
            <p style={{fontSize:"0.68rem",color:"#666",margin:0}}>Live focus trend</p>
            <div style={{display:"flex",gap:"3px"}}>{exprHistory.slice(-8).map((e,i)=><span key={i} style={{fontSize:"0.65rem"}}>{e}</span>)}</div>
          </div>
          <svg viewBox="0 0 300 40" style={{width:"100%",height:"40px"}}>
            <polyline points={history.map((v,i)=>`${(i/(HISTORY_LEN-1))*300},${40-(v/100)*40}`).join(" ")} fill="none" stroke={getColor()} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {phase==="idle"&&roadmapWeeks.length>0&&(
        <div style={{background:"#1a1a1a",borderRadius:"14px",border:"1px solid #2a2a2a",padding:"1rem",marginBottom:"1rem"}}>
          <p style={{fontSize:"0.75rem",color:"#888",marginBottom:"8px"}}>What are you working on?</p>
          <select value={selectedWeek} onChange={e=>{setSelectedWeek(Number(e.target.value));setSelectedTask(null)}}
            style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:"8px",color:"white",padding:"8px 12px",fontSize:"0.82rem",outline:"none",marginBottom:"8px"}}>
            {roadmapWeeks.map((w:any,i:number)=>(
              <option key={i} value={w.week||i+1}>Week {w.week||i+1} — {(w.focus||"").substring(0,40)}...</option>
            ))}
          </select>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {currentWeekTasks.map((task:string,i:number)=>{
              const done=isTaskDone(i)
              return (
                <div key={i} onClick={()=>setSelectedTask(selectedTask===i?null:i)} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 10px",borderRadius:"8px",cursor:"pointer",background:selectedTask===i?"#534AB722":done?"#1D9E7511":"#111",border:`1px solid ${selectedTask===i?"#534AB7":done?"#1D9E7533":"#222"}`,transition:"all 0.2s"}}>
                  <div style={{width:"16px",height:"16px",borderRadius:"50%",flexShrink:0,background:done?"#1D9E75":selectedTask===i?"#534AB7":"#2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"white"}}>
                    {done?"✓":selectedTask===i?"✓":""}
                  </div>
                  <p style={{fontSize:"0.78rem",margin:0,color:done?"#666":selectedTask===i?"white":"#888",textDecoration:done?"line-through":"none"}}>{task}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isRunning&&selectedTask!==null&&currentWeekTasks[selectedTask]&&(
        <div style={{background:"#1a1a1a",borderRadius:"10px",border:`1px solid ${color}33`,padding:"8px 12px",marginBottom:"1rem"}}>
          <p style={{fontSize:"0.7rem",color:"#666",margin:0}}>Working on:</p>
          <p style={{fontSize:"0.82rem",color:"white",fontWeight:"500",margin:0}}>{currentWeekTasks[selectedTask]}</p>
        </div>
      )}

      {isRunning&&(
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:`1px solid ${color}33`,padding:"0.8rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"1.2rem"}}>{tech.emoji}</span>
              <div>
                <p style={{fontSize:"0.78rem",fontWeight:"600",margin:0}}>{tech.name}</p>
                <p style={{fontSize:"0.65rem",color:"#666",margin:0}}>{phase==="work"?`${tech.shortBreak}min break coming up`:"Break — rest your eyes!"}</p>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:"0.78rem",fontWeight:"700",color,margin:0}}>{completedCycles} done</p>
              <p style={{fontSize:"0.62rem",color:"#666",margin:0}}>cycles</p>
            </div>
          </div>
        </div>
      )}

      {phase==="idle"&&(
        <div style={{background:"#1a1a1a",borderRadius:"12px",border:"1px solid #534AB733",padding:"0.8rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"1.2rem"}}>🔲</span>
          <div>
            <p style={{fontSize:"0.78rem",fontWeight:"600",margin:0}}>Background Mode Available</p>
            <p style={{fontSize:"0.68rem",color:"#666",margin:0}}>Start session then tap the BG button</p>
          </div>
        </div>
      )}

      {phase==="idle"&&(
        <button onClick={startSession} style={{width:"100%",padding:"16px",background:`linear-gradient(135deg,${color},${color}bb)`,border:"none",borderRadius:"14px",color:"white",fontSize:"1.05rem",fontWeight:"600",cursor:"pointer",boxShadow:`0 0 24px ${color}44`}}>
          {tech.emoji} Start {tech.name} Session
        </button>
      )}

      {phase==="loading"&&(
        <div style={{textAlign:"center",padding:"16px",color:"#888"}}>
          <div style={{fontSize:"1.5rem",marginBottom:"8px"}}>⚙️</div>
          {loadMsg}
        </div>
      )}

      {isRunning&&(
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <button onClick={bgMode?disableBgMode:enableBgMode} style={{width:"100%",padding:"14px",background:bgMode?"linear-gradient(135deg,#534AB7,#1D9E75)":"#1a1a1a",border:`2px solid ${bgMode?"#534AB7":"#534AB744"}`,borderRadius:"12px",color:bgMode?"white":"#a78bfa",cursor:"pointer",fontWeight:"700",fontSize:"0.9rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
            {bgMode?"● Background Mode ON — tap to exit":"🔲 Enable Background Mode"}
          </button>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>{if(timerPhase==="work"){setTimerPhase("break");setPhase("break");setTimerSecs(tech.shortBreak*60)}else{setTimerPhase("work");setPhase("work");setTimerSecs(tech.work*60)}}} style={{flex:1,padding:"12px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:"12px",color:"#888",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem"}}>
              {phase==="work"?"☕ Take Break":"🎯 Resume Work"}
            </button>
            <button onClick={endSession} style={{flex:1,padding:"12px",background:"#D85A30",border:"none",borderRadius:"12px",color:"white",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem"}}>
              End Session ✓
            </button>
          </div>
        </div>
      )}

    </main>
  )
}
