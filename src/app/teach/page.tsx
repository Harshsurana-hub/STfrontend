'use client';

import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { InstructorTestimonials } from '@/components/instructor/InstructorTestimonials';
import { useToastContext } from '@/components/ui/ToastProvider';
import {
  Sparkles,
  Globe,
  DollarSign,
  Video,
  CheckCircle2,
  Send,
  BookOpen,
  Upload,
  Award,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: Globe,
    title: 'Reach Thousands of Learners',
    description:
      'Publish your practical skills courses to an eager audience across Africa and international diaspora communities.',
  },
  {
    icon: DollarSign,
    title: 'Sustainable Earnings Potential',
    description:
      'Earn revenue every time a student enrolls in your course, with direct payouts to your bank account or crypto wallet.',
  },
  {
    icon: Video,
    title: 'World-Class Creator Tools',
    description:
      'Access intuitive video upload tools, quiz builders, student Q&A forums, and real-time performance analytics.',
  },
];

const STEPS = [
  {
    number: '01',
    icon: BookOpen,
    title: 'Plan Your Curriculum',
    description:
      'Outline your hands-on course topics, lesson goals, and practical assignments using our creator guidelines.',
  },
  {
    number: '02',
    icon: Upload,
    title: 'Record & Upload Video Lessons',
    description:
      'Film your practical demonstrations on phone or camera, and upload via our high-speed instructor portal.',
  },
  {
    number: '03',
    icon: Award,
    title: 'Publish & Earn Income',
    description:
      'Launch your course, engage with students in Q&A discussions, and receive monthly automated revenue payouts.',
  },
];

