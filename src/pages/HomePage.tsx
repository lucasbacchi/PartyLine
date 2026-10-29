import { Link } from "react-router";
import { useUser } from "../context/UserContext";
import { IconUser } from "../components/Icons";

const STEPS = [
    {
        title: "Setup your organization",
        text: "Add a number and some team members to your organization."
    },
    {
        title: "Share one number",
        text: "Customers call or text the same organization number every time."
    },
    {
        title: "The right person answers",
        text: "PartyLine passes the call to whoever is on duty, then to the backup if they miss it."
    }
];

export default function HomePage() {
    const { user, userProfile } = useUser();

    const displayName = user?.displayName || userProfile.displayName || "";
    const initials = displayName
        ? displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
        : "";

    return (
        <div className="min-h-screen bg-[#000000] text-slate-100">
            {/* top bar */}
            <header className="sticky top-0 z-30 border-b border-white/5 bg-[#000000]/80 backdrop-blur-sm">
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                    <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500 text-sm font-bold text-white">
                            P
                        </span>
                        PartyLine
                    </Link>

                    {/* Nav actions: Account Icon if signed in, or Login/Signup buttons */}
                    {user ? (
                        <div className="flex items-center gap-3">
                            <Link
                                to="/events"
                                className="hidden sm:inline-block rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
                            >
                                Dashboard
                            </Link>
                            <Link
                                to="/account"
                                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 py-1 pl-1 pr-3 text-xs sm:text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:ring-2 hover:ring-blue-500/30"
                                title={displayName || "My Account"}
                            >
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-linear-to-tr from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-sm">
                                    {initials || <IconUser className="h-4 w-4" />}
                                </span>
                                <span className="hidden sm:inline-block max-w-30 truncate">
                                    {displayName || "Account"}
                                </span>
                            </Link>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Link
                                to="/login"
                                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                            >
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white transition"
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </nav>
            </header>

            <main>
                {/* hero */}
                <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                            Stop giving out your personal cell number.
                        </h1>
                        <p className="mt-5 max-w-lg text-lg text-slate-400">
                            Need to share a single phone number with a team? <br /> <br />
                            PartyLine gives your team one shared phone number. Schedule an on-duty person or setup a
                            rotation all without anyone sharing their personal number.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            {user ? (
                                <>
                                    <Link
                                        to="/events"
                                        className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-400 transition"
                                    >
                                        Go to Events Schedule →
                                    </Link>
                                    <Link
                                        to="/account"
                                        className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline"
                                    >
                                        My Account
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/signup"
                                        className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-400 transition"
                                    >
                                        Create your account
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline"
                                    >
                                        I already have one
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* little example of a call coming in */}
                    <div className="relative mx-auto w-full max-w-sm">
                        <div className="absolute -inset-6 -z-10 rounded-4xl bg-blue-500/6 blur-3xl" />
                        <div className="rounded-3xl border border-white/8 bg-[#04060b] p-5 shadow-2xl">
                            <p className="text-sm text-slate-400">Saturday, 6:00 PM</p>
                            <p className="mt-1 text-lg font-semibold">Soccer game reservation</p>

                            <div className="mt-5 rounded-2xl bg-white/4 p-4">
                                <p className="text-xs text-slate-400">Someone is calling your number...</p>
                                <p className="mt-1 font-medium">Renter · Alex Alban</p>
                            </div>

                            <div className="ml-5 h-6 w-px bg-white/15" />

                            <div className="flex items-center gap-3 rounded-2xl border border-green-400/30 bg-green-400/10 p-4">
                                <span className="relative flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60 motion-reduce:animate-none" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium">Ringing on-duty host</p>
                                    <p className="text-xs text-slate-400">Assigned shift host</p>
                                </div>
                            </div>

                            <div className="ml-5 h-6 w-px bg-white/15" />

                            <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
                                No answer? Set up a backup contact to ring automatically.
                            </div>
                        </div>
                    </div>
                </section>

                {/* how it works */}
                <section className="mx-auto max-w-6xl px-5 pb-20">
                    <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
                    <ol className="mt-8 grid gap-8 sm:grid-cols-3">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="border-t border-white/10 pt-5">
                                <span className="text-sm font-medium text-blue-400">Step {i + 1}</span>
                                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                                <p className="mt-1 text-slate-400">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>
            </main>

            <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
                PartyLine Phone System
            </footer>
        </div>
    );
}
