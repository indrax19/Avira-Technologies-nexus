import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { appUser } = useAuth();

  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 18) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  const fullName = appUser?.fullName || "there";

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f4f7fb] p-6">
      <h1 className="text-center text-3xl font-bold tracking-tight text-[#092f5b] sm:text-5xl">
        {greeting}, {fullName}
      </h1>
    </div>
  );
}
