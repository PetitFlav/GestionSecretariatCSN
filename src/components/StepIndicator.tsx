interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
  totalSteps?: number
}

export default function StepIndicator({ currentStep, totalSteps = 3 }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1
        const isDone = step < currentStep
        const isActive = step === currentStep

        return (
          <div key={step} className="flex items-center" style={{ flex: step < totalSteps ? '1' : 'none' }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
              style={{
                background: isDone
                  ? 'var(--csn-navy)'
                  : isActive
                  ? 'var(--csn-light)'
                  : 'var(--csn-cream)',
                color: isDone
                  ? 'white'
                  : isActive
                  ? 'var(--csn-navy)'
                  : '#8faabf',
                border: isActive
                  ? '1.5px solid var(--csn-blue)'
                  : isDone
                  ? 'none'
                  : '0.5px solid var(--csn-border-strong)',
              }}
            >
              {isDone ? '✓' : step}
            </div>
            {step < totalSteps && (
              <div
                className="flex-1 h-px mx-1"
                style={{
                  background: isDone ? 'var(--csn-navy)' : 'var(--csn-border-strong)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
