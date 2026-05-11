import { NextRequest, NextResponse } from "next/server"

// ── Rule based daily task splitter (zero API cost!) ─────────────
export async function POST(req: NextRequest) {
  try {
    const { weekTasks, hoursPerDay, weekNumber, startDate, goalType, weekFocus } = await req.json()

    const tasks: any[] = []
    const start = new Date(startDate)

    // Split week tasks across 5 working days
    const workDays = 5
    const totalTasks = weekTasks.length

    // Distribute tasks across days
    weekTasks.forEach((task: string, taskIdx: number) => {
      const dayIndex = Math.floor((taskIdx / totalTasks) * workDays)
      const date = new Date(start)
      date.setDate(date.getDate() + dayIndex)
      const dateStr = date.toISOString().split("T")[0]

      // Split task into sub-topics
      const subTopics = generateSubTopics(task, goalType)

      subTopics.forEach((sub, subIdx) => {
        tasks.push({
          week_number:  weekNumber,
          date:         dateStr,
          topic:        sub.topic,
          description:  sub.description,
          hours:        Math.round((hoursPerDay / subTopics.length) * 10) / 10,
          completed:    false,
          carried_over: false,
        })
      })
    })

    // Day 6 (Saturday) → Revision
    const revisionDate = new Date(start)
    revisionDate.setDate(revisionDate.getDate() + 5)
    tasks.push({
      week_number:  weekNumber,
      date:         revisionDate.toISOString().split("T")[0],
      topic:        "Weekly Revision",
      description:  `Revise all topics from this week: ${weekFocus}`,
      hours:        hoursPerDay * 0.5,
      completed:    false,
      carried_over: false,
    })

    return NextResponse.json({ tasks })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status:500 })
  }
}

// ── Smart sub-topic generator ────────────────────────────────────
function generateSubTopics(task: string, goalType: string): { topic: string; description: string }[] {
  const task_lower = task.toLowerCase()

  // NCERT chapter detection
  if (task_lower.includes("ncert") || task_lower.includes("chapter")) {
    return [
      { topic: "Read & Understand",  description: `Read ${task} carefully` },
      { topic: "Notes & Summary",    description: `Make notes for ${task}` },
      { topic: "Practice Questions", description: `Solve questions from ${task}` },
    ]
  }

  // History/Geography/Polity
  if (task_lower.includes("history")||task_lower.includes("geography")||task_lower.includes("polity")) {
    return [
      { topic: "Concept Reading",   description: `Read and understand ${task}` },
      { topic: "Key Points",        description: `Note important facts from ${task}` },
      { topic: "Mind Map",          description: `Create mind map for ${task}` },
    ]
  }

  // Math/Physics/Chemistry
  if (task_lower.includes("math")||task_lower.includes("physics")||task_lower.includes("chemistry")) {
    return [
      { topic: "Theory & Concepts", description: `Understand theory of ${task}` },
      { topic: "Solved Examples",   description: `Study solved examples in ${task}` },
      { topic: "Practice Problems", description: `Solve practice problems from ${task}` },
    ]
  }

  // Coding
  if (goalType==="coding") {
    return [
      { topic: "Learn Concept",   description: `Study ${task}` },
      { topic: "Practice Code",   description: `Write code for ${task}` },
      { topic: "Build & Debug",   description: `Build small project using ${task}` },
    ]
  }

  // Revision tasks
  if (task_lower.includes("revise")||task_lower.includes("revision")||task_lower.includes("review")) {
    return [
      { topic: "Quick Revision",  description: task },
      { topic: "Practice Test",   description: `Test yourself on ${task}` },
    ]
  }

  // Default — split into 2 sub-topics
  return [
    { topic: "Study & Understand", description: task },
    { topic: "Review & Practice",  description: `Practice and revise ${task}` },
  ]
}