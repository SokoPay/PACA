/** Built-in questions and answers. Items an admin publishes in the database are shown alongside these. */
export interface FaqEntry {
  category: string;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES = [
  "About PACA",
  "Membership and applications",
  "Payment",
  "Exams and certificates",
  "Badges",
  "Your account and security",
  "Jobs, events and the library",
] as const;

export const BUILT_IN_FAQ: FaqEntry[] = [
  // About PACA
  { category: "About PACA", question: "What is PACA?", answer: "PACA (Professional Agile Certification, Africa) sets benchmark standards for the Agile profession in Africa. We offer membership, certification exams, study resources, an Agile job board, events and a professional network." },
  { category: "About PACA", question: "Who can join PACA?", answer: "Anyone interested in Agile can register for free. Students, working professionals, executives and retired practitioners can then apply for the membership type that fits them. Fellow membership is by panel assessment." },
  { category: "About PACA", question: "Is registering free?", answer: "Yes. Creating an account is free, and so is the competency test. You only pay when your membership application has been approved." },
  { category: "About PACA", question: "What membership types are there?", answer: "Student, Professional, Executive, Fellow and Retired. Each has its own application form, requirements, price and benefits. See the Membership page for details." },

  // Membership and applications
  { category: "Membership and applications", question: "How do I apply for membership?", answer: "Register and verify your email, then choose a membership type on the Membership page and complete the application form. Upload the documents asked for (for example a student ID or CV) and press Submit." },
  { category: "Membership and applications", question: "Which files can I upload?", answer: "Images (JPG or PNG), PDF and Word documents (DOC or DOCX), up to 8 MB each. Every file is checked for viruses before staff can open it." },
  { category: "Membership and applications", question: "How long does a review take?", answer: "PACA staff are alerted as soon as you submit. You receive an email and a notification the moment there is a decision." },
  { category: "Membership and applications", question: "Can I change my application after submitting it?", answer: "Yes. Open My applications from your profile menu and press Edit. Editing takes it out of the review queue until you submit it again. Once an application is approved it can no longer be edited." },
  { category: "Membership and applications", question: "My application was declined. What now?", answer: "You will see the reviewer's reason on My applications. Your answers and files are kept, so you only need to fix what was asked and submit again." },
  { category: "Membership and applications", question: "I have been approved. Am I a member now?", answer: "Approval means your application was accepted, but your membership only becomes active once your payment is confirmed. Until then you cannot sit the certification exam or download badges." },
  { category: "Membership and applications", question: "How long does membership last?", answer: "One full year from the day your payment is confirmed, for example from 16 November 2026 to 16 November 2027. It does not end on 31 December." },

  // Payment
  { category: "Payment", question: "How do I pay?", answer: "After approval, your dashboard shows a Pay button. Payment is handled securely by Paystack: card, mobile money or bank. PACA never sees or stores your card details." },
  { category: "Payment", question: "Can I pay in cash or by direct transfer?", answer: "Yes. Pay PACA in cash, by bank transfer or by mobile money to PACA's own account. A PACA administrator then confirms the payment, your membership becomes active straight away, and you receive an email with your member ID." },
  { category: "Payment", question: "I paid online but my dashboard still says pay. What should I do?", answer: "Paystack confirms most payments within seconds. If your dashboard has not updated after a few minutes, refresh the page. If it still shows unpaid, contact PACA with your payment reference from your Paystack receipt." },
  { category: "Payment", question: "In which currency am I charged?", answer: "Prices are set in US dollars and charged in the local currency shown on the Pay button, at PACA's published rate." },
  { category: "Payment", question: "How do I renew?", answer: "When your year ends, your dashboard shows a Renew button. Your new year runs from the day the renewal payment is confirmed." },

  // Exams and certificates
  { category: "Exams and certificates", question: "Is there a free test?", answer: "Yes. Every registered user can take the free competency test: 20 questions in 30 minutes. You see the right answers and explanations afterwards, and you can retake it to keep learning." },
  { category: "Exams and certificates", question: "What is the certification exam like?", answer: "60 multiple-choice questions in 60 minutes, and you need 85% to pass. Each sitting is a fresh random paper with shuffled questions and answers." },
  { category: "Exams and certificates", question: "Are the exams different for each membership type?", answer: "Yes. Student, Professional and Executive exams each have their own question pool written for that audience. Student questions test core knowledge, Professional questions use real team situations, and Executive questions focus on leadership and organisational decisions." },
  { category: "Exams and certificates", question: "How many attempts do I get?", answer: "Your membership includes three attempts. If you need more, you can buy a resit block at half your membership fee." },
  { category: "Exams and certificates", question: "Will I be signed out during an exam?", answer: "No. The automatic sign-out after 30 minutes of inactivity is paused while an exam or test is open, so your attempt is never cut short." },
  { category: "Exams and certificates", question: "What happens if my connection drops during the exam?", answer: "Your answers are saved as you go. Sign back in and open the exam page to continue. The timer keeps running on PACA's server, so return as quickly as you can." },
  { category: "Exams and certificates", question: "How can an employer check my certificate?", answer: "Every certificate has a credential ID. Anyone can enter it on the Verify page, or open the link printed on your certificate, to confirm it is genuine and valid." },

  // Badges
  { category: "Badges", question: "How do I get my member badge?", answer: "Once your membership is active, open your dashboard and press Download my badge. It shows your full name, member ID and the dates your membership is valid, plus a link anyone can use to verify it." },
  { category: "Badges", question: "Do I get a badge for passing the exam?", answer: "Yes. When you pass, a personalised exam-passed badge with your name, credential ID and score is available on My certificates and the exam page." },
  { category: "Badges", question: "Why can't I download my badge?", answer: "Badges are only issued while your membership is paid and in date. If your payment has not been confirmed or your membership has expired, renew or contact PACA." },
  { category: "Badges", question: "Can I add my badge to LinkedIn?", answer: "Yes. Your dashboard has an Add to LinkedIn profile button, and share buttons for LinkedIn, X, Facebook and WhatsApp." },

  // Account and security
  { category: "Your account and security", question: "I forgot my password. What do I do?", answer: "On the Sign in page click Forgot password?, enter your email and press Send reset link. The link works once and expires after 30 minutes. For safety you will be signed out on every device after resetting." },
  { category: "Your account and security", question: "Why was I signed out?", answer: "To protect your account, you are signed out automatically after 30 minutes without any activity. You will see a warning two minutes before. This never happens while you are taking an exam or test." },
  { category: "Your account and security", question: "Why is my account locked?", answer: "After 3 wrong passwords your account locks for 30 minutes. If the password is wrong again after that, you must reset it using the link we email you." },
  { category: "Your account and security", question: "How does PACA keep my session safe?", answer: "Your sign-in key is kept in a secure browser cookie that page scripts cannot read, connections always use HTTPS, and signing out in one tab signs you out in all of them." },
  { category: "Your account and security", question: "Can I delete my account?", answer: "Yes. Contact PACA and a super administrator will permanently erase your account, applications, documents and membership. This cannot be undone." },
  { category: "Your account and security", question: "Who can see my documents?", answer: "Only you and PACA staff who review applications. Documents are never public and are not shown in the professional network." },

  // Jobs, events and library
  { category: "Jobs, events and the library", question: "What is the Agile job board?", answer: "A list of Scrum Master, Product Owner, Agile coach and similar roles, screened and updated twice a day. Paid members see the full board and get notified of new roles." },
  { category: "Jobs, events and the library", question: "Do members get event discounts?", answer: "Yes. Paid members see member discount codes for PACA and partner events on the Events page and their dashboard." },
  { category: "Jobs, events and the library", question: "What is in the study library?", answer: "PDF books and guides chosen for your membership type, readable once your membership is active." },
  { category: "Jobs, events and the library", question: "What is the professional network?", answer: "A directory of PACA members across Africa. You choose on My profile whether to appear in it." },
];
