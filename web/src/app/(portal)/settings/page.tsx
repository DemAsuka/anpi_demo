import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { LocationSettings } from "./_components/LocationSettings";
import { ProfileSettings } from "./_components/ProfileSettings";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) redirect("/sign-in");

  const { view } = await searchParams;
  const supabase = createSupabaseServiceRoleClient();

  // 管理者チェック
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdmin = !!adminRow;
  const currentView = isAdmin ? (view || "admin") : "user";
  const isEditingAllowed = isAdmin && currentView === "admin";

  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
  const fullName = `${user.lastName ?? ""} ${user.firstName ?? ""}`.trim() || user.username || "未設定";

  // プロファイル情報の取得（なければ作成）
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        email: primaryEmail,
        full_name: fullName,
      })
      .select()
      .maybeSingle();
    
    if (insertError) {
      console.error("Profile creation error:", insertError);
    }
    // ここで profile が null のままだと ProfileSettings で落ちるため、
    // 最小限のオブジェクトをセットする
    profile = newProfile || {
      id: userId,
      full_name: fullName,
      slack_user_id: null,
      department: null,
      email: primaryEmail
    };
  }

  // 登録地点の取得
  const { data: locations } = await supabase
    .from("user_locations")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  // システム共通地点の取得とフィルタリング
  const { data: allSystemLocations } = await supabase
    .from("system_locations")
    .select("*")
    .order("sort_order", { ascending: true });

  // ユーザーの所属に合わせてフィルタリング
  const userDepartment = profile?.department || "";
  const systemLocations = (allSystemLocations || []).filter(loc => {
    // 管理者モードの場合は全て表示
    if (currentView === "admin") return true;
    
    // 一般ユーザーモードの場合
    if (loc.target_group === "all") return true;
    if (loc.target_group === "corporate" && userDepartment === "コーポレート") return true;
    if (loc.target_group === "individual") return true; // 今は全員通知
    
    return false;
  });

  return (
    <div className="space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              設定
            </h1>
            <p className="text-gray-500 font-medium">
              安否確認のための通知地点設定や、プロファイル情報を管理します。
              <span className="ml-2 inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded border border-blue-100 uppercase tracking-tighter">
                Notifications apply to production
              </span>
            </p>
          </div>

      <div className="grid grid-cols-1 gap-10">
        {/* プロファイルセクション */}
        <section className="bg-white rounded-[2rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            {user.imageUrl && (
              <img src={user.imageUrl} alt="Profile" className="w-16 h-16 rounded-full border-2 border-gray-50" />
            )}
            <div>
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                👤 基本プロファイル
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Googleアカウントから引用中</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-wider">氏名</label>
              <p className="text-lg font-bold text-gray-900">{fullName}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-wider">メインメールアドレス（ログイン用）</label>
              <p className="text-lg font-bold text-gray-900">{primaryEmail || "未設定"}</p>
            </div>
          </div>

          <div className="border-t border-gray-50 pt-8">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
              🆔 アプリケーション設定
            </h3>
            <ProfileSettings initialProfile={profile as any} />
          </div>

          <div className="border-t border-gray-50 pt-8 space-y-6">
            <div>
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                📞 緊急連絡先の設定（将来用・現在は未運用）
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-1">
                ※Slackが使えない場合のバックアップ連絡先です。現在は入力しても通知は届きません。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale-[0.5]">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  SMS（携帯電話番号）
                  <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-bold">PREVIEW</span>
                </label>
                <input 
                  type="tel"
                  placeholder="090-0000-0000"
                  disabled
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-400 cursor-not-allowed outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  予備メールアドレス
                  <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-bold">PREVIEW</span>
                </label>
                <input 
                  type="email"
                  placeholder="personal@example.com"
                  disabled
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-400 cursor-not-allowed outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 地点設定セクション */}
        <section className="bg-white rounded-[2rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              📍 通知対象地点（最大4ヶ所）
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            ここで設定した市区町村で災害（地震・警報等）が発生した際に、あなたに安否確認の通知が届きます。
            <span className="block mt-1 text-xs text-amber-600 font-bold">
              ※この設定は「本番運用モード」でのみ有効です。「訓練・テストモード」では、モード内で設定した内容に応じて通知が届きます。
            </span>
          </p>
          
          <LocationSettings 
            initialLocations={locations || []} 
            systemLocations={systemLocations || []}
            userId={userId} 
            isEditingAllowed={isEditingAllowed}
          />
        </section>
      </div>
    </div>
  );
}

