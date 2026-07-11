export default function Footer() {
  return (
    <footer className="mt-auto border-t border-oddsbag-light-gray bg-oddsbag-dark text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black text-white">ODDSBAG</span>
          <span className="text-sm font-bold text-oddsbag-yellow">오즈백</span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          이상하게 필요한 것들, 오즈백에 다 있어
        </p>
        <div className="mt-6 flex flex-col gap-1 text-xs text-white/50">
          <span>문의: oddsbag.official@gmail.com</span>
          <span>© {new Date().getFullYear()} ODDSBAG. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
