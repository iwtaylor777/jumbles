import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="min-h-full flex flex-col">
      <Game />
      <footer
        className="text-center text-xs pb-8 mt-auto"
        style={{ color: "var(--muted)" }}
      >
        A new word puzzle every day.
      </footer>
    </main>
  );
}
