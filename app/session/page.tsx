"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { saveSession, getUser, getRoadmap, getCurrentWeek, getProgress, toggleTask } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const TECHNIQUES = {
  pomodoro:   { name:"Pomodoro",   emoji:"🍅", color:"#f87171", work:25, shortBreak:5,  longBreak:15, cycles:4 },
  deepwork:   { name:"Deep Work",  emoji:"🧠", color:"#7c6dfa", work:90, shortBreak:20, longBreak:30, cycles:2 },
  timeboxing: { name:"Timeboxing", emoji:"📦", color:"#fbbf24", work:45, shortBreak:10, longBreak:20, cycles:3 },
  spaced:     { name:"Spaced Rep", emoji:"🔁", color:"#3ecf8e", work:20, shortBreak:10, longBreak:20, cycles:3 },
  feynman:    { name:"Feynman",    emoji:"✍️", color:"#a78bfa", work:30, shortBreak:10, longBreak:15, cycles:3 },
}

type TechKey  = keyof typeof TECHNIQUES
type Phase    = "idle"|"loading"|"work"|"break"|"longbreak"
type DistType = "focused"|"looking_away"|"drowsy"|"absent"|"phone"|"idle"

const GOAL_COLORS: Record<string,string> = {
  competitive:"#7c6dfa", academic:"#3ecf8e", coding:"#60a5fa", skill:"#fbbf24"
}

// Eye landmark indices (MediaPipe 478 landmarks)
const LEFT_EYE_TOP    = [159,160,161]
const LEFT_EYE_BOT    = [145,144,163]
const RIGHT_EYE_TOP   = [386,387,388]
const RIGHT_EYE_BOT   = [374,373,380]
const LEFT_EYE_INNER  = 133
const LEFT_EYE_OUTER  = 33
const RIGHT_EYE_INNER = 362
const RIGHT_EYE_OUTER = 263

const EXPR_MAP: Record<string,{emoji:string;hint:string}> = {
  happy:     { emoji:"😄", hint:"Great energy! You are in the zone 🎯" },
  surprised: { emoji:"😮", hint:"Interesting! Jot that thought down 📝" },
  confused:  { emoji:"🤔", hint:"Stuck? Ask the AI Tutor!" },
  frustrated:{ emoji:"😤", hint:"Deep breath — hard topics = real growth 💪" },
  sad:       { emoji:"😢", hint:"You can do this — one step at a time 🌟" },
  yawning:   { emoji:"🥱", hint:"Tired? Take a 5-min walk and come back!" },
  neutral:   { emoji:"😐", hint:"" },
}

const ALERTS = {
  phone:      ["📵 Phone detected! Put it away!", "No phones during study time!"],
  distracted: ["You are distracted — focus! 🎯", "Eyes back on screen 👀"],
  drowsy:     ["Getting drowsy — wake up! 😴", "Splash some water 💧"],
  absent:     ["You left your desk 👻", "Come back to your session!"],
}
const pick = (k:keyof typeof ALERTS) => { const l=ALERTS[k]; return l[Math.floor(Math.random()*l.length)] }

// EAR = Eye Aspect Ratio for blink detection
function calcEAR(lm: any[], topIdx: number[], botIdx: number[], innerIdx: number, outerIdx: number): number {
  const avgTop = topIdx.reduce((s,i)=>s+(lm[i]?.y||0),0)/topIdx.length
  const avgBot = botIdx.reduce((s,i)=>s+(lm[i]?.y||0),0)/botIdx.length
  const inner  = lm[innerIdx]?.x || 0
  const outer  = lm[outerIdx]?.x || 0
  const height = Math.abs(avgTop - avgBot)
  const width  = Math.abs(inner - outer)
  return width > 0 ? height/width : 0.3
}

// Head pose from nose tip vs eye midpoint
function calcHeadPose(lm: any[]): { yaw:number; pitch:number } {
  const nose     = lm[1]
  const leftEye  = lm[33]
  const rightEye = lm[263]
  if (!nose||!leftEye||!rightEye) return { yaw:0, pitch:0 }
  const midX  = (leftEye.x+rightEye.x)/2
  const midY  = (leftEye.y+rightEye.y)/2
  const eyeW  = Math.abs(leftEye.x-rightEye.x)
  return {
    yaw:   eyeW>0 ? (nose.x-midX)/eyeW : 0,
    pitch: eyeW>0 ? (nose.y-midY)/eyeW : 0
  }
}

