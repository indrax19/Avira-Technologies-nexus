import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, LayoutGrid, FileCheck2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void import("@/pages/Dashboard");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
      return;
    } catch (error: any) {
      console.error("Login error:", error);

      let errorMessage = "Invalid Username or Password";

      if (error.message?.includes("Failed to fetch") || error.code === "auth/network-request-failed") {
        errorMessage = "Network connection error. Please check your internet connection and try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed login attempts. Please try again later.";
      } else if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setLoginError("Invalid username or password");
        return;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(39,60,112,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(234,23,38,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-3 py-4 sm:px-4 sm:py-6">


      {/* Main Content */}
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] sm:min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:grid-cols-2">

        {/* Left Gradient Panel */}
        <div className="hidden flex-col justify-between bg-brand-primary p-6 sm:p-8 lg:p-10 text-white lg:flex" style={{ background: "linear-gradient(160deg, #273C70 0%, #273C70 58%, #EA1726 100%)" }}>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-white/75">Avira Technologies</p>
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Project Management Portal</h1>
              </div>
            </div>

            <div className="mt-12 sm:mt-16 max-w-md space-y-4 sm:space-y-5">
              <p className="text-2xl sm:text-4xl font-semibold leading-tight tracking-tight">
                Manage projects, invoices, and outreach in one secure workspace.
              </p>
              <p className="text-sm sm:text-base leading-7 text-white/75">
                Sign in to access a clean, fast, and organized workspace for daily operations.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:gap-3 text-xs sm:text-sm text-white/80">
            <div className="flex items-center gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/10 px-3 sm:px-4 py-2 sm:py-3 backdrop-blur-sm">
              <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 text-white" />
              <span className="text-xs sm:text-sm">Project management, invoices, outreach, and customer data</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/10 px-3 sm:px-4 py-2 sm:py-3 backdrop-blur-sm">
              <FileCheck2 className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 text-white" />
              <span className="text-xs sm:text-sm">Organized records with a modern, professional interface</span>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="flex items-center justify-center p-4 sm:p-6 md:p-10 w-full">
          <div className="w-full max-w-sm rounded-xl sm:rounded-2xl lg:rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-lg shadow-slate-900/5">

            {/* Avira Logo */}
            <div className="mb-6 sm:mb-8 flex justify-center">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F8934386caff3497686ed90270fdd753f%2F90e618d4a91e478a964d0f3d54315cbe?format=webp&width=800&height=1200"
                alt="Avira Technologies Logo"
                className="h-12 sm:h-14 object-contain"
              />
            </div>

            <div className="mb-6 sm:mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brand-primary" style={{ color: "#273C70" }}>
                Welcome back
              </h2>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-6 text-slate-600">
                Sign in to continue to your Avira Project Management Portal account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-slate-700">
                  Email address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLoginError(null);
                  }}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                  className="h-10 sm:h-11 text-sm rounded-lg sm:rounded-xl border-slate-300 bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-brand-primary"
                  style={{ '--tw-ring-color': '#273C70' } as any}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="h-10 sm:h-11 text-sm rounded-lg sm:rounded-xl border-slate-300 bg-slate-50/80 pr-11 focus-visible:ring-2 focus-visible:ring-brand-primary"
                    style={{ '--tw-ring-color': '#273C70' } as any}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-800 disabled:opacity-50 p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-10 sm:h-11 w-full rounded-lg sm:rounded-xl bg-brand-primary text-sm sm:text-base font-medium text-white shadow-md transition hover:bg-brand-primary/90 active:scale-95"
                style={{ backgroundColor: "#273C70", boxShadow: "0 4px 12px rgba(234, 23, 38, 0.2)" }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {loginError && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
                {loginError}
              </p>
            )}

            <div className="mt-6 sm:mt-8 text-center text-xs text-slate-500">
              <p>Powered by Avira Technologies</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
