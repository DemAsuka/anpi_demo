import { DrillStartForm } from "../_components/DrillStartForm";

export default async function TrainingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          安否訓練 設定
        </h1>
        <p className="text-gray-500 font-medium text-sm mt-1">
          シミュレーションを開始し、通知システムをテストします。
        </p>
      </div>

      <div className="max-w-2xl">
        <DrillStartForm />
      </div>
    </div>
  );
}

