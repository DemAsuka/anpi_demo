import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-black tracking-tight text-gray-900">
          CLT <span className="text-blue-600">Safety Connect</span>
        </h1>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "shadow-2xl border-none rounded-3xl overflow-hidden",
              headerTitle: "font-black text-xl",
              socialButtonsBlockButton: "rounded-xl border-gray-100",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 rounded-xl transition-all",
            }
          }}
          routing="hash"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </main>
  );
}

