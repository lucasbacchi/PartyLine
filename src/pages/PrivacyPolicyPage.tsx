import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { IconShield, IconLock, IconCheck, IconMail } from "../components/Icons";

export function meta() {
    return [
        { title: "Privacy Policy | PartyLine" },
        {
            name: "description",
            content:
                "PartyLine Privacy Policy - How we protect renter, customer, and team mobile data for our student project."
        }
    ];
}

export default function PrivacyPolicyPage() {
    const lastUpdated = "November 6, 2026";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600/30 selection:text-white">
            <Navbar />

            <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="border-b border-slate-800 pb-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
                            <IconShield className="h-3.5 w-3.5" />
                            <span>Wentworth Senior Design Project</span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Privacy Policy</h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Last Updated: <span className="text-slate-200 font-medium">{lastUpdated}</span>
                        </p>
                    </div>

                    {/* Carrier-Mandated A2P 10DLC Mobile Privacy Callout */}
                    <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm">
                        <div className="flex items-start gap-3.5">
                            <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400 shrink-0 mt-0.5">
                                <IconLock className="h-5 w-5" />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="text-sm font-bold text-white tracking-tight">
                                    Mobile Information Non-Sharing Commitment (A2P 10DLC)
                                </h2>
                                <p className="text-xs sm:text-sm font-medium leading-relaxed text-emerald-200">
                                    No mobile information will be shared with third parties or affiliates for marketing
                                    or promotional purposes. All the categories in this policy exclude text messaging
                                    originator opt-in data and consent; this information will not be shared with, rented
                                    to, or sold to any third parties under any circumstances.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Policy Content */}
                    <div className="mt-8 space-y-8 text-slate-300 text-sm leading-relaxed">
                        {/* Section 1 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">1.</span> About PartyLine
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                <strong className="text-white">PartyLine</strong> is an open-source senior capstone
                                project developed by students at Wentworth Institute of Technology (Boston, MA).
                            </p>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                PartyLine operates as a shared telephone line and two-way SMS proxy for organizations
                                that manage facility rentals (such as community halls, athletic fields, and club
                                spaces). It enables community renters and on-duty staff to call and text each other
                                through a single shared organization phone number without ever exposing personal mobile
                                numbers.
                            </p>
                        </section>

                        {/* Section 2 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">2.</span> Information We Collect & How Consent Is Given
                            </h2>
                            <div className="mt-3 space-y-4">
                                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        A. Space Renters & Inbound Callers/Texters
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        When someone signs up to rent a space or texts/calls the organization&apos;s
                                        phone number:
                                    </p>
                                    <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-400">
                                        <li>
                                            They provide their mobile phone number during space booking or by sending an
                                            initial text inquiry.
                                        </li>
                                        <li>
                                            By renting the facility or texting the organization, they consent to be
                                            messaged by the service in reply to their inquiry, to coordinate gate/access
                                            codes, and for reservation-related updates.
                                        </li>
                                    </ul>
                                </div>

                                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        B. Organization Staff & Shift Members
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        When team members or student volunteers register and add their personal number
                                        for duty shifts:
                                    </p>
                                    <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-400">
                                        <li>
                                            We store their name, email, and personal phone number to route incoming
                                            calls and forward renter SMS messages.
                                        </li>
                                        <li>
                                            We send operational alerts (such as duty shift start reminders and login
                                            verification codes).
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">3.</span> How the Two-Way SMS Proxy Works
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                PartyLine is designed from the ground up for mutual privacy:
                            </p>
                            <ul className="mt-3 space-y-2">
                                {[
                                    "When a renter texts the organization number, PartyLine relays the text to the staff member on duty.",
                                    "When the staff member replies, PartyLine sends the message back to the renter from the organization's number.",
                                    "Neither the renter nor the staff member ever sees the other party's personal cell phone number.",
                                    "All messages are strictly transactional and conversational, tied directly to the rental or shift."
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                                        <div className="mt-1 grid h-4 w-4 place-items-center rounded-full bg-blue-500/20 text-blue-400 shrink-0">
                                            <IconCheck className="h-3 w-3" />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* Section 4 */}
                        <section className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">4.</span> We Never Sell or Share Your Phone Number
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                Because PartyLine is an academic student project, we have zero interest in marketing, ad
                                brokers, or third-party data collection.
                            </p>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300 font-medium">
                                We will never sell, lease, trade, or share renter or staff phone numbers or text
                                messaging opt-in consent with any third parties or affiliates for promotional or
                                marketing purposes.
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                                Telecommunications data is processed exclusively through our licensed infrastructure
                                partner, Twilio Inc., strictly as required to transmit the SMS and voice calls.
                            </p>
                        </section>

                        {/* Section 5 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">5.</span> Opt-Out & User Choices
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                Anyone receiving text messages through PartyLine (both renters and staff) can opt out at
                                any time:
                            </p>
                            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-xs sm:text-sm">
                                <p>
                                    • <strong className="text-white">Text STOP:</strong> Reply{" "}
                                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">
                                        STOP
                                    </code>{" "}
                                    to any message to immediately stop receiving SMS.
                                </p>
                                <p>
                                    • <strong className="text-white">Text HELP:</strong> Reply{" "}
                                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">
                                        HELP
                                    </code>{" "}
                                    to receive support info.
                                </p>
                                <p>
                                    • <strong className="text-white">View Full Details:</strong> See our{" "}
                                    <Link to="/sms-terms" className="text-blue-400 underline hover:text-blue-300">
                                        SMS Terms & Opt-Out Guide
                                    </Link>
                                    .
                                </p>
                            </div>
                        </section>

                        {/* Section 6 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">6.</span> Contact the Student Project Team
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                For any questions about this project, our privacy practices, or your phone number:
                            </p>
                            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                                <div className="rounded-lg bg-blue-600/15 p-2 text-blue-400">
                                    <IconMail className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">PartyLine Senior Project Team · Wentworth</p>
                                    <a
                                        href="mailto:support@partyline.lucasbacchi.com"
                                        className="text-xs sm:text-sm font-semibold text-blue-400 hover:underline"
                                    >
                                        support@partyline.lucasbacchi.com
                                    </a>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
