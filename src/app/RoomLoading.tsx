/** Shared skeleton for the room/create segments while they resolve. */
export default function RoomLoading({ label = "載入中" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <p className="animate-pulse text-white/50" role="status">
        {label}…
      </p>
    </div>
  );
}
