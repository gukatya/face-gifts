interface Props {
  current: number;
  steps: string[];
}

export default function StepIndicator({ current, steps }: Props) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  done
                    ? "bg-luxe-black border-luxe-black text-white"
                    : active
                    ? "bg-luxe-black border-luxe-black text-white"
                    : "bg-transparent border-luxe-silver text-luxe-grey-mid"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              <span className={`text-xs mt-1.5 tracking-wide ${active ? "text-luxe-black font-medium" : "text-luxe-grey-mid"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${current > num ? "bg-luxe-black" : "bg-luxe-silver"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
