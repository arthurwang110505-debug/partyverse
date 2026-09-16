import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Loading...</div>
      </div>
    }>
      <JoinClient />
    </Suspense>
  );
}
