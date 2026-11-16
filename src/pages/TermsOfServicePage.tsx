import { Link } from "react-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { IconFileText, IconPhone, IconShield } from "../components/Icons";

export function meta() {
    return [
        { title: "Terms of Service | PartyLine" },
        {
            name: "description",
            content:
                "PartyLine Terms of Service - Space rental messaging, SMS proxy terms, and student project conditions."
        }
    ];
}

export default function TermsOfServicePage() {
    const lastUpdated = "November 6, 2026";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600/30 selection:text-white">
            <Navbar />

            <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="border-b border-slate-800 pb-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-3">
                            <IconFileText className="h-3.5 w-3.5" />
                            <span>Wentworth Senior Design Project</span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Terms of Service</h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Last Updated: <span className="text-slate-200 font-medium">{lastUpdated}</span>
                        </p>
                    </div>

                    {/* Summary Card */}
                    <div className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 shadow-sm">
                        <div className="flex items-start gap-3.5">
                            <div className="rounded-xl bg-blue-500/20 p-2 text-blue-400 shrink-0 mt-0.5">
                                <IconPhone className="h-5 w-5" />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="text-sm font-bold text-white tracking-tight">
                                    Summary of SMS Messaging & Proxy Terms
                                </h2>
                                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                                    PartyLine serves as a two-way SMS proxy for organizations renting facilities and
                                    spaces. When renters inquire or book, they consent to receive replies from on-duty
                                    staff. Messages are strictly conversational and reservation-related.
                                </p>
                                <div className="grid gap-1.5 sm:grid-cols-2 text-xs text-blue-200/90 pt-1">
                                    <div>
                                        • <strong>Frequency:</strong> Message frequency varies.
                                    </div>
                                    <div>
                                        • <strong>Rates:</strong> Message and data rates may apply.
                                    </div>
                                    <div>
                                        • <strong>Opt-Out:</strong> Text <strong>STOP</strong> to cancel.
                                    </div>
                                    <div>
                                        • <strong>Help:</strong> Text <strong>HELP</strong> for assistance.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms Content */}
                    <div className="mt-8 space-y-8 text-slate-300 text-sm leading-relaxed">
                        {/* Section 1 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">1.</span> Introduction & Project Scope
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                Welcome to <strong className="text-white">PartyLine</strong>. PartyLine is a student
                                senior capstone project developed at Wentworth Institute of Technology. It is designed
                                to assist student clubs, community spaces, athletic facility managers, and event hosts
                                with shared telephone routing and two-way SMS communication.
                            </p>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                By using PartyLine as an organization member or by texting/calling an organization line
                                as a renter, you agree to these Terms of Service and our{" "}
                                <Link to="/privacy" className="text-blue-400 underline hover:text-blue-300">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </section>

                        {/* Section 2: SMS Proxy and Renter Communications */}
                        <section className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-6">
                            <div className="flex items-center gap-2">
                                <IconShield className="h-5 w-5" />
                                <h2 className="text-base font-bold text-white">
                                    <span className="text-indigo-400">2.</span> SMS Proxy Service & Renter Consent (A2P
                                    10DLC)
                                </h2>
                            </div>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                PartyLine operates an Application-to-Person (A2P) telecommunications platform to
                                facilitate conversations between space renters and organization staff. The following
                                rules apply to all SMS messaging:
                            </p>

                            <div className="mt-4 space-y-3">
                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        Renter Opt-In & Consent
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        When a user signs up to rent a space, reserve a venue, or sends an initial text
                                        message to the organization&apos;s phone number, they provide their phone number
                                        and their consent to be messaged by the service in reply to their inquiry or
                                        booking. Messages include access instructions, gate codes, check-in updates, and
                                        replies to questions.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        Two-Way SMS Proxy Mechanism
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        PartyLine proxies incoming renter texts to the personal phone of the team member
                                        on duty for that shift. When the on-duty member replies, PartyLine sends the
                                        message back to the renter from the organization&apos;s shared line, protecting
                                        the personal cell phone numbers of both parties.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        Message Frequency
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        Message frequency varies depending on the number of questions, rental activity,
                                        and duty shifts. Messages are only sent when there is active communication
                                        regarding a rental or duty shift.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        Costs & Carrier Charges
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        <strong className="text-white">Message and data rates may apply.</strong>{" "}
                                        Standard carrier rates set by your mobile provider apply to messages sent or
                                        received.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        How to Opt Out (STOP)
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        You can cancel SMS communications at any time. Text or reply{" "}
                                        <strong className="text-white">STOP</strong> to the phone number. We will send
                                        an SMS confirmation verifying that you have unsubscribed. You may also reply{" "}
                                        <strong className="text-white">HELP</strong> for support.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                                    <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                                        Carrier Liability Disclaimer
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                                        Mobile carriers (AT&T, T-Mobile, Verizon, Sprint, etc.) are not liable for
                                        delayed or undelivered messages.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">3.</span> Acceptable Use & Conduct
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                You agree to use PartyLine only for legitimate organization and rental management. You
                                must not:
                            </p>
                            <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
                                <li>• Send unsolicited marketing spam, bulk promotional texts, or abusive content.</li>
                                <li>• Impersonate other organizations or individuals.</li>
                                <li>• Use the service for unlawful purposes or harass community members or staff.</li>
                            </ul>
                        </section>

                        {/* Section 4 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">4.</span> Emergency Disclaimer (No 911 Calls)
                            </h2>
                            <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200 text-xs">
                                <strong className="text-amber-100">Notice:</strong> PartyLine is not a traditional
                                cellular carrier and does NOT support emergency (911) calling. Always dial 911 directly
                                from your mobile phone or landline in an emergency.
                            </div>
                        </section>

                        {/* Section 5 */}
                        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span className="text-blue-400">5.</span> Project Status & Questions
                            </h2>
                            <p className="mt-2 text-xs sm:text-sm text-slate-300">
                                PartyLine is provided as-is as an educational capstone project. If you have questions
                                about our service or these terms, please reach out to our team at{" "}
                                <a href="mailto:support@partyline.lucasbacchi.com" className="text-blue-400 underline">
                                    support@partyline.lucasbacchi.com
                                </a>
                                .
                            </p>
                        </section>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
