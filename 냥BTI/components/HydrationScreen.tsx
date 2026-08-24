export function HydrationScreen() {
  return (
    <main className="screen loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-paw" aria-hidden="true">🐾</div>
      <p>고양이의 기록을 불러오는 중이에요</p>
    </main>
  );
}
