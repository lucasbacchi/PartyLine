import { Link } from "react-router";
import { useUser } from "../context/UserContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { IconShield, IconLock, IconPhone, IconCheckCircle } from "../components/Icons";

export function meta() {
    return [
        { title: "PartyLine | Smart Shared Phone Lines & Event Routing" },
        {
            name: "description",
            content: "Share one business phone number across your entire team. Route calls dynamically to on-duty hosts and staff."
        }
    ];
}

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
    const { user } = useUser();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-clip flex flex-col justify-between">
            {/* Subtle background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
            <div className="absolute top-3/4 left-1/4 -z-10 h-80 w-80 rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

            <Navbar />

            <main className="flex-1">
                {/* Hero section */}
                <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl text-white">
                            Stop giving out your <br className="hidden sm:inline" />
                            <span className="bg-linear-to-r from-blue-400 via-indigo-300 to-slate-200 bg-clip-text text-transparent">
                                personal cell number.
                            </span>
                        </h1>
                        <p className="mt-5 max-w-lg text-base sm:text-lg text-slate-400 leading-relaxed">
                            Need to share a single phone number with a team? PartyLine gives your team one shared phone
                            number. Schedule an on-duty person or setup a rotation all without anyone sharing their
                            personal number.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            {user ? (
                                <>
                                    <Link
                                        to="/events"
                                        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
                                    >
                                        Go to Events Schedule →
                                    </Link>
                                    <Link
                                        to="/account"
                                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                                    >
                                        My Account
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/signup"
                                        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
                                    >
                                        Create your account
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                                    >
                                        I already have one
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Call routing demo preview */}
                    <div className="relative mx-auto w-full max-w-sm">
                        <div className="absolute -inset-4 -z-10 rounded-3xl bg-blue-600/10 blur-2xl" />
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                                Live Call Routing Demo
                            </p>
                            <p className="mt-1 text-xs text-slate-400">Saturday, 6:00 PM</p>
                            <p className="mt-0.5 text-base font-bold text-white">Soccer game reservation</p>

                            <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3.5">
                                <p className="text-[11px] font-medium text-slate-400">Inbound Caller</p>
                                <p className="mt-0.5 font-semibold text-slate-200">Alex Alban · (617) 555-0192</p>
                            </div>

                            <div className="ml-5 h-4 w-px bg-slate-800" />

                            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                                <span className="relative flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold text-emerald-300">
                                        Ringing on-duty team member
                                    </p>
                                    <p className="text-[11px] text-slate-400">Forwarding to shift contact</p>
                                </div>
                            </div>

                            <div className="ml-5 h-4 w-px bg-slate-800" />

                            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                                No answer within 20s? Automatically rotates to backup contact or shared voicemail.
                            </div>
                        </div>
                    </div>
                </section>

                {/* How it works section */}
                <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
                    <div className="mb-8">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Workflow</p>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                            How PartyLine Works
                        </h2>
                        <p className="mt-2 text-sm text-slate-400 max-w-xl">
                            Simple setup designed for event hosts, student organizations, facility managers, and small
                            teams.
                        </p>
                    </div>
                    <ol className="grid gap-6 sm:grid-cols-3">
                        {STEPS.map((step, i) => (
                            <li
                                key={step.title}
                                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xs transition hover:border-slate-700 hover:bg-slate-900/80"
                            >
                                <span className="inline-flex items-center justify-center rounded-lg bg-blue-600/15 border border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">
                                    Step 0{i + 1}
                                </span>
                                <h3 className="mt-4 text-base font-semibold text-slate-100">{step.title}</h3>
                                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Trust, Security & Project Context Section */}
                <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
                    <div className="rounded-3xl border border-slate-800 bg-linear-to-b from-slate-900/80 to-slate-950 p-8 sm:p-12">
                        <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                                <IconShield className="h-3.5 w-3.5" />
                                <span>Wentworth Senior Capstone Project</span>
                            </span>
                            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                                Built for facility rentals, shared duty shifts, and two-way SMS proxying.
                            </h2>
                            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                                When community members or renters book a space, they text or call one organization
                                number. PartyLine acts as an SMS and call proxy—forwarding inquiries to whoever is on
                                duty, and letting staff text back without revealing anyone&apos;s personal cell number.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600/15 text-blue-400 mb-4">
                                    <IconPhone className="h-5 w-5" />
                                </div>
                                <h3 className="font-semibold text-white text-base">SMS Proxy for Renters</h3>
                                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Renters provide their number when booking a space to receive access codes and answer
                                    questions. When they text the organization, on-duty staff can text right back
                                    through PartyLine.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600/15 text-indigo-400 mb-4">
                                    <IconLock className="h-5 w-5" />
                                </div>
                                <h3 className="font-semibold text-white text-base">Personal Numbers Stay Private</h3>
                                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Renters only see the organization&apos;s public phone number, and student staff
                                    never have to give out their personal mobile numbers to the public.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600/15 text-emerald-400 mb-4">
                                    <IconCheckCircle className="h-5 w-5" />
                                </div>
                                <h3 className="font-semibold text-white text-base">10DLC Compliant & Zero Spam</h3>
                                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    We never share or sell mobile phone numbers. Messages are strictly transactional for
                                    space rentals and shift duties. Renters can reply{" "}
                                    <strong className="text-white">STOP</strong> to opt out anytime.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                            <span>Questions about our SMS proxy, terms, or privacy policy?</span>
                            <div className="flex items-center gap-4">
                                <Link to="/privacy" className="text-blue-400 hover:underline">
                                    Privacy Policy →
                                </Link>
                                <Link to="/terms" className="text-blue-400 hover:underline">
                                    Terms of Service →
                                </Link>
                                <Link to="/sms-terms" className="text-blue-400 hover:underline">
                                    SMS Terms & Opt-Out →
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
