import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, system } = await req.json()

    const response = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 2048,
      system:     system || "You are StudyBuddy, a helpful AI tutor. Answer questions clearly and encourage the user.",
      messages,
    })

    const reply = response.content[0].type === "text"
      ? response.content[0].text
      : "Sorry I could not generate a response."

    return NextResponse.json({ reply })

  } catch (error: any) {
    console.error("API Error:", error?.message)
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status:500 })
  }
}