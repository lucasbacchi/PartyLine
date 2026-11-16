import { Link } from "react-router";
import { IconShield } from "./Icons";

export default function Footer() {
    return (
        <footer className="border-t border-slate-800/80 bg-slate-950 text-xs text-slate-500">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Brand / Student Project Column */}
                    <div className="space-y-3">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition"
                        >
                            <span className="grid h-6 w-6 place-items-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-500 text-xs font-black text-white shadow-xs">
                                P
                            </span>
                            <span className="text-sm font-bold text-white tracking-tight">PartyLine</span>
                        </Link>
                        <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
                            A shared phone and SMS proxy system for space rentals, student clubs, and duty teams.
                            Wentworth Institute of Technology Senior Project.
                        </p>
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-400">
                            <IconShield className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span>A2P 10DLC Compliant SMS Proxy</span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">App</p>
                        <ul className="space-y-1.5 text-slate-400 text-xs">
                            <li>
                                <Link to="/" className="hover:text-slate-200 transition">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link to="/events" className="hover:text-slate-200 transition">
                                    Events & Duty Shifts
                                </Link>
                            </li>
                            <li>
                                <Link to="/org/users" className="hover:text-slate-200 transition">
                                    Team Directory
                                </Link>
                            </li>
                            <li>
                                <Link to="/org/settings" className="hover:text-slate-200 transition">
                                    Phone & Routing Settings
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal & Compliance */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Legal & Policy</p>
                        <ul className="space-y-1.5 text-slate-400 text-xs">
                            <li>
                                <Link
                                    to="/privacy"
                                    className="hover:text-slate-200 transition text-slate-300 font-medium"
                                >
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/terms"
                                    className="hover:text-slate-200 transition text-slate-300 font-medium"
                                >
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link to="/sms-terms" className="hover:text-slate-200 transition">
                                    SMS Proxy & Opt-Out
                                </Link>
                            </li>
                            <li>
                                <Link to="/opt-out" className="hover:text-slate-200 transition">
                                    Unsubscribe (STOP)
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support & Contact */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Contact</p>
                        <ul className="space-y-1.5 text-slate-400 text-xs">
                            <li>
                                <Link to="/contact" className="hover:text-slate-200 transition">
                                    Contact Project Team
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="mailto:support@partyline.lucasbacchi.com"
                                    className="hover:text-slate-200 transition text-slate-300"
                                >
                                    support@partyline.lucasbacchi.com
                                </a>
                            </li>
                            <li className="pt-1 text-[11px] text-slate-500 leading-tight">
                                Renters and staff can reply <strong className="text-slate-400">STOP</strong> to opt out,
                                or <strong className="text-slate-400">HELP</strong> for help. Msg & data rates may
                                apply.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-900 bg-slate-950/80 py-4">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
                    <p className="text-[11px] text-slate-500">
                        © {new Date().getFullYear()} PartyLine · Wentworth Institute of Technology Senior Project
                    </p>
                    <p className="text-[11px] text-slate-500">
                        Text messaging opt-in consent and mobile numbers are never sold or shared for marketing.
                    </p>
                </div>
            </div>
        </footer>
    );
}
