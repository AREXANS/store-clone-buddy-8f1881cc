import { ShieldX, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const ApiAccessDenied = () => {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="h-6 w-6" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">403 Access Denied</h1>
        <p className="mt-3 text-muted-foreground">
          You don&apos;t have permission to access this resource.
        </p>

        <div className="mt-6">
          <Button asChild>
            <a href="/" aria-label="Return Home">
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
};

export default ApiAccessDenied;
