import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton — only one instance ever created
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }

// ── Auth helpers ────────────────────────────────────────────────
export async function signUp(email: string, password: string, name: string, goal: string, dailyHours: number) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, goal, daily_hours: dailyHours } }
  })

  // If auth succeeded but profile trigger may have failed, upsert manually
  if (!error && data.user) {
    await supabase.from("profiles").upsert({
      id:    data.user.id,
      email: email,
      name:  name,
    }, { onConflict: "id" })
  }

  return { data, error }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  return data
}

// ── Session helpers ─────────────────────────────────────────────
export async function saveSession(session: {
  user_id: string
  subject?: string
  duration_minutes: number
  focus_score: number
  distractions: number
  avg_expression?: string
}) {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert(session)
    .select()
    .single()
  return { data, error }
}

export async function getSessions(userId: string, limit = 20) {
  const { data } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data || []
}

// ── Goal helpers ────────────────────────────────────────────────
export async function getGoals(userId: string) {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  return data || []
}

export async function addGoal(goal: {
  user_id: string
  title: string
  subject: string
  target_hours: number
  deadline: string
}) {
  const { data, error } = await supabase
    .from("goals")
    .insert(goal)
    .select()
    .single()
  return { data, error }
}

export async function updateGoalHours(id: string, completed_hours: number, completed: boolean) {
  const { error } = await supabase
    .from("goals")
    .update({ completed_hours, completed })
    .eq("id", id)
  return { error }
}

export async function deleteGoal(id: string) {
  await supabase.from("goals").delete().eq("id", id)
}

// ── Roadmap helpers ─────────────────────────────────────────────
export async function saveRoadmap(userId: string, roadmap: any, goalType: string, goalDetails: any) {
  const { error } = await supabase
    .from("profiles")
    .update({
      roadmap,
      goal_type:          goalType,
      goal_details:       goalDetails,
      roadmap_generated:  true
    })
    .eq("id", userId)
  return { error }
}

export async function getRoadmap(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("roadmap, goal_type, goal_details, roadmap_generated")
    .eq("id", userId)
    .single()
  return data
}

export async function updateProfile(userId: string, updates: any) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
  return { error }
}

// ── Roadmap progress helpers ────────────────────────────────────
export async function getProgress(userId: string) {
  const { data } = await supabase
    .from("roadmap_progress")
    .select("*")
    .eq("user_id", userId)
  return data || []
}

export async function toggleTask(
  userId: string,
  weekNumber: number,
  taskIndex: number,
  completed: boolean
) {
  const { data: existing } = await supabase
    .from("roadmap_progress")
    .select("id")
    .eq("user_id",     userId)
    .eq("week_number", weekNumber)
    .eq("task_index",  taskIndex)
    .single()

  if (existing) {
    await supabase
      .from("roadmap_progress")
      .update({ completed, completed_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await supabase
      .from("roadmap_progress")
      .insert({ user_id:userId, week_number:weekNumber, task_index:taskIndex, completed })
  }
}

export async function updateCurrentWeek(userId: string, week: number) {
  await supabase
    .from("profiles")
    .update({ current_week: week })
    .eq("id", userId)
}

export async function getCurrentWeek(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("current_week")
    .eq("id", userId)
    .single()
  return data?.current_week || 1
}

// ── Quiz helpers ────────────────────────────────────────────────
export async function getWeekQuiz(userId: string, weekNumber: number) {
  const { data } = await supabase
    .from("week_quizzes")
    .select("*")
    .eq("user_id",    userId)
    .eq("week_number", weekNumber)
    .maybeSingle()
  return data
}

export async function saveWeekQuiz(userId: string, weekNumber: number, questions: any) {
  const { data } = await supabase
    .from("week_quizzes")
    .upsert({ user_id:userId, week_number:weekNumber, questions })
    .select()
    .maybeSingle()
  return data
}

export async function getTodayAttempts(userId: string, weekNumber: number) {
  const today = new Date()
  today.setHours(0,0,0,0)
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id",     userId)
    .eq("week_number", weekNumber)
    .gte("attempted_at", today.toISOString())
  return data || []
}

export async function saveQuizAttempt(userId: string, weekNumber: number, score: number, answers: any, passed: boolean) {
  const { data } = await supabase
    .from("quiz_attempts")
    .insert({ user_id:userId, week_number:weekNumber, score, answers, passed })
    .select()
    .single()
  return data
}

export async function getLastPassedAttempt(userId: string, weekNumber: number) {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id",    userId)
    .eq("week_number", weekNumber)
    .eq("passed",     true)
    .order("attempted_at", { ascending:false })
    .limit(1)
    .single()
  return data
}
// ── Message limit helpers ───────────────────────────────────────
export async function getMessageCount(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("messages_lifetime_used")
    .eq("id", userId)
    .single()
  return data?.messages_lifetime_used || 0
}

export async function incrementMessageCount(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("messages_lifetime_used")
    .eq("id", userId)
    .single()
  
  const current = data?.messages_lifetime_used || 0
  await supabase
    .from("profiles")
    .update({ messages_lifetime_used: current + 1 })
    .eq("id", userId)
  
  return current + 1
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  return { error }
}

// ── Daily task helpers ───────────────────────────────────────────
export async function getDailyTasks(userId: string, date: string) {
  const { data } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true })
  return data || []
}

export async function createDailyTasks(tasks: any[]) {
  const { data } = await supabase
    .from("daily_tasks")
    .insert(tasks)
    .select()
  return data || []
}

export async function toggleDailyTask(taskId: string, completed: boolean) {
  await supabase
    .from("daily_tasks")
    .update({ completed })
    .eq("id", taskId)
}

export async function getWeeklyDailyTasks(userId: string, weekNumber: number) {
  const { data } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id",    userId)
    .eq("week_number", weekNumber)
    .order("date", { ascending: true })
  return data || []
}

export async function carryOverTasks(userId: string, fromDate: string, toDate: string) {
  const { data: unfinished } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id",   userId)
    .eq("date",      fromDate)
    .eq("completed", false)
  
  if (!unfinished || unfinished.length === 0) return

  const carried = unfinished.map(t => ({
    user_id:      userId,
    week_number:  t.week_number,
    date:         toDate,
    topic:        t.topic,
    description:  t.description,
    hours:        t.hours,
    completed:    false,
    carried_over: true,
  }))

  await supabase.from("daily_tasks").insert(carried)
}

// ── Daily checkin helpers ────────────────────────────────────────
export async function getDailyCheckin(userId: string, date: string) {
  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("date",    date)
    .maybeSingle()
  return data
}

export async function saveDailyCheckin(
  userId: string, date: string,
  status: string, completedTasks: number,
  totalTasks: number, note?: string
) {
  const { data } = await supabase
    .from("daily_checkins")
    .upsert({ user_id:userId, date, status, completed_tasks:completedTasks, total_tasks:totalTasks, note })
    .select()
    .single()
  return data
}

export async function getCheckinHistory(userId: string, days: number) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("user_id", userId)
    .gte("date",   from.toISOString().split("T")[0])
    .order("date", { ascending: false })
  return data || []
}
