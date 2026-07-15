"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface Task {
  id: number;
  text: string;
  due: string;
  completed: boolean;
  status: "pending" | "completed";
}

interface TaskFormState {
  id: number | null;
  text: string;
  due: string;
}

const emptyForm: TaskFormState = { id: null, text: "", due: "Today" };

type FilterKey = "all" | "pending" | "completed";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter === "pending" && task.completed) return false;
      if (filter === "completed" && !task.completed) return false;
      if (!q) return true;
      return task.text.toLowerCase().includes(q) || task.due.toLowerCase().includes(q);
    });
  }, [tasks, search, filter]);

  const activeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setForm({ id: task.id, text: task.text, due: task.due });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setForm(emptyForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.text.trim() || isSaving) return;

    setIsSaving(true);
    try {
      if (form.id === null) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: form.text, due: form.due || "Today" }),
        });
      } else {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: form.id, text: form.text, due: form.due }),
        });
      }
      await fetchTasks();
      setIsModalOpen(false);
      setForm(emptyForm);
    } catch (e) {
      console.error("Failed to save task:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (task: Task) => {
    const nextCompleted = !task.completed;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: nextCompleted, status: nextCompleted ? "completed" : "pending" }
          : t
      )
    );
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completed: nextCompleted }),
      });
      fetchTasks();
    } catch (e) {
      console.error("Failed to toggle task status:", e);
    }
  };

  const confirmDelete = (taskId: number) => setPendingDeleteId(taskId);
  const cancelDelete = () => setPendingDeleteId(null);

  const executeDelete = async () => {
    if (pendingDeleteId === null) return;
    const taskId = pendingDeleteId;
    setPendingDeleteId(null);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      fetchTasks();
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 antialiased overflow-x-hidden min-h-screen">
      {/* Header/Nav Bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-tighter">N</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-800">
              NoteSphere <span className="text-[10px] text-slate-400 font-medium ml-1">v1.0</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <Link href="/notes" className="hover:text-slate-900 transition-colors">
              Notes
            </Link>
            <span className="text-slate-900">Tasks</span>
          </nav>
        </div>
      </header>

      <section className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Page title + toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Tasks</h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeCount} active of {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full sm:w-64 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder-slate-400"
              />
            </div>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mb-6">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === f.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content states */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 h-14 animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-3.5 rounded-lg border group/item hover:bg-slate-50 transition-all ${
                  task.completed
                    ? "bg-slate-50/50 border-slate-100 text-slate-400"
                    : "bg-white border-slate-200/80 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggle(task)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <p className={`text-sm font-medium leading-tight ${task.completed ? "line-through" : ""}`}>
                      {task.text}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Due: {task.due}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      task.completed ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {task.status}
                  </span>
                  <button
                    onClick={() => openEditModal(task)}
                    className="text-slate-300 hover:text-indigo-600 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                    title="Edit Task"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => confirmDelete(task.id)}
                    className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
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
        ) : tasks.length > 0 ? (
          /* No results for search/filter */
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-12 text-center bg-white">
            <svg className="w-8 h-8 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-semibold text-slate-600">No tasks match your filters</p>
            <button
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-2 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-16 text-center bg-white">
            <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-semibold text-slate-600">No tasks yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Create your first task to start tracking your to-dos.
            </p>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer mt-4"
            >
              Create a task
            </button>
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">{form.id === null ? "New Task" : "Edit Task"}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1" title="Close">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Task</label>
                <input
                  type="text"
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="What needs to be done?"
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Due</label>
                <input
                  type="text"
                  value={form.due}
                  onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                  placeholder="e.g. Today, Friday, 2026-07-20"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.text.trim() || isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  {isSaving ? "Saving..." : form.id === null ? "Create Task" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDeleteId !== null && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={cancelDelete}
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-bold text-slate-800 mb-1">Delete this task?</h2>
            <p className="text-xs text-slate-500 mb-4">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
