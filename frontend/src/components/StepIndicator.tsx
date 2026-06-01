interface Props {
  current: number;
  steps: string[];
}

export default function StepIndicator({ current, steps }: Props) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  done
                    ? "bg-green-500 border-green-500 text-white"
                    : active
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {done ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? "text-brand-500" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${current > num ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
