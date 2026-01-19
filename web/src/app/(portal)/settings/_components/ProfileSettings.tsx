"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  full_name: string | null;
  slack_user_id: string | null;
  department: string | null;
};

export function ProfileSettings({ 
  initialProfile 
}: { 
  initialProfile: Profile 
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const supabase = createSupabaseBrowserClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        slack_user_id: profile.slack_user_id,
        department: profile.department,
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Profile update error:", error);
      setMessage({ type: "error", text: "プロファイルの更新に失敗しました。" });
    } else {
      setMessage({ type: "success", text: "プロファイルを更新しました。" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider">
              Slack ユーザーID
              <span className="ml-2 text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">通知メンション用</span>
            </label>
            <input 
              type="text"
              value={profile.slack_user_id || ""}
              onChange={e => setProfile({ ...profile, slack_user_id: e.target.value })}
              placeholder="U0123456789"
              className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-colors"
            />
            <p className="text-[10px] text-gray-400 font-medium">
              Slackのプロフィールから「ユーザーIDをコピー」して貼り付けてください。
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider">部署・所属</label>
            <input 
              type="text"
              value={profile.department || ""}
              onChange={e => setProfile({ ...profile, department: e.target.value })}
              placeholder="開発部"
              className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-colors"
            />
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-bold ${
            message.type === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          }`}>
            {message.type === "success" ? "✅" : "⚠️"} {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={loading}
            className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-lg shadow-gray-100 disabled:opacity-50"
          >
            {loading ? "更新中..." : "変更を保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}
