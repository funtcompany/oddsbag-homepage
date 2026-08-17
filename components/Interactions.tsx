"use client";

import { useEffect } from "react";

/**
 * 화면 전체에 걸리는 «재미» 두 가지. 레이아웃에 한 번만 붙인다.
 *
 *   1) 마우스 포인터  — 노란 점(정확히 따라옴) + 보라 고리(살짝 늦게 따라옴)
 *      누를 수 있는 것 위에 올라가면 고리가 커지고 색이 찬다.
 *   2) 나타나기       — 스크롤이 닿은 요소(.ob-reveal)가 아래에서 떠오른다.
 *
 * ★안 켜지는 경우를 일부러 만들어 뒀다 (전부 정상 동작이다)
 *   · 손가락으로 쓰는 기기 → 포인터가 아예 없으니 그리지 않는다
 *   · 「움직임 줄이기」를 켠 사람 → 둘 다 끄고, 내용은 처음부터 다 보이게 둔다
 *   자바스크립트가 아예 안 돌아도 글은 전부 읽힌다 (.ob-reveal 은 관찰자가 없으면
 *   아래 useEffect 가 곧바로 is-in 을 붙여서 보이게 만든다).
 */
export default function Interactions() {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    // ── 1. 나타나기 ──
    const revealCleanup = setupReveal(reduced);

    // ── 2. 마우스 포인터 ──
    if (reduced || coarse) return revealCleanup;
    const cursorCleanup = setupCursor();

    return () => {
      revealCleanup?.();
      cursorCleanup?.();
    };
  }, []);

  return null;
}

// ───────────────────────────────────────────────
function setupReveal(reduced: boolean): (() => void) | undefined {
  const show = (el: Element) => el.classList.add("is-in");

  // 움직임을 줄여달라고 했거나 관찰자가 없는 브라우저 → 그냥 전부 보이게
  if (reduced || typeof IntersectionObserver === "undefined") {
    document.querySelectorAll(".ob-reveal").forEach(show);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // 같은 줄에 있는 카드들이 도미노처럼 차례로 뜨게 살짝 시간차를 준다
        const i = Number((e.target as HTMLElement).dataset.revealIndex ?? 0);
        (e.target as HTMLElement).style.transitionDelay = `${Math.min(i, 7) * 60}ms`;
        show(e.target);
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
  );

  const watch = () =>
    document
      .querySelectorAll(".ob-reveal:not(.is-in)")
      .forEach((el) => io.observe(el));

  watch();

  // 페이지를 옮겨 다녀도(클라이언트 이동) 새로 그려진 것을 다시 잡는다
  const mo = new MutationObserver(() => watch());
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    io.disconnect();
    mo.disconnect();
  };
}

// ───────────────────────────────────────────────
function setupCursor(): () => void {
  const dot = document.createElement("div");
  dot.className = "ob-cursor-dot";
  const ring = document.createElement("div");
  ring.className = "ob-cursor-ring";
  // ★마우스를 아직 한 번도 안 움직였을 때는 그리지 않는다.
  //  안 그러면 화면 한가운데에 점과 고리가 덩그러니 떠 있다 (검수 스크린샷에서 잡힘).
  //  첫 움직임이 있어야 «포인터가 여기 있다»는 말이 되기 때문이다.
  dot.style.opacity = "0";
  ring.style.opacity = "0";
  document.body.append(dot, ring);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let raf = 0;
  let alive = true;
  let seen = false;

  const onMove = (e: MouseEvent) => {
    mx = e.clientX;
    my = e.clientY;
    if (!seen) {
      // 첫 움직임 — 고리를 점 자리에 붙여 두고(안 그러면 화면 가운데에서 날아온다) 보여준다
      seen = true;
      rx = mx;
      ry = my;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    }
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;

    // 무엇 위에 올라가 있나 — 링크·버튼은 1, 큰 배너·카드는 2(노란 원)
    const el = e.target as HTMLElement | null;
    const hot = el?.closest?.(
      'a, button, [role="button"], input, select, textarea, summary, label[for]',
    );
    const big = el?.closest?.("[data-cursor='big']");
    ring.dataset.hot = big ? "2" : hot ? "1" : "0";
  };

  const onDown = () => (dot.dataset.down = "1");
  const onUp = () => (dot.dataset.down = "0");
  const onLeave = () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  };
  const onEnter = () => {
    if (!seen) return; // 아직 한 번도 안 움직였으면 계속 숨겨 둔다
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  };

  // 고리는 점을 «따라잡는» 식으로 움직인다 — 살짝 늦게 붙는 느낌
  const tick = () => {
    if (!alive) return;
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("mousedown", onDown);
  window.addEventListener("mouseup", onUp);
  document.addEventListener("mouseleave", onLeave);
  document.addEventListener("mouseenter", onEnter);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mousedown", onDown);
    window.removeEventListener("mouseup", onUp);
    document.removeEventListener("mouseleave", onLeave);
    document.removeEventListener("mouseenter", onEnter);
    dot.remove();
    ring.remove();
  };
}
