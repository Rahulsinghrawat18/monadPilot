"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Trophy, GitFork, Globe, ArrowLeft, Loader2, Sparkles } from "lucide-react";

export default function ShowcasePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [event, setEvent] = useState("");
  const [category, setCategory] = useState("");
  const [winners, setWinners] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchProjects = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (event) params.set("event", event);
    if (category) params.set("category", category);
    if (winners) params.set("winners", "true");
    params.set("limit", "100");

    fetch(`/api/showcase?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    // Debounce/transition updates
    const timer = setTimeout(() => {
      startTransition(() => {
        fetchProjects();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, event, category, winners]);

  return (
    <div className="min-h-screen bg-[#0c0a1c] text-foreground relative pb-20 overflow-hidden">
      {/* Background patterns */}
      <div className="gradient-mesh absolute inset-0 opacity-40 -z-20" />
      <div className="pixel-grid absolute inset-0 opacity-30 -z-10" />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-pixel-bold text-[14px] text-foreground tracking-wider uppercase">
              monadPilot
            </span>
          </Link>
          <Link
            href="/"
            className="font-pixel text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Terminal
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="text-center relative">
          <div className="font-pixel inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/[0.08] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> Blitz Hackathons
          </div>
          <h1 className="font-pixel-bold mt-4 text-[26px] tracking-[0.04em] sm:text-[38px] text-white">
            MONAD BLITZ SHOWCASE
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-muted-foreground">
            Explore the cutting-edge protocols, agentic workflows, on-chain games, and scaling solutions built during Monad Blitz Hackathons.
          </p>
        </div>

        {/* Filter Controls Panel */}
        <section className="mt-8 rounded-2xl border border-border bg-[#14112e]/80 p-5 backdrop-blur-lg shadow-xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#1c1842] pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-pixel text-[11px]"
              />
            </div>

            {/* Event Slug Selector */}
            <div>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#1c1842] px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-pixel text-[10px] uppercase tracking-wider"
              >
                <option value="">All Events</option>
                <option value="blitz-ankara-27-Jun">Monad Blitz Ankara</option>
                <option value="monad-blitz-mumbai-v3">Monad Blitz Mumbai V3</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#1c1842] px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-pixel text-[10px] uppercase tracking-wider"
              >
                <option value="">All Categories</option>
                <option value="DeFi">DeFi</option>
                <option value="Gaming">Gaming / GameFi</option>
                <option value="AI Agents">AI Agents</option>
                <option value="SocialFi">SocialFi</option>
                <option value="NFT">NFT</option>
                <option value="DePIN">DePIN</option>
                <option value="Payments">Payments</option>
              </select>
            </div>
          </div>

          {/* Winners filter */}
          <div className="mt-4 flex items-center justify-between border-t border-border/20 pt-4">
            <label className="flex items-center gap-2 cursor-pointer font-pixel text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={winners}
                onChange={(e) => setWinners(e.target.checked)}
                className="rounded border-border bg-[#1c1842] text-primary focus:ring-primary h-4.5 w-4.5 cursor-pointer accent-[#836efd]"
              />
              Show Winners Only
            </label>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-muted-foreground">
              {loading || isPending ? "Syncing..." : `${total} projects loaded`}
            </div>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="mt-8">
          {loading || isPending ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-pixel mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                Retrieving Showcase Projects...
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-[#14112e]/40">
              <p className="font-pixel text-sm text-muted-foreground uppercase tracking-widest">
                No matching projects found
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setEvent("");
                  setCategory("");
                  setWinners(false);
                }}
                className="mt-4 font-pixel text-[10px] uppercase bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-all"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p: any) => (
                <div
                  key={p.id}
                  className="group flex flex-col rounded-2xl border border-border bg-[#14112e]/60 hover:bg-[#14112e]/90 hover:border-primary/50 transition-all duration-300 shadow-lg relative overflow-hidden"
                >
                  {/* Category and Event Tags Header */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-3 mb-4">
                      <span className="font-pixel text-[9px] uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full">
                        {p.category || "General"}
                      </span>
                      <span className="font-pixel text-[8px] uppercase tracking-wider text-muted-foreground">
                        {p.event?.name || "Blitz Event"}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-pixel-bold text-sm tracking-wide text-white group-hover:text-primary transition-colors">
                        {p.title}
                      </h3>
                      {p.is_winner && (
                        <span
                          className="shrink-0 p-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500"
                          title="Winner"
                        >
                          <Trophy className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 mt-1">
                      {p.description}
                    </p>

                    {/* Team Members */}
                    {p.team_members && (
                      <div className="mt-4 pt-3 border-t border-border/10">
                        <span className="font-pixel text-[8px] uppercase tracking-widest text-muted-foreground block">
                          Builders
                        </span>
                        <span className="text-[11px] text-foreground font-semibold">
                          {p.team_members}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="flex border-t border-border/20 bg-[#1c1842]/30 divide-x divide-border/20 py-3 text-center">
                    {p.github_url ? (
                      <a
                        href={p.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 font-pixel text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <GitFork className="h-3.5 w-3.5" /> Source
                      </a>
                    ) : (
                      <span className="flex-1 font-pixel text-[9px] uppercase tracking-wider text-muted-foreground/30 select-none">
                        No Code
                      </span>
                    )}

                    {p.demo_url ? (
                      <a
                        href={p.demo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 font-pixel text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5" /> Demo Live
                      </a>
                    ) : (
                      <span className="flex-1 font-pixel text-[9px] uppercase tracking-wider text-muted-foreground/30 select-none">
                        No Demo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