// Detect expression from blendshapes
function detectExpression(bs: any[]): { type:string; emoji:string; hint:string } {
  const g = (n:string) => bs.find((b:any)=>b.categoryName===n)?.score??0
  const jaw    = g("jawOpen")
  const smile  = (g("mouthSmileLeft")+g("mouthSmileRight"))/2
  const frown  = (g("mouthFrownLeft")+g("mouthFrownRight"))/2
  const browDn = (g("browDownLeft")+g("browDownRight"))/2
  const browUp = g("browInnerUp")
  const cheek  = (g("cheekSquintLeft")+g("cheekSquintRight"))/2
  const wide   = (g("eyeWideLeft")+g("eyeWideRight"))/2

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
  const absentFrames= useRef(0)  // Track consecutive absent frames
  const phoneBox    = useRef<any>(null)
  const lookAwayFrames  = useRef(0)
  const drowsyFrames    = useRef(0)
  const blinkFrames     = useRef(0)
  const router      = useRouter()

  const [phase,           setPhase]           = useState<Phase>("idle")
  const [loadMsg,         setLoadMsg]         = useState("")
  const [score,           setScore]           = useState(100)
  const [distType,        setDistType]        = useState<DistType>("idle")
  const [expr,            setExpr]            = useState(EXPR_MAP.neutral)
  const [exprType,        setExprType]        = useState("neutral")
  const [phoneOn,         setPhoneOn]         = useState(false)
  const [alertMsg,        setAlertMsg]        = useState("")
  const [totalSecs,       setTotalSecs]       = useState(0)
  const [distCount,       setDistCount]       = useState(0)
  const [eyeState,        setEyeState]        = useState({left:1,right:1})
  const [history,         setHistory]         = useState<number[]>(Array(60).fill(100))
  const [exprHistory,     setExprHistory]     = useState<string[]>(Array(60).fill("😐"))
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
  const color = GOAL_COLORS[goalType] || tech.color

  useEffect(() => {
    const load = async () => {
      const user = await getUser()
      if (!user) { window.location.href = "/login"; return }
      const [roadmapData, weekData, progressData] = await Promise.all([
        getRoadmap(user.id), getCurrentWeek(user.id), getProgress(user.id)
      ])
      if (roadmapData) {
        let rm = roadmapData.roadmap
        if ((!rm?.weeks||rm.weeks.length===0)&&typeof rm?.overview==="string") {
          try {
            const parsed=JSON.parse(rm.overview.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim())
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

  const notify = useCallback((msg:string) => {
    if (typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted") {
      new Notification("StudyBuddy 🎯", { body:msg, icon:"/favicon.ico", tag:"studybuddy" })
    }
  }, [])

  const enableBgMode = async () => {
    const perm = await Notification.requestPermission()
    if (perm!=="granted") { alert("Please allow notifications!"); return }
    try {
      if (videoRef.current&&document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture()
        videoRef.current.addEventListener("leavepictureinpicture",()=>{ setBgMode(false); bgModeRef.current=false },{once:true})
      }
    } catch {}
    setBgMode(true); bgModeRef.current=true
    new Notification("StudyBuddy 🎯",{body:"Background mode ON 👀",icon:"/favicon.ico"})
  }

  const disableBgMode = async () => {
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); bgModeRef.current=false
  }

  const loadModels = useCallback(async () => {
    const { FaceLandmarker, ObjectDetector, FilesetResolver } = await import("@mediapipe/tasks-vision")
    setLoadMsg("Setting up AI vision runtime...")
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    )
    setLoadMsg("Loading face mesh + expression model...")
    faceRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate:"CPU"
      },
      outputFaceBlendshapes:true,
      runningMode:"VIDEO",
      numFaces:1,
      minFaceDetectionConfidence:0.4,  // Lower threshold = more lenient detection
      minFacePresenceConfidence:0.4,
      minTrackingConfidence:0.4,
    })
    setLoadMsg("Loading phone detector...")
    phoneDetRef.current = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:"https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
        delegate:"CPU"
      },
      scoreThreshold:0.4,
      runningMode:"VIDEO",
    })
  }, [])

  const startSession = async () => {
    setPhase("loading")
    try {
      await loadModels()
      setLoadMsg("Starting camera...")
      const stream = await navigator.mediaDevices.getUserMedia({ video:{width:640,height:480,facingMode:"user"} })
      if (videoRef.current) { videoRef.current.srcObject=stream; await videoRef.current.play() }
      setPhase("work"); setTimerPhase("work"); setTimerSecs(tech.work*60)
      setTotalSecs(0); setDistCount(0); setCycle(1); setCompletedCycles(0)
      smoothed.current=100; frameCount.current=0; phoneBox.current=null; absentFrames.current=0
      setHistory(Array(60).fill(100)); setExprHistory(Array(60).fill("😐"))
      timerRef.current = setInterval(()=>{
        setTotalSecs(s=>s+1)
        setHistory(h=>[...h.slice(1),Math.round(smoothed.current)])
        setExprHistory(e=>[...e.slice(1),expr.emoji])
      },1000)
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
              if (bgModeRef.current) notify("🌿 Long break time!")
              return tech.longBreak*60
            }
            setTimerPhase("break"); setPhase("break")
            if (bgModeRef.current) notify("☕ Short break time!")
            return tech.shortBreak*60
          }
          setTimerPhase("work"); setPhase("work")
          if (bgModeRef.current) notify("🎯 Break over! Focus time!")
          return tech.work*60
        }
        return s-1
      })
    },1000)
    return ()=>clearInterval(interval)
  },[phase,timerPhase,cycle,tech,notify])

  const stopCamera = () => {
    if (faceRef.current)     { try{faceRef.current.close()}     catch{} faceRef.current=null }
    if (phoneDetRef.current) { try{phoneDetRef.current.close()} catch{} phoneDetRef.current=null }
    if (videoRef.current) {
      videoRef.current.pause()
      if (videoRef.current.srcObject) {
        ;(videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop())
        videoRef.current.srcObject=null; videoRef.current.src=""; videoRef.current.load()
      }
    }
    const ctx=canvasRef.current?.getContext("2d")
    if (ctx&&canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
  }

  const endSession = async () => {
    cancelAnimationFrame(animRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture() } catch {}
    setBgMode(false); bgModeRef.current=false
    stopCamera()
    const avgScore=Math.round(history.filter(h=>h>0).reduce((a,b)=>a+b,0)/Math.max(1,history.filter(h=>h>0).length))
    const report={ duration:Math.round(totalSecs/60), focusScore:avgScore, distractions:distCount, technique:tech.name, cycles:completedCycles, expression:exprType }
    setReportData(report); setShowReport(true)
    try {
      const user=await getUser()
      if (user) {
        await saveSession({user_id:user.id,duration_minutes:report.duration,focus_score:avgScore,distractions:distCount,avg_expression:exprType,subject:goalType})
        if (selectedTask!==null&&totalSecs>=300) await toggleTask(user.id,selectedWeek,selectedTask,true)
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
      const W=canvas.width=video.videoWidth||640
      const H=canvas.height=video.videoHeight||480
      ctx.clearRect(0,0,W,H)
      const mx=(x:number)=>W-x*W, my=(y:number)=>y*H

      // Phone detection every 25 frames
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
        const b=phoneBox.current,bx=W-(b.originX+b.width)
        ctx.strokeStyle="#f87171"; ctx.lineWidth=3
        ctx.strokeRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="rgba(248,113,113,0.1)"; ctx.fillRect(bx,b.originY,b.width,b.height)
        ctx.fillStyle="#f87171"; ctx.font="bold 13px sans-serif"
        ctx.fillText("📵 Phone",bx+6,b.originY+20)
      }

      // Face detection
      let faceRes:any
      try { faceRes=faceRef.current.detectForVideo(video,now) }
      catch { animRef.current=requestAnimationFrame(detect); return }

      const lm=faceRes.faceLandmarks?.[0]
      const bs=faceRes.faceBlendshapes?.[0]?.categories||[]

      if (!lm||lm.length===0) {
        // ── No face: require 15 consecutive absent frames before alerting
        absentFrames.current++
        if (absentFrames.current > 15) {
          smoothed.current=Math.max(0,smoothed.current*0.92)
          setScore(Math.round(smoothed.current))
          setDistType("absent")
          setEyeState({left:0,right:0})
          setExpr(EXPR_MAP.neutral); setExprType("neutral")
          if (absentFrames.current > 30) triggerAlert("absent")
        }
        animRef.current=requestAnimationFrame(detect); return
      }

      // Reset absent counter — face is detected
      absentFrames.current=0

      // ── Expressions ──────────────────────────────────────────────
      const currentExpr = detectExpression(bs)
      setExpr({ emoji:currentExpr.emoji, hint:currentExpr.hint })
      setExprType(currentExpr.type)

      // ── EAR based eye blink detection ─────────────────────────────
      const leftEAR  = calcEAR(lm, LEFT_EYE_TOP,  LEFT_EYE_BOT,  LEFT_EYE_INNER,  LEFT_EYE_OUTER)
      const rightEAR = calcEAR(lm, RIGHT_EYE_TOP, RIGHT_EYE_BOT, RIGHT_EYE_INNER, RIGHT_EYE_OUTER)
      const avgEAR   = (leftEAR+rightEAR)/2
      const eyesClosed = avgEAR < 0.18

      setEyeState({
        left:  Math.min(1, leftEAR  / 0.3),
        right: Math.min(1, rightEAR / 0.3)
      })

      // ── Head pose ─────────────────────────────────────────────────
      const { yaw, pitch } = calcHeadPose(lm)
      const lookingAway = Math.abs(yaw) > 0.28 || pitch < -0.22 || pitch > 0.55

      // ── Focus score calculation ────────────────────────────────────
      let raw = 100

      if (phoneBox.current) {
        // Phone — immediate alert
        raw -= 70
        setDistType("phone")
        lookAwayFrames.current = 0
        drowsyFrames.current   = 0
        triggerAlert("phone")

      } else if (eyesClosed) {
        // Eyes closed — ignore normal blinks (< 10 frames)
        blinkFrames.current++
        if (blinkFrames.current > 10) {
          // Sustained eye closure = drowsy
          drowsyFrames.current++
          raw -= 40
          setDistType("drowsy")
          if (drowsyFrames.current > 30) triggerAlert("drowsy")
        } else {
          // Normal blink — don't penalise
          setDistType("focused")
        }

      } else {
        blinkFrames.current  = 0
        drowsyFrames.current = 0

        if (lookingAway) {
          // Looking away — require 25 sustained frames before counting
          lookAwayFrames.current++
          if (lookAwayFrames.current > 25) {
            raw -= 35
            setDistType("looking_away")
            if (lookAwayFrames.current > 50) triggerAlert("distracted")
          } else {
            // Brief glance — don't penalise
            raw -= 5
            setDistType("focused")
          }
        } else {
          lookAwayFrames.current = 0
          setDistType("focused")
          setAlertMsg("")
        }

        // Expression penalties — subtle only
        if (currentExpr.type==="yawning")    raw -= 20
        if (currentExpr.type==="frustrated") raw -= 5
      }

      raw = Math.max(0, Math.min(100, raw))

      
      smoothed.current = smoothed.current*0.88 + raw*0.12
      setScore(Math.round(smoothed.current))

      // ── Canvas overlay ────────────────────────────────────────────
      const sc = smoothed.current>=70?"#3ecf8e":smoothed.current>=40?"#fbbf24":"#f87171"

      const drawContour=(indices:number[],color:string,lw=1,close=false)=>{
        const pts=indices.map(i=>lm[i]).filter(Boolean)
        if (pts.length<2) return
        ctx.beginPath(); ctx.moveTo(mx(pts[0].x),my(pts[0].y))
        pts.slice(1).forEach(p=>ctx.lineTo(mx(p.x),my(p.y)))
        if (close) ctx.closePath()
        ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.stroke()
      }

      // Face oval
      const OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
      drawContour(OVAL,sc+"44",1.5,true)

      // Eyes — colored based on EAR (green=open, red=closed)
      const leftEyeColor  = leftEAR  > 0.18 ? "#3ecf8e99" : "#f8717199"
      const rightEyeColor = rightEAR > 0.18 ? "#3ecf8e99" : "#f8717199"
      drawContour([33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],leftEyeColor,1.5,true)
      drawContour([362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382],rightEyeColor,1.5,true)

      // Brows — change color based on frustration
      const browColor = bs.find((b:any)=>b.categoryName==="browDownLeft")?.score>0.35 ? "#f87171BB" : "#a78bfaBB"
      drawContour([70,63,105,66,107,55,65,52,53,46],browColor,2)
      drawContour([300,293,334,296,336,285,295,282,283,276],browColor,2)

      // Lips — color based on expression
      const lipColor = currentExpr.type==="happy"?"#3ecf8eBB":currentExpr.type==="frustrated"?"#f87171BB":"#a78bfa99"
      drawContour([61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146],lipColor,2,true)

      // Iris dots
      ;[468,473].forEach(i=>{
        if (!lm[i]) return
        ctx.beginPath(); ctx.arc(mx(lm[i].x),my(lm[i].y),8,0,Math.PI*2)
        ctx.fillStyle=sc+"CC"; ctx.fill()
        ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke()
      })

      // Gaze circle
      const nose=lm[1],le=lm[33],re=lm[263]
      if (nose&&le&&re) {
        const midX=(le.x+re.x)/2, midY=(le.y+re.y)/2
        ctx.beginPath(); ctx.arc(mx(midX),my(midY),55,0,Math.PI*2)
        ctx.strokeStyle=sc+"33"; ctx.lineWidth=1.5; ctx.stroke()
      }

      // Expression label
      ctx.fillStyle=sc; ctx.font="bold 13px sans-serif"
      const eyeMidX = lm[1] ? mx(lm[1].x) : W/2
      const eyeTopY = lm[10] ? my(lm[10].y) - 20 : 20
      ctx.fillText(`${currentExpr.emoji} ${currentExpr.type}`,eyeMidX-30,eyeTopY)

      // Focus bar at bottom of face
      if (lm[152]&&lm[10]) {
        const faceBot = my(lm[152].y)+12
        const faceLeft= mx(Math.max(lm[234]?.x||0,lm[127]?.x||0))
        const faceRight= mx(Math.min(lm[454]?.x||0,lm[356]?.x||0))
        const barW    = Math.abs(faceRight-faceLeft)
        ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fillRect(faceLeft,faceBot,barW,4)
        ctx.fillStyle=sc; ctx.fillRect(faceLeft,faceBot,barW*(smoothed.current/100),4)
      }

      animRef.current=requestAnimationFrame(detect)
    }

    animRef.current=requestAnimationFrame(detect)
    return ()=>cancelAnimationFrame(animRef.current)
  },[phase,triggerAlert,expr])

  const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`
  const sc=(s:number)=>s>=70?"#3ecf8e":s>=40?"#fbbf24":"#f87171"
  const timerTotal=timerPhase==="work"?tech.work*60:timerPhase==="break"?tech.shortBreak*60:tech.longBreak*60
  const timerPct=Math.round(((timerTotal-timerSecs)/timerTotal)*100)
  const isRunning=phase==="work"||phase==="break"||phase==="longbreak"
  const currentWeekTasks=roadmapWeeks.find((w:any)=>(w.week||0)===selectedWeek)?.tasks||[]
  const isTaskDone=(i:number)=>weekProgress.some(p=>p.week_number===selectedWeek&&p.task_index===i&&p.completed)

  if (showReport&&reportData) {
    const fc=sc(reportData.focusScore)
    return (
      <div style={{minHeight:"100vh",background:"var(--bg-base)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{maxWidth:"420px",width:"100%",textAlign:"center"}}>
          <div style={{fontSize:"4rem",marginBottom:"8px"}}>{reportData.focusScore>=80?"🎯":reportData.focusScore>=60?"😊":"😐"}</div>
          <h1 style={{fontSize:"1.5rem",fontWeight:"700",marginBottom:"4px"}}>Session Complete!</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginBottom:"1.5rem"}}>{tech.emoji} {reportData.technique} · {reportData.cycles} cycles · {reportData.duration}min</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"1.2rem"}}>
            {[{label:"Focus Score",value:String(reportData.focusScore),color:fc},{label:"Distractions",value:String(reportData.distractions),color:"#f87171"},{label:"Duration",value:`${reportData.duration}m`,color:"var(--accent)"}].map(s=>(
              <div key={s.label} style={{background:`${s.color}0d`,border:`1px solid ${s.color}22`,borderRadius:"var(--radius-lg)",padding:"1rem"}}>
                <p style={{fontSize:"1.8rem",fontWeight:"800",color:s.color,margin:0,lineHeight:1}}>{s.value}</p>
                <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:"4px 0 0"}}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1rem",marginBottom:"1.2rem"}}>
            <p style={{fontSize:"0.75rem",color:"var(--text-muted)",marginBottom:"8px",textAlign:"left"}}>Focus trend</p>
            <svg viewBox="0 0 300 60" style={{width:"100%",height:"60px"}}>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fc} stopOpacity="0.3"/><stop offset="100%" stopColor={fc} stopOpacity="0"/></linearGradient></defs>
              <polygon points={`0,60 ${history.map((v,i)=>`${(i/59)*300},${60-(v/100)*60}`).join(" ")} 300,60`} fill="url(#rg)"/>
              <polyline points={history.map((v,i)=>`${(i/59)*300},${60-(v/100)*60}`).join(" ")} fill="none" stroke={fc} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1rem",marginBottom:"1.5rem",textAlign:"left"}}>
            <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0,lineHeight:1.7}}>
              {reportData.focusScore>=80?"🏆 Outstanding! Keep this momentum!":reportData.focusScore>=60?"👍 Good session! Try reducing distractions next time.":"💪 Tough session but you showed up!"}
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <div style={{ display:"flex", gap:"8px" }}>
              <button onClick={()=>{ setShowReport(false); setPhase("idle"); setTimerSecs(tech.work*60); setTotalSecs(0); setDistCount(0) }}
                style={{ flex:1, padding:"12px", background:"var(--accent)", border:"none", borderRadius:"var(--radius-md)", color:"white", fontWeight:"600", cursor:"pointer", fontSize:"0.9rem" }}>
                New Session 🔄
              </button>
              <button onClick={()=>router.push("/")}
                style={{ flex:1, padding:"12px", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", color:"var(--text-secondary)", fontWeight:"600", cursor:"pointer", fontSize:"0.9rem" }}>
                Dashboard 🏠
              </button>
            </div>
            <button onClick={()=>router.push("/calendar")}
              style={{ width:"100%", padding:"10px", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:"var(--radius-md)", color:"#fbbf24", fontWeight:"600", cursor:"pointer", fontSize:"0.85rem" }}>
              📋 Do Daily Check-in →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:"100vh",padding:"1rem",maxWidth:"540px",margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
        <a href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:"1.2rem",lineHeight:1}}>←</a>
        <div style={{flex:1}}>
          <h1 style={{fontSize:"1.1rem",fontWeight:"600",margin:0}}>Study Room</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.7rem",margin:0}}>MediaPipe · EAR blink detection · Smart focus scoring</p>
        </div>
        {isRunning&&(
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={bgMode?disableBgMode:enableBgMode} style={{background:bgMode?"var(--accent)":"var(--bg-elevated)",border:`1px solid ${bgMode?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-md)",color:bgMode?"white":"var(--text-secondary)",padding:"5px 12px",fontSize:"0.72rem",cursor:"pointer",fontWeight:"600"}}>
              {bgMode?"● BG On":"🔲 BG"}
            </button>
            <div style={{background:timerPhase==="work"?`${tech.color}15`:"rgba(62,207,142,0.12)",border:`1px solid ${timerPhase==="work"?tech.color+"33":"rgba(62,207,142,0.3)"}`,borderRadius:"var(--radius-md)",padding:"4px 10px"}}>
              <p style={{fontSize:"0.75rem",fontWeight:"700",color:timerPhase==="work"?tech.color:"#3ecf8e",margin:0}}>{timerPhase==="work"?"🎯 Focus":"☕ Break"}</p>
            </div>
          </div>
        )}
      </div>

      {alertMsg&&(
        <div style={{background:phoneOn?"rgba(248,113,113,0.1)":"rgba(251,191,36,0.1)",border:`1px solid ${phoneOn?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.3)"}`,borderRadius:"var(--radius-md)",padding:"10px 16px",marginBottom:"1rem",fontWeight:"600",textAlign:"center",fontSize:"0.88rem",color:phoneOn?"#f87171":"#fbbf24"}}>
          {alertMsg}
        </div>
      )}

      {phase==="idle"&&(
        <div style={{marginBottom:"1rem"}}>
          <p style={{fontSize:"0.72rem",color:"var(--text-muted)",marginBottom:"8px",fontWeight:"500"}}>Choose technique:</p>
          <div style={{display:"flex",gap:"6px",overflowX:"auto",paddingBottom:"4px"}}>
            {(Object.entries(TECHNIQUES) as [TechKey,typeof TECHNIQUES[TechKey]][]).map(([key,t])=>(
              <button key={key} onClick={()=>{setTechKey(key);setTimerSecs(t.work*60)}} style={{background:techKey===key?`${t.color}15`:"var(--bg-card)",border:`1px solid ${techKey===key?t.color+"44":"var(--border)"}`,borderRadius:"var(--radius-md)",color:"var(--text-primary)",padding:"8px 12px",cursor:"pointer",flexShrink:0,transition:"all 0.2s"}}>
                <div style={{fontSize:"1.1rem"}}>{t.emoji}</div>
                <div style={{fontSize:"0.68rem",fontWeight:"600",marginTop:"2px",color:techKey===key?t.color:"var(--text-secondary)"}}>{t.name}</div>
                <div style={{fontSize:"0.6rem",color:"var(--text-muted)"}}>{t.work}m</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{position:"relative",borderRadius:"var(--radius-xl)",overflow:"hidden",background:"var(--bg-card)",border:`2px solid ${isRunning?(phoneOn?"#f87171":timerPhase==="work"?sc(score):"#3ecf8e"):"var(--border)"}`,marginBottom:"1rem",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",transition:"border-color 0.5s"}}>
        <video ref={videoRef} muted playsInline style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",display:isRunning?"block":"none"}}/>
        <canvas ref={canvasRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",display:isRunning?"block":"none"}}/>
        {!isRunning&&(
          <div style={{textAlign:"center",color:"var(--text-muted)"}}>
            <div style={{fontSize:"3rem",marginBottom:"8px"}}>📷</div>
            <p style={{fontSize:"0.85rem",margin:0}}>{phase==="loading"?loadMsg:"Camera starts with session"}</p>
          </div>
        )}
        {isRunning&&(
          <>
            <div style={{position:"absolute",top:10,left:10,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",borderRadius:"var(--radius-sm)",padding:"3px 8px",fontSize:"0.7rem",color:sc(score),fontWeight:"700"}}>● {timerPhase==="work"?"FOCUS":"BREAK"}</div>
            {phoneOn&&<div style={{position:"absolute",top:10,right:10,background:"rgba(248,113,113,0.85)",borderRadius:"var(--radius-sm)",padding:"3px 8px",fontSize:"0.7rem",fontWeight:"700"}}>📵 PHONE</div>}
            <div style={{position:"absolute",bottom:10,left:10,display:"flex",gap:"6px"}}>
              {[{l:"L",v:eyeState.left},{l:"R",v:eyeState.right}].map(e=>(
                <div key={e.l} style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",borderRadius:"var(--radius-sm)",padding:"2px 8px",fontSize:"0.68rem",color:e.v>0.4?"#3ecf8e":"#f87171",fontWeight:"600"}}>
                  {e.l} {e.v>0.4?"👁":"—"}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"1rem"}}>
        <div style={{background:`${sc(score)}0d`,border:`1px solid ${sc(score)}22`,borderRadius:"var(--radius-lg)",padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"1.5rem"}}>{expr.emoji}</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",color:sc(score),lineHeight:1}}>{isRunning?score:"--"}</div>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)"}}>Focus Score</div>
        </div>
        <div style={{background:`${tech.color}0d`,border:`1px solid ${tech.color}22`,borderRadius:"var(--radius-lg)",padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"0.6rem",color:tech.color,fontWeight:"700",marginBottom:"2px",textTransform:"uppercase"}}>{timerPhase==="work"?"Work":timerPhase==="break"?"Break":"Long Break"}</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",color:tech.color,letterSpacing:"1px"}}>{fmt(timerSecs)}</div>
          <div className="progress-bar" style={{marginTop:"4px"}}>
            <div className="progress-fill" style={{width:`${timerPct}%`,background:tech.color,transition:"width 1s"}}/>
          </div>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)",marginTop:"2px"}}>Cycle {cycle}/{tech.cycles}</div>
        </div>
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"0.8rem",textAlign:"center"}}>
          <div style={{fontSize:"0.6rem",color:"var(--text-muted)",marginBottom:"2px"}}>Session</div>
          <div style={{fontSize:"1.4rem",fontWeight:"800",letterSpacing:"1px"}}>{fmt(totalSecs)}</div>
          <div style={{fontSize:"0.6rem",color:"#f87171",marginTop:"2px"}}>{distCount} distr.</div>
        </div>
      </div>

      {isRunning&&expr.hint&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"1.1rem"}}>{expr.emoji}</span>
          <p style={{fontSize:"0.78rem",color:"var(--text-secondary)",margin:0}}>{expr.hint}</p>
          {exprType==="confused"&&<a href="/chat" style={{marginLeft:"auto",background:"var(--accent)",borderRadius:"var(--radius-sm)",padding:"4px 10px",fontSize:"0.72rem",color:"white",textDecoration:"none",fontWeight:"600",whiteSpace:"nowrap"}}>Ask AI</a>}
        </div>
      )}

      {isRunning&&(
        <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"1rem"}}>
          {Array.from({length:tech.cycles}).map((_,i)=>(
            <div key={i} style={{width:"8px",height:"8px",borderRadius:"50%",background:i<completedCycles?tech.color:"var(--bg-elevated)",border:`2px solid ${i===cycle-1&&timerPhase==="work"?tech.color:"transparent"}`,transition:"all 0.3s"}}/>
          ))}
        </div>
      )}

      {isRunning&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"0.8rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
            <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>Live focus trend</p>
            <div style={{display:"flex",gap:"2px"}}>{exprHistory.slice(-10).map((e,i)=><span key={i} style={{fontSize:"0.6rem"}}>{e}</span>)}</div>
          </div>
          <svg viewBox="0 0 300 40" style={{width:"100%",height:"40px"}}>
            <polyline points={history.map((v,i)=>`${(i/59)*300},${40-(v/100)*40}`).join(" ")} fill="none" stroke={sc(score)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {phase==="idle"&&roadmapWeeks.length>0&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:"1rem",marginBottom:"1rem"}}>
          <p style={{fontSize:"0.75rem",color:"var(--text-muted)",marginBottom:"8px",fontWeight:"500"}}>📍 What are you working on today?</p>
          <select value={selectedWeek} onChange={e=>{setSelectedWeek(Number(e.target.value));setSelectedTask(null)}} style={{width:"100%",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",color:"var(--text-primary)",padding:"8px 12px",fontSize:"0.82rem",outline:"none",marginBottom:"8px"}}>
            {roadmapWeeks.map((w:any,i:number)=>(
              <option key={i} value={w.week||i+1}>Week {w.week||i+1} — {(w.focus||"").substring(0,40)}...</option>
            ))}
          </select>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {currentWeekTasks.map((task:string,i:number)=>{
              const done=isTaskDone(i)
              return (
                <div key={i} onClick={()=>setSelectedTask(selectedTask===i?null:i)} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 10px",borderRadius:"var(--radius-md)",cursor:"pointer",background:selectedTask===i?"var(--accent-soft)":done?"rgba(62,207,142,0.06)":"var(--bg-elevated)",border:`1px solid ${selectedTask===i?"var(--accent-border)":done?"rgba(62,207,142,0.2)":"var(--border)"}`,transition:"all 0.2s"}}>
                  <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,background:done?"#3ecf8e":selectedTask===i?"var(--accent)":"transparent",border:`2px solid ${done?"#3ecf8e":selectedTask===i?"var(--accent)":"var(--text-muted)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"white",fontWeight:"700"}}>
                    {done?"✓":selectedTask===i?"✓":""}
                  </div>
                  <p style={{fontSize:"0.78rem",margin:0,color:done?"var(--text-muted)":selectedTask===i?"var(--text-primary)":"var(--text-secondary)",textDecoration:done?"line-through":"none"}}>{task}</p>
                </div>
              )
            })}
          </div>
          {selectedTask!==null&&<p style={{fontSize:"0.68rem",color:"#3ecf8e",marginTop:"6px",margin:0}}>✅ Auto marked done after 5+ min</p>}
        </div>
      )}

      {isRunning&&selectedTask!==null&&currentWeekTasks[selectedTask]&&(
        <div style={{background:"var(--bg-card)",border:`1px solid ${tech.color}22`,borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:"1rem"}}>
          <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>Working on:</p>
          <p style={{fontSize:"0.82rem",color:"var(--text-primary)",fontWeight:"500",margin:0}}>{currentWeekTasks[selectedTask]}</p>
        </div>
      )}

      {isRunning&&(
        <div style={{background:"var(--bg-card)",border:`1px solid ${tech.color}22`,borderRadius:"var(--radius-lg)",padding:"0.8rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"1.1rem"}}>{tech.emoji}</span>
              <div>
                <p style={{fontSize:"0.78rem",fontWeight:"600",margin:0}}>{tech.name}</p>
                <p style={{fontSize:"0.65rem",color:"var(--text-muted)",margin:0}}>{timerPhase==="work"?`${tech.shortBreak}min break coming up`:"Break — rest your eyes!"}</p>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:"0.78rem",fontWeight:"700",color:tech.color,margin:0}}>{completedCycles} done</p>
              <p style={{fontSize:"0.62rem",color:"var(--text-muted)",margin:0}}>cycles</p>
            </div>
          </div>
        </div>
      )}

      {phase==="idle"&&(
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"0.8rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"10px"}}>
          <span>🔲</span>
          <div>
            <p style={{fontSize:"0.78rem",fontWeight:"600",margin:0}}>Background Mode Available</p>
            <p style={{fontSize:"0.68rem",color:"var(--text-muted)",margin:0}}>Start session → tap BG → work in any app</p>
          </div>
        </div>
      )}

      {phase==="idle"&&(
        <button onClick={startSession} style={{width:"100%",padding:"14px",background:`linear-gradient(135deg,${tech.color},${tech.color}99)`,border:"none",borderRadius:"var(--radius-lg)",color:"white",fontSize:"1rem",fontWeight:"600",cursor:"pointer",boxShadow:`0 4px 20px ${tech.color}44`}}>
          {tech.emoji} Start {tech.name} Session
        </button>
      )}

      {phase==="loading"&&(
        <div style={{textAlign:"center",padding:"12px",color:"var(--text-muted)",fontSize:"0.85rem"}}>{loadMsg}</div>
      )}

      {isRunning&&(
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>{if(timerPhase==="work"){setTimerPhase("break");setPhase("break");setTimerSecs(tech.shortBreak*60)}else{setTimerPhase("work");setPhase("work");setTimerSecs(tech.work*60)}}} style={{flex:1,padding:"12px",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",color:"var(--text-secondary)",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem"}}>
            {timerPhase==="work"?"☕ Take Break":"🎯 Resume Work"}
          </button>
          <button onClick={endSession} style={{flex:1,padding:"12px",background:"#f87171",border:"none",borderRadius:"var(--radius-lg)",color:"white",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem"}}>
            End Session ✓
          </button>
        </div>
      )}
    </div>
  )
}
