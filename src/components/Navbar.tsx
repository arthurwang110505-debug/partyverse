"use client";

import Link from "next/link";
import { Gamepad2, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-4 py-4 transition-all duration-300 ${scrolled ? "py-3" : ""}`}>
      <div className={`max-w-7xl mx-auto rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-300 ${scrolled ? "glass-strong" : "glass"}`}>
        <Link href="/" prefetch className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Gamepad2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-wide">PARTYVERSE</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/games" className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all" prefetch>
            Games
          </Link>
          <Link href="/join" className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all" prefetch>
            Join
          </Link>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <Link href="/games" prefetch>
            <button className="ml-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition-all">
              Start Playing
            </button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden mt-2 glass-strong rounded-2xl p-3 flex flex-col gap-1">
          <Link href="/games" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-all text-sm font-medium" prefetch>
            Games
          </Link>
          <Link href="/join" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-all text-sm font-medium" prefetch>
            Join
          </Link>
          <Link href="/games" onClick={() => setMobileOpen(false)} prefetch className="mt-1">
            <button className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium">
              Start Playing
            </button>
          </Link>
        </div>
      )}
    </nav>
  );
}
