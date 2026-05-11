import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    const response = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 8192, // ← much higher for full roadmap
      system:     "You are an expert study coach. Always respond with valid JSON only. No markdown, no code fences, no backticks, no explanation. Just raw JSON starting with { and ending with }.",
      messages:   [{ role:"user", content: prompt }],
    })

    const reply = response.content[0].type === "text"
      ? response.content[0].text : ""
    console.log("ROADMAP REPLY LENGTH:", reply.length)
    console.log("ROADMAP REPLY PREVIEW:", reply.substring(0, 200))
    return NextResponse.json({ reply })

  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status:500 })
  }
}