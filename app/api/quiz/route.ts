import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { weekFocus, weekTasks, goalType, weekNumber } = await req.json()

    const prompt = `Generate exactly 5 multiple choice questions to test a student's understanding of this study week.

Week Focus: ${weekFocus}
Topics covered: ${weekTasks.join(", ")}
Goal type: ${goalType}
Week number: ${weekNumber}

Rules:
- Questions must be based ONLY on the topics listed above
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE correct answer per question
- Mix difficulty: 2 easy, 2 medium, 1 hard
- Make questions conceptual, not just definitions
- Each question must have a topic tag for weak area analysis

Return ONLY valid JSON in this exact format, no markdown:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "topic": "specific topic name",
      "difficulty": "easy|medium|hard",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correct": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system:     "You are an expert quiz generator. Always respond with valid JSON only. No markdown, no code fences, just raw JSON.",
      messages:   [{ role:"user", content:prompt }],
    })

    const text  = response.content[0].type==="text" ? response.content[0].text : ""
    const clean = text.replace(/```json\n?/gi,"").replace(/```\n?/g,"").trim()
    console.log("Quiz response preview:", clean.substring(0,200))
    let data
    try {
      data = JSON.parse(clean)
    } catch(parseErr) {
      console.error("JSON parse failed:", clean.substring(0,500))
      return NextResponse.json({ error:"Failed to parse quiz JSON" }, { status:500 })
    }
    if (!data.questions || data.questions.length === 0) {
      return NextResponse.json({ error:"No questions generated" }, { status:500 })
    }
    return NextResponse.json(data)
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status:500 })
  }
}