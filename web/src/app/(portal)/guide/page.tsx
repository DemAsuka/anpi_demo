export default function GuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          利用マニュアル
        </h1>
      </div>
      
      <div className="bg-white rounded-[2rem] p-8 shadow-sm space-y-6">
        <section className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">1. 安否確認の流れ</h2>
          <p className="text-gray-600 leading-relaxed">
            災害が発生し、設定された閾値を超えた場合、Slackの専用チャンネルに通知が届きます。
            通知内のボタン（Workflow）をクリックして、現在の状況を報告してください。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">2. 通知地点の設定</h2>
          <p className="text-gray-600 leading-relaxed">
            「地点・通知設定」メニューから、自宅や実家、勤務地などを登録できます。
            登録された地点で震度5弱以上の地震などが観測された場合に、通知が配信されます。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">3. 回答の種類</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li><strong>無事</strong>：自分も家族も無事で、支援の必要がない場合</li>
            <li><strong>軽傷</strong>：軽微な怪我があるが、自力で行動可能な場合</li>
            <li><strong>重傷</strong>：大きな怪我があり、医療機関の受診が必要な場合</li>
            <li><strong>要救助</strong>：身動きが取れず、救助が必要な場合</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

