"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Gamepad2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

// One action per destination, shared by both layouts.
const LINKS = [
  { href: "/games", label: "遊戲", className: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200" },
  { href: "/join", label: "加入房間", className: "border-rose-400/40 bg-rose-500/15 text-rose-200" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) setMobileOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileOpen]);

  const links = LINKS.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      onClick={() => setMobileOpen(false)}
      aria-current={pathname === link.href ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-white/15",
        link.className,
      )}
    >
      {link.label}
    </Link>
  ));

  return (
    <nav ref={nav} className="site-nav fixed inset-x-0 top-0 z-50 px-3 pb-3 sm:px-4" aria-label="主導覽">
      <div className="nav-surface mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2.5 sm:px-5">
        <Link href="/" aria-label="PARTYVERSE 首頁" className="group flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-rose-500 ring-1 ring-white/20"
            aria-hidden="true"
          >
            <Gamepad2 className="h-5 w-5 text-white" />
          </span>
          <span lang="en" className="text-base font-black tracking-wider sm:text-lg">
            <span className="text-cyan-400">PARTY</span>
            <span className="text-rose-400">VERSE</span>
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">{links}</div>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? "mobile-menu" : undefined}
          aria-label={mobileOpen ? "關閉選單" : "開啟選單"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/10 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="nav-surface mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 p-3 md:hidden"
        >
          {links}
        </div>
      )}
    </nav>
  );
}
