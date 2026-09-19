"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gamepad2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/games", label: "遊戲" },
  { href: "/join", label: "加入房間" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the mobile menu with Escape, and stop it trapping focus behind it.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <nav
      className={cn("fixed inset-x-0 top-0 z-50 px-4 py-4 transition-all duration-300", scrolled && "py-3")}
      aria-label="主導覽"
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-300",
          scrolled ? "glass-strong" : "glass",
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/20"
            aria-hidden="true"
          >
            <Gamepad2 className="h-4 w-4 text-white" />
          </span>
          <span lang="en" className="text-base font-bold tracking-wide">
            PARTYVERSE
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-2 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" aria-hidden="true" />
          <Link
            href="/games"
            className="ml-1 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium transition-all hover:bg-white/15"
          >
            開始遊戲
          </Link>
        </div>

        {/* Mobile menu toggle — a button, not a link wrapping a button */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "關閉選單" : "開啟選單"}
          className="rounded-xl p-2 transition-colors hover:bg-white/10 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-menu" className="glass-strong mt-2 flex flex-col gap-1 rounded-2xl p-3 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/games"
            onClick={() => setMobileOpen(false)}
            className="mt-1 rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-medium transition-all hover:bg-white/15"
          >
            開始遊戲
          </Link>
        </div>
      )}
    </nav>
  );
}
