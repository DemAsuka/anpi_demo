export default function ReportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          安否報告
        </h1>
        <p className="text-gray-500 font-medium text-sm mt-1">
          ※現在はSlack Workflow Builderからの回答を優先しています。
        </p>
      </div>
      
      <div className="bg-white border-2 border-dashed border-gray-100 rounded-[2rem] p-12 text-center">
        <p className="text-gray-400 font-bold text-lg">Webからの報告機能は準備中です。</p>
        <p className="text-gray-400 text-sm mt-1">恐れ入りますが、Slackのチャンネルに届いている通知から回答をお願いいたします。</p>
      </div>
    </div>
  );
}

