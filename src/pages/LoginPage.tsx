import { Link } from "react-router";


const STEPS = [
    {
        title: "Add your events",
        text: "Put each rental on the calendar and pick who is covering it."
    },
    {
        title: "Share one number",
        text: "Renters call or text the same organization number every time."
    },
    {
        title: "The right person answers",
        text: "PartyLine passes the call to whoever is on duty, then to the backup if they miss it."
    }
];

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#000000] text-slate-100">
            {/* top bar */}
            <header className="sticky top-0 z-30 border-b border-white/5 bg-[#000000]/80 backdrop-blur-sm">
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500 text-sm font-bold text-white">
                            P
                        </span>
                        PartyLine
                    </span>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Link
                            to="/"
                            className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                        >
                            Log in
                        </Link>
                        {/* todo: sign up page */}
                        <button
                            type="button"
                            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
                        >
                            Sign up
                        </button>
                    </div>
                </nav>
            </header>

            <main>
                {/* hero */}
                <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                            Stop giving out your cell number.
                        </h1>
                        <p className="mt-5 max-w-lg text-lg text-slate-400">
                            Renting out your hall, gym, or field? PartyLine gives your team one shared phone number.
                            Whoever is on duty for the event picks up, and nobody has to share their personal number.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            {/* todo: sign up page */}
                            <button
                                type="button"
                                className="rounded-full bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-400"
                            >
                                Create your account
                            </button>
                            <Link
                                to="/"
                                className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline"
                            >
                                I already have one
                            </Link>
                        </div>
                    </div>

                    {/* little example of a call coming in */}
                    <div className="relative mx-auto w-full max-w-sm">
                        <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-blue-500/[0.06] blur-3xl" />
                        <div className="rounded-3xl border border-white/[0.08] bg-[#04060b] p-5 shadow-2xl">
                            <p className="text-sm text-slate-400">Saturday, 6:00 PM</p>
                            <p className="mt-1 text-lg font-semibold">Soccer game reservation</p>

                            <div className="mt-5 rounded-2xl bg-white/[0.04] p-4">
                                <p className="text-xs text-slate-400">Someone is calling your number</p>
                                <p className="mt-1 font-medium">Renter · Alex Alban</p>
                            </div>

                            <div className="ml-5 h-6 w-px bg-white/15" />

                            <div className="flex items-center gap-3 rounded-2xl border border-green-400/30 bg-green-400/10 p-4">
                                <span className="relative flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60 motion-reduce:animate-none" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium">Ringing Bjordi</p>
                                    <p className="text-xs text-slate-400">On duty until 6:00 PM</p>
                                </div>
                            </div>

                            <div className="ml-5 h-6 w-px bg-white/15" />

                            <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
                                No answer? It moves on to <span className="text-slate-200">Asi</span>, the backup.
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
