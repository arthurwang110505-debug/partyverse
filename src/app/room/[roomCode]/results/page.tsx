import ResultsPage from "./ResultsPage";
export default function Page({ params }: { params: { roomCode: string } }) {
  return <ResultsPage roomCode={params.roomCode} />;
}
