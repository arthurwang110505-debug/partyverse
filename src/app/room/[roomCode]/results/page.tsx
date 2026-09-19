import type { Metadata } from "next";
import ResultsPage from "./ResultsPage";

export const metadata: Metadata = {
  title: "遊戲結果",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { roomCode: string } }) {
  return <ResultsPage roomCode={params.roomCode} />;
}
