"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Task {
  id: number;
  text: string;
  due: string;
  completed: boolean;
  status: "pending" | "completed";
}

interface Note {
  id: number;
  title: string;
  preview: string;
  tags: string[];
}

interface ChatMessage {
  sender: "user" | "assistant";
  text: string;
  trace?: string[];
}

interface SummaryStats {
  tasksDueToday: number;
  tasksPending: number;
  notesToday: number;
  totalNotes: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notesList, setNotesList] = useState<Note[]>([]);

  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [summaryDate, setSummaryDate] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const fetchNotes = async () => {
    try {
      setIsLoadingNotes(true);
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotesList(data);
      }
    } catch (e) {
      console.error("Error fetching notes:", e);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setIsLoadingSummary(true);
      setSummaryError("");
      const res = await fetch("/api/summary");
      const data = await res.json();
      if (data.error) {
        setSummaryError(data.error);
      } else {
        setSummary(data.summary || "");
        setSummaryStats(data.stats || null);
        setSummaryDate(data.date || "");
      }
    } catch (e) {
      console.error("Error fetching summary:", e);
      setSummaryError("Couldn't reach the summary service.");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchTasks();
    fetchSummary();
  }, []);

  const quickActions = [
    { label: "Add task to read paper", placeholder: "add task read paper on neural networks due friday" },
    { label: "Show today's agenda", placeholder: "what are my active tasks for today?" },
    { label: "Create a note for project ideas", placeholder: "create a note Project Ideas: build a local markdown calendar" },
    { label: "Search my notes", placeholder: "search notes for project ideas" }
  ];

  const handleQuickAction = (placeholder: string) => {
    setQuery(placeholder);
  };

  const handleTaskToggle = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;

    // Optimistic UI update
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, completed: nextCompleted, status: nextCompleted ? "completed" : "pending" }
          : t
      )
    );

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, completed: nextCompleted })
      });
      fetchTasks();
    } catch (e) {
      console.error("Failed to toggle task status:", e);
    }
  };

  const deleteTask = async (taskId: number) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      fetchTasks();
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  };

  const deleteNote = async (noteId: number) => {
    setNotesList(prev => prev.filter(note => note.id !== noteId));
    try {
      await fetch(`/api/notes?id=${noteId}`, { method: "DELETE" });
      fetchNotes();
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSending) return;

    const userMsg = query.trim();
    setChatHistory(prev => [...prev, { sender: "user", text: userMsg }]);
    setQuery("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg, history: chatHistory })
      });
      const data = await res.json();

      setChatHistory(prev => [
        ...prev,
        { sender: "assistant", text: data.text || data.error || "Processed", trace: data.trace || [] }
      ]);

      fetchNotes();
      fetchTasks();
    } catch (e: any) {
      console.error("Error communicating with chat API:", e);
      setChatHistory(prev => [
        ...prev,
        { sender: "assistant", text: `Connection error: ${e.message}`, trace: ["Failed connection"] }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 antialiased overflow-x-hidden min-h-screen">

      {/* 1. Header/Nav Bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Minimal logo inspired by Notion/Linear */}
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-tighter">N</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-800">
              NoteSphere
            </span>
          </div>

          <nav className="flex items-center gap-6 text-xs font-semibold text-slate-500">
            <Link href="/tasks" className="hover:text-slate-900 transition-colors">Tasks</Link>
            <Link href="/notes" className="hover:text-slate-900 transition-colors">Notes</Link>
          </nav>
        </div>
      </header>

      {/* Hero & Prompt Core Section */}
      <section className="bg-white border-b border-slate-200/60 py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">

          {/* 2. Hero Header */}
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            Conversational Productivity
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mb-8 max-w-xl mx-auto">
            Your tasks and notes, managed by conversation. Just chat with your assistant to schedule tasks, search your notes, or jot down new ideas.
          </p>

          {/* 3. Main Chat Prompt Core */}
          <div className="mb-6 relative">
            <form onSubmit={handleSubmit} className="relative bg-white border border-slate-200 rounded-xl shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all duration-200 max-w-2xl mx-auto flex items-center p-1">
              <div className="pl-3 text-slate-400 flex items-center pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask assistant or add items, e.g., 'add task Buy milk tomorrow'"
                className="w-full bg-transparent px-3 py-3 text-sm border-0 focus:outline-none focus:ring-0 text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer ml-1"
              >
                Send Request
              </button>
            </form>
          </div>

          {/* 4. Quick Action Row Chips */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl mx-auto">
            {quickActions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickAction(action.placeholder)}
                className="text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Today's Summary */}
      <section className="bg-slate-50 py-8 border-b border-slate-200/50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <h2 className="text-sm font-bold text-slate-800">Today&rsquo;s Summary</h2>
                {summaryDate && (
                  <span className="text-[10px] text-slate-400 font-medium">{summaryDate}</span>
                )}
              </div>
              <button
                onClick={fetchSummary}
                disabled={isLoadingSummary}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isLoadingSummary ? "Generating..." : "Refresh"}
              </button>
            </div>

            {isLoadingSummary ? (
              <div className="flex flex-col gap-2 animate-pulse">
                <div className="h-3 w-full bg-indigo-100/70 rounded" />
                <div className="h-3 w-4/5 bg-indigo-100/70 rounded" />
              </div>
            ) : summaryError ? (
              <p className="text-sm text-slate-400">{summaryError}</p>
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">{summary}</p>
            )}

            {summaryStats && !isLoadingSummary && !summaryError && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-indigo-100">
                <span className="text-[9px] font-semibold bg-white text-slate-500 border border-indigo-100 px-2 py-1 rounded-full">
                  {summaryStats.tasksDueToday} due today
                </span>
                <span className="text-[9px] font-semibold bg-white text-slate-500 border border-indigo-100 px-2 py-1 rounded-full">
                  {summaryStats.tasksPending} pending
                </span>
                <span className="text-[9px] font-semibold bg-white text-slate-500 border border-indigo-100 px-2 py-1 rounded-full">
                  {summaryStats.notesToday} notes today
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Chat history */}
      {chatHistory.length > 0 && (
        <section className="bg-slate-50 py-6 border-b border-slate-200/50">
          <div className="max-w-2xl mx-auto px-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Conversation</span>
              <button
                onClick={() => setChatHistory([])}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-medium"
              >
                Clear
              </button>
            </div>
            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${item.sender === "user"
                  ? "bg-slate-100/55 border-slate-200 text-slate-700"
                  : "bg-white border-slate-200/70"
                  }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.sender === "user" ? "bg-slate-400" : "bg-indigo-500"}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.sender === "user" ? "You" : "Assistant"}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Two-Panel Layout */}
      <section id="panels-section" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

          {/* Left panel: Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h2 className="text-sm font-bold text-slate-800">Tasks</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {tasks.filter(t => !t.completed).length} active
                </span>
                <Link
                  href="/tasks"
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Manage all &rarr;
                </Link>
              </div>
            </div>

            {/* Scrollable list */}
            {tasks.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px] pr-1">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3 rounded-lg border group/item hover:bg-slate-50 transition-all ${task.completed
                      ? "bg-slate-50/50 border-slate-100 text-slate-400"
                      : "bg-white border-slate-200/80 text-slate-700"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleTaskToggle(task.id)}
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <p className={`text-xs font-medium leading-tight ${task.completed ? "line-through" : ""}`}>
                          {task.text}
                        </p>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Due: {task.due}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${task.completed
                        ? "bg-slate-100 text-slate-400"
                        : "bg-indigo-50 text-indigo-600"
                        }`}>
                        {task.status}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-slate-300 hover:text-slate-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                        title="Delete Task"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 6. Tasks Empty State */
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50">
                <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs font-semibold text-slate-600">No tasks yet</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">
                  Try asking the assistant: <br />
                  <span className="font-semibold text-slate-500">"add task Review report due tomorrow"</span>
                </p>
              </div>
            )}
          </div>

          {/* Right panel: Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-sm font-bold text-slate-800">Recent Notes</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {notesList.length} items
                </span>
                <Link
                  href="/notes"
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Manage all &rarr;
                </Link>
              </div>
            </div>

            {/* Scrollable grid/list */}
            {notesList.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[320px] pr-1">
                {notesList.map(note => (
                  <div key={note.id} className="p-3.5 rounded-lg border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition-all group/note relative">
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="absolute top-3 right-3 text-slate-350 hover:text-slate-500 opacity-0 group-hover/note:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Note"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <h3 className="text-xs font-bold text-slate-800 mb-1">{note.title}</h3>
                    <p className="text-[11px] text-slate-500 leading-normal line-clamp-3">
                      {note.preview}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {note.tags.map((tag, tagIdx) => (
                        <span
                          key={tagIdx}
                          className="text-[9px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 6. Notes Empty State */
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50">
                <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v3m2 4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <p className="text-xs font-semibold text-slate-600">No notes yet</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[190px]">
                  Instruct the assistant: <br />
                  <span className="font-semibold text-slate-500">"create a note Meeting Agenda: discuss designs"</span>
                </p>
                <Link
                  href="/notes"
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 mt-2 transition-colors"
                >
                  or create one manually &rarr;
                </Link>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* 7. Footer & Connection Dot */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              Assistant connected
            </span>
          </div>

          <div className="text-[10px] text-slate-400">
            &copy; {new Date().getFullYear()} NoteSphere. Minimal task and note managing framework.
          </div>
        </div>
      </footer>

    </div>
  );
}
