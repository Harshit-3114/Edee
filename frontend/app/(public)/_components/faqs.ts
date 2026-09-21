export interface Faq {
  question: string;
  answer: string;
}

/**
 * The questions every visitor asks, answered from real product behaviour.
 * Shared by the home page teaser and the full FAQ page so the two can never
 * drift apart and contradict each other.
 */
export const FAQS: Faq[] = [
  {
    question: 'Who can create an account?',
    answer:
      'Students sign up directly with Google or a phone number. College and coaching-centre accounts are created by the platform team, so ask your institution for access.',
  },
  {
    question: 'How does payment work?',
    answer:
      'Pick the courses on your shortlist and pay once through Razorpay. A college sees your application only after the payment clears, and every status change shows up on your dashboard.',
  },
  {
    question: 'Can I withdraw an application?',
    answer:
      'Yes. From your dashboard you can withdraw any application the college has not decided yet.',
  },
  {
    question: 'What is a coaching invite code?',
    answer:
      'If a coaching centre invited you, entering their code at signup links you to their batch so they can follow your progress. It is optional.',
  },
  {
    question: 'Are application fees refundable?',
    answer:
      'No. Fees are set by each college and are not refundable, so check the total on your shortlist before paying.',
  },
];
