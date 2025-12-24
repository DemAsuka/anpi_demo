import { SignIn } from "@clerk/nextjs";

export default function AdminSignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-semibold">管理画面ログイン</h1>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none border",
            }
          }}
          routing="hash"
          fallbackRedirectUrl="/admin"
        />
      </div>
    </main>
  );
}
