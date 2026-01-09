import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { ActivationMenuEditor } from "../_components/ActivationMenuEditor";

export default async function JmaRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const { category } = await searchParams;
  const currentMode = category === "test" ? "test" : "prod";
  const supabase = createSupabaseServiceRoleClient();

  const { data: activationMenus } = await supabase
    .from("activation_menus")
    .select("*")
    .order("menu_type");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
            currentMode === "prod" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
          }`}>
            {currentMode === "prod" ? "Production" : "Test / Training"}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          JMA Activation Rules
        </h1>
        <p className="text-gray-500 font-medium text-sm">
          {currentMode === "prod" 
            ? "本番運用時の自動発動キーワードを設定します。"
            : "試験・デモ運用時の自動発動キーワードを設定します。"}
        </p>
      </div>

      <div className="max-w-4xl">
        <ActivationMenuEditor 
          menus={activationMenus || []} 
          viewMode={currentMode === "prod" ? "prod" : "test"} 
        />
      </div>
    </div>
  );
}