export default function TeachPage() {
  const toast = useToastContext();
  const formRef = useRef<HTMLDivElement>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [expertise, setExpertise] = useState('Tailoring & Design');
  const [socialLink, setSocialLink] = useState('');
  const [motivation, setMotivation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    };
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!motivation.trim() || motivation.trim().length < 20) {
      setErrorMsg('Please tell us a bit more about what you want to teach (min 20 characters).');
      return;
    }

    setIsSubmitting(true);
    submitTimerRef.current = setTimeout(() => {
      submitTimerRef.current = null;
      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success({
        title: 'Application received!',
        description: 'Our instructor review team will get back to you within 48 hours.',
      });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF9FF] text-[#26215C]">
      <Header />

      <main id="main-content">
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F4F2FF] to-[#FAF9FF] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#EEEDFE] px-4 py-1.5 text-xs font-semibold text-[#7F77DD]">
              <Sparkles className="h-4 w-4" /> Teach on SorobanLard
            </span>

            <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-extrabold tracking-tight text-[#26215C] sm:text-5xl lg:text-6xl">
              Share Your Knowledge, Earn Income
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#5A5578]">
              Turn your practical skills in tailoring, baking, makeup, photography, and crafts into
              an online academy. Empower the next generation of African creators.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={scrollToForm}
                className="rounded-2xl bg-[#7F77DD] px-8 py-4 text-base font-semibold text-white shadow-lg transition duration-200 hover:bg-[#6860C7]"
              >
                Start Teaching
              </button>
              <a
                href="#how-it-works"
                className="rounded-2xl border border-[#D5D2F6] bg-white px-8 py-4 text-base font-semibold text-[#26215C] transition hover:bg-[#F4F2FF]"
              >
                How It Works
              </a>
            </div>
          </div>
        </section>

        {/* ── Benefits Section ── */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-display text-3xl font-extrabold text-[#26215C] sm:text-4xl">
                Why Become an Instructor on SorobanLard?
              </h2>
              <p className="mt-4 text-base text-[#5A5578]">
                We provide the platform, audience, and support so you can focus on teaching.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.title}
                    className="rounded-3xl border border-[#D5D2F6] bg-white p-8 shadow-sm transition hover:shadow-md"
                  >
                    <div className="inline-flex rounded-2xl bg-[#F4F2FF] p-3 text-[#7F77DD]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-[#26215C]">
                      {b.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#5A5578]">
                      {b.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="bg-[#F4F2FF]/60 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="font-display text-3xl font-extrabold text-[#26215C] sm:text-4xl">
                How It Works in 3 Simple Steps
              </h2>
              <p className="mt-4 text-base text-[#5A5578]">
                From your initial application to receiving monthly earnings.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className="relative flex flex-col justify-between rounded-3xl border border-[#D5D2F6] bg-white p-8 shadow-sm"
                  >
                    <div>
                      <span className="font-display text-3xl font-extrabold text-[#7F77DD]/40">
                        {step.number}
                      </span>
                      <div className="mt-4 inline-flex rounded-2xl bg-[#F4F2FF] p-3 text-[#7F77DD]">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-[#26215C]">
                        {step.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-[#5A5578]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <InstructorTestimonials />

        {/* ── Application Form ── */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div ref={formRef} className="rounded-3xl border border-[#D5D2F6] bg-white p-8 shadow-sm sm:p-12">
              <div className="text-center">
                <h2 className="font-display text-3xl font-extrabold text-[#26215C] sm:text-4xl">
                  Apply to Become an Instructor
                </h2>
                <p className="mt-4 text-base text-[#5A5578]">
                  Tell us about yourself and what you would love to teach.
                </p>
              </div>

              {isSubmitted ? (
                <div className="mt-10 rounded-2xl border border-[#D5D2F6] bg-[#F4F2FF] p-8 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-[#7F77DD]" />
                  <h3 className="mt-4 text-xl font-bold text-[#26215C]">Application Received</h3>
                  <p className="mt-2 text-sm text-[#5A5578]">
                    Thank you for applying! Our instructor review team will get back to you within 48 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-semibold text-[#26215C]">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D5D2F6] bg-[#FAF9FF] px-4 py-3 text-sm text-[#26215C] outline-none focus:border-[#7F77DD]"
                      placeholder="e.g. Amara Okafor"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-[#26215C]">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D5D2F6] bg-[#FAF9FF] px-4 py-3 text-sm text-[#26215C] outline-none focus:border-[#7F77DD]"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="expertise" className="block text-sm font-semibold text-[#26215C]">
                      Area of Expertise
                    </label>
                    <select
                      id="expertise"
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D5D2F6] bg-[#FAF9FF] px-4 py-3 text-sm text-[#26215C] outline-none focus:border-[#7F77DD]"
                    >
                      <option>Tailoring & Design</option>
                      <option>Baking & Pastry</option>
                      <option>Makeup Artistry</option>
                      <option>Photography</option>
                      <option>Crafts & Handmade</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="socialLink" className="block text-sm font-semibold text-[#26215C]">
                      Portfolio / Social Link (optional)
                    </label>
                    <input
                      id="socialLink"
                      type="url"
                      value={socialLink}
                      onChange={(e) => setSocialLink(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D5D2F6] bg-[#FAF9FF] px-4 py-3 text-sm text-[#26215C] outline-none focus:border-[#7F77DD]"
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>

                  <div>
                    <label htmlFor="motivation" className="block text-sm font-semibold text-[#26215C]">
                      What would you like to teach?
                    </label>
                    <textarea
                      id="motivation"
                      rows={4}
                      value={motivation}
                      onChange={(e) => setMotivation(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D5D2F6] bg-[#FAF9FF] px-4 py-3 text-sm text-[#26215C] outline-none focus:border-[#7F77DD]"
                      placeholder="Describe your course idea and the skills students will gain..."
                    />
                  </div>

                  {errorMsg && (
                    <p role="alert" className="text-sm font-medium text-red-600">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7F77DD] px-8 py-4 text-base font-semibold text-white shadow-lg transition duration-200 hover:bg-[#6860C7] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-5 w-5" />
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
