import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="mb-8 text-center">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          Argus
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          LLM Observability
        </p>
      </div>
      <SignIn />
    </div>
  );
}
