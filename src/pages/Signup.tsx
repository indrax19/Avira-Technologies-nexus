import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usersAPI } from "@/integrations/firebase/usersAPI";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await usersAPI.createWithPassword(email, password, fullName, "user", []);
      toast.success("Account created successfully. You can now sign in.");
      navigate("/login");
    } catch (error: any) {
      const code = error.code || "";
      let message = error.message || "Unable to create your account";

      if (code === "auth/email-already-in-use") {
        message = "This email is already registered. Please sign in instead.";
      } else if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
        message = "Email/password signup is not enabled in Firebase yet.";
      } else if (code === "auth/network-request-failed") {
        message = "Network connection error. Please try again.";
      } else if (code === "permission-denied") {
        message = "Firebase blocked the profile write. Check Firestore rules for the users collection.";
      }

      const visibleMessage = code ? `${message} (${code})` : message;
      setErrorMessage(visibleMessage);
      toast.error(visibleMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(39,60,112,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(234,23,38,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:rounded-2xl sm:p-8">
          <div className="mb-6 flex justify-center sm:mb-8">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F8934386caff3497686ed90270fdd753f%2F90e618d4a91e478a964d0f3d54315cbe?format=webp&width=800&height=1200"
              alt="Avira Technologies Logo"
              className="h-12 object-contain sm:h-14"
            />
          </div>

          <div className="mb-6 text-center sm:mb-8">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#273C70] text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#273C70] sm:text-3xl">Create your account</h1>
            <p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">
              Sign up for access to the Avira Project Management Portal.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:rounded-xl"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <label htmlFor="signup-name" className="block text-xs font-medium text-slate-700 sm:text-sm">Full name</label>
              <Input
                id="signup-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
                disabled={loading}
                className="h-10 rounded-lg border-slate-300 bg-slate-50/80 text-sm sm:h-11 sm:rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-email" className="block text-xs font-medium text-slate-700 sm:text-sm">Email address</label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
                className="h-10 rounded-lg border-slate-300 bg-slate-50/80 text-sm sm:h-11 sm:rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-password" className="block text-xs font-medium text-slate-700 sm:text-sm">Password</label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a password"
                  required
                  disabled={loading}
                  className="h-10 rounded-lg border-slate-300 bg-slate-50/80 pr-11 text-sm sm:h-11 sm:rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-slate-700 sm:text-sm">Confirm password</label>
              <div className="relative">
                <Input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  required
                  disabled={loading}
                  className="h-10 rounded-lg border-slate-300 bg-slate-50/80 pr-11 text-sm sm:h-11 sm:rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-[#273C70] text-sm font-medium text-white shadow-md transition hover:bg-[#273C70]/90 sm:h-11 sm:rounded-xl sm:text-base"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account? <Link to="/login" className="font-semibold text-[#273C70] hover:underline">Sign in</Link>
          </p>

          <p className="mt-6 text-center text-xs text-slate-500">Powered by Avira Technologies</p>
        </div>
      </div>
    </div>
  );
}
