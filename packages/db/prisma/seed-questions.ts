/**
 * Starter question bank — original items authored against the primary sources.
 *
 * IMPORTANT (licensing): these questions are PACA's own wording. They test concepts
 * defined in the Scrum Guide 2020 and Kanban Guide (both CC BY-SA 4.0) without
 * reproducing their text, which keeps this bank PACA's proprietary asset. Facts and
 * ideas are not copyrightable; verbatim prose is. Do not paste guide text into `stem`.
 *
 * `sourceRef` exists so a reviewer can verify an answer in seconds. Keep it precise.
 *
 * This is a seed, not the bank. Target is 1,500-3,000 published items, reached via
 * the AI drafting pipeline with human review.
 */
import { Difficulty } from "@prisma/client";

export interface SeedQuestion {
  topicSlug: string;
  difficulty: Difficulty;
  stem: string;
  explanation: string;
  sourceRef: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

const F = Difficulty.FOUNDATION;
const I = Difficulty.INTERMEDIATE;
const A = Difficulty.ADVANCED;
const E = Difficulty.EXPERT;

export const STARTER_QUESTIONS: SeedQuestion[] = [
  // ---------------------------------------------------------------- Agile Manifesto
  {
    topicSlug: "agile-manifesto",
    difficulty: F,
    stem: "The Agile Manifesto expresses four value statements. What does the phrase 'over' signify in each statement?",
    explanation:
      "The Manifesto states that while there is value in the items on the right, the items on the left are valued more. It is a statement of relative preference, not a rejection of the right-hand items.",
    sourceRef: "Agile Manifesto, closing sentence",
    options: [
      { text: "The item on the left is valued more, while the item on the right still has value", isCorrect: true },
      { text: "The item on the right must be eliminated from the process entirely", isCorrect: false },
      { text: "The two items are of exactly equal importance", isCorrect: false },
      { text: "The item on the right applies only to regulated industries", isCorrect: false },
    ],
  },
  {
    topicSlug: "agile-manifesto",
    difficulty: F,
    stem: "Which of the following is one of the four values of the Agile Manifesto?",
    explanation:
      "'Customer collaboration over contract negotiation' is one of the four values. The others concern individuals and interactions, working software, and responding to change.",
    sourceRef: "Agile Manifesto, four values",
    options: [
      { text: "Customer collaboration over contract negotiation", isCorrect: true },
      { text: "Detailed estimation over rough forecasting", isCorrect: false },
      { text: "Cross-functional teams over specialist teams", isCorrect: false },
      { text: "Continuous integration over manual testing", isCorrect: false },
    ],
  },
  {
    topicSlug: "agile-manifesto",
    difficulty: I,
    stem: "A programme manager argues that because the team is Agile, it should stop producing any documentation. Which is the most accurate response?",
    explanation:
      "The Manifesto values working software more than comprehensive documentation, but explicitly affirms that there is value in documentation. The judgement is about how much documentation genuinely serves the product and its users.",
    sourceRef: "Agile Manifesto, value 2 and closing sentence",
    options: [
      {
        text: "Documentation still has value; the team should produce what genuinely serves the product rather than defaulting to comprehensive documentation",
        isCorrect: true,
      },
      { text: "Correct — Agile teams do not produce documentation", isCorrect: false },
      { text: "Documentation is required only when a regulator demands it", isCorrect: false },
      { text: "Documentation should be deferred entirely to the final Sprint before release", isCorrect: false },
    ],
  },
  {
    topicSlug: "agile-manifesto",
    difficulty: I,
    stem: "According to the principles behind the Agile Manifesto, what is the primary measure of progress?",
    explanation:
      "The principles state that working software is the primary measure of progress — not hours worked, tasks closed, or documents completed.",
    sourceRef: "Principles behind the Agile Manifesto, principle 7",
    options: [
      { text: "Working software", isCorrect: true },
      { text: "Velocity trending upward across Sprints", isCorrect: false },
      { text: "The percentage of the plan completed to date", isCorrect: false },
      { text: "The number of backlog items moved to Done", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Empiricism
  {
    topicSlug: "empiricism",
    difficulty: F,
    stem: "Scrum is founded on empiricism. Which three pillars uphold it?",
    explanation: "The three pillars of empirical process control in Scrum are transparency, inspection and adaptation.",
    sourceRef: "Scrum Guide 2020, Scrum Theory",
    options: [
      { text: "Transparency, inspection and adaptation", isCorrect: true },
      { text: "Commitment, focus and courage", isCorrect: false },
      { text: "Planning, execution and review", isCorrect: false },
      { text: "Visualisation, limitation and measurement", isCorrect: false },
    ],
  },
  {
    topicSlug: "empiricism",
    difficulty: A,
    stem: "A Scrum Team holds all events on schedule, but the Product Backlog is maintained privately by the Product Owner and stakeholders cannot see it. Which pillar is most directly undermined, and what is the consequence?",
    explanation:
      "Transparency is the precondition for the other two pillars. Inspection of a low-transparency artifact produces decisions based on a distorted picture, so adaptation is misdirected. Holding the events on time does not compensate.",
    sourceRef: "Scrum Guide 2020, Scrum Theory — transparency enables inspection",
    options: [
      {
        text: "Transparency — inspection then occurs against a distorted artifact, so any adaptation is misdirected",
        isCorrect: true,
      },
      { text: "Adaptation — the team cannot change the Sprint Backlog mid-Sprint", isCorrect: false },
      { text: "Inspection — events cannot occur without a visible backlog", isCorrect: false },
      { text: "None — holding all events on schedule satisfies empiricism", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Scrum values
  {
    topicSlug: "scrum-values",
    difficulty: F,
    stem: "Which set correctly lists the five Scrum values?",
    explanation: "The five Scrum values are commitment, focus, openness, respect and courage.",
    sourceRef: "Scrum Guide 2020, Scrum Values",
    options: [
      { text: "Commitment, focus, openness, respect, courage", isCorrect: true },
      { text: "Transparency, inspection, adaptation, trust, honesty", isCorrect: false },
      { text: "Collaboration, simplicity, feedback, communication, respect", isCorrect: false },
      { text: "Discipline, accountability, velocity, quality, openness", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Accountabilities
  {
    topicSlug: "scrum-accountabilities",
    difficulty: F,
    stem: "How many accountabilities does the Scrum Guide define within a Scrum Team?",
    explanation:
      "The Scrum Team consists of one Scrum Master, one Product Owner and Developers — three accountabilities, with no sub-teams or hierarchies.",
    sourceRef: "Scrum Guide 2020, Scrum Team",
    options: [
      { text: "Three", isCorrect: true },
      { text: "Two", isCorrect: false },
      { text: "Four", isCorrect: false },
      { text: "Five", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-accountabilities",
    difficulty: F,
    stem: "Who is accountable for maximising the value of the product resulting from the work of the Scrum Team?",
    explanation: "The Product Owner is accountable for maximising the value of the product.",
    sourceRef: "Scrum Guide 2020, Product Owner",
    options: [
      { text: "The Product Owner", isCorrect: true },
      { text: "The Scrum Master", isCorrect: false },
      { text: "The Developers collectively", isCorrect: false },
      { text: "The project sponsor", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-accountabilities",
    difficulty: I,
    stem: "A department decides that Product Owner decisions will be made by a committee of four managers voting on backlog order. What is the most significant problem with this arrangement?",
    explanation:
      "The Product Owner is one person, not a committee. A committee may represent the needs of many stakeholders in the Product Backlog, but accountability must rest with a single person so that decisions are unambiguous and the backlog remains a single source of truth.",
    sourceRef: "Scrum Guide 2020, Product Owner — 'The Product Owner is one person, not a committee'",
    options: [
      {
        text: "The Product Owner must be one person; a committee removes the clear single point of accountability for backlog decisions",
        isCorrect: true,
      },
      { text: "Committees are permitted only if they contain an odd number of members", isCorrect: false },
      { text: "Nothing is wrong, provided the committee meets before every Sprint Planning", isCorrect: false },
      { text: "The Scrum Master should chair the committee to keep it compliant", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-accountabilities",
    difficulty: I,
    stem: "Who is accountable for creating a valuable, useful Increment every Sprint?",
    explanation:
      "The Developers are accountable for creating a plan for the Sprint, instilling quality by adhering to the Definition of Done, and creating a valuable, useful Increment each Sprint.",
    sourceRef: "Scrum Guide 2020, Developers",
    options: [
      { text: "The Developers", isCorrect: true },
      { text: "The Product Owner", isCorrect: false },
      { text: "The Scrum Master", isCorrect: false },
      { text: "The stakeholders who attend the Sprint Review", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-accountabilities",
    difficulty: A,
    stem: "A Scrum Master is asked to also serve as the team's line manager, conducting performance appraisals that determine bonuses. Which risk most directly threatens the Scrum Master's effectiveness?",
    explanation:
      "The Scrum Master serves the team as a true leader and depends on the team's openness to surface impediments and problems. Holding reward power over the same people creates an incentive for them to conceal difficulties, which degrades transparency at source.",
    sourceRef: "Scrum Guide 2020, Scrum Master; Scrum Values — openness",
    options: [
      {
        text: "Team members become less willing to surface impediments and failures honestly, undermining the transparency the Scrum Master depends on",
        isCorrect: true,
      },
      { text: "The Scrum Guide forbids a Scrum Master from holding any other role in the organisation", isCorrect: false },
      { text: "The Scrum Master would no longer be permitted to attend the Daily Scrum", isCorrect: false },
      { text: "Line management duties would exceed the Scrum Master's timebox for the Sprint", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Scrum events
  {
    topicSlug: "scrum-events",
    difficulty: F,
    stem: "What is the maximum duration of a Sprint?",
    explanation: "Sprints are fixed-length events of one month or less to create consistency.",
    sourceRef: "Scrum Guide 2020, The Sprint",
    options: [
      { text: "One month", isCorrect: true },
      { text: "Two weeks", isCorrect: false },
      { text: "Six weeks", isCorrect: false },
      { text: "One quarter", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: F,
    stem: "What is the timebox for the Daily Scrum?",
    explanation: "The Daily Scrum is a 15-minute event for the Developers, held at the same time and place every working day.",
    sourceRef: "Scrum Guide 2020, Daily Scrum",
    options: [
      { text: "15 minutes", isCorrect: true },
      { text: "30 minutes", isCorrect: false },
      { text: "One hour", isCorrect: false },
      { text: "It varies with Sprint length", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: F,
    stem: "For a one-month Sprint, what is the maximum duration of Sprint Planning?",
    explanation: "Sprint Planning is timeboxed to a maximum of eight hours for a one-month Sprint, and is usually shorter for shorter Sprints.",
    sourceRef: "Scrum Guide 2020, Sprint Planning",
    options: [
      { text: "Eight hours", isCorrect: true },
      { text: "Four hours", isCorrect: false },
      { text: "Three hours", isCorrect: false },
      { text: "Twelve hours", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: I,
    stem: "Match the timeboxes for a one-month Sprint: which option correctly gives Sprint Review and Sprint Retrospective respectively?",
    explanation:
      "For a one-month Sprint, the Sprint Review is timeboxed to a maximum of four hours and the Sprint Retrospective to a maximum of three hours.",
    sourceRef: "Scrum Guide 2020, Sprint Review and Sprint Retrospective",
    options: [
      { text: "Four hours and three hours", isCorrect: true },
      { text: "Three hours and four hours", isCorrect: false },
      { text: "Four hours and four hours", isCorrect: false },
      { text: "Eight hours and four hours", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: I,
    stem: "Who has the authority to cancel a Sprint?",
    explanation:
      "Only the Product Owner has the authority to cancel a Sprint. A Sprint would be cancelled if the Sprint Goal becomes obsolete.",
    sourceRef: "Scrum Guide 2020, The Sprint",
    options: [
      { text: "The Product Owner", isCorrect: true },
      { text: "The Scrum Master", isCorrect: false },
      { text: "The Developers, by majority agreement", isCorrect: false },
      { text: "Any stakeholder funding the product", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: I,
    stem: "Halfway through a Sprint, the Product Owner identifies new work that would not endanger the Sprint Goal. What does Scrum permit?",
    explanation:
      "Scope may be clarified and renegotiated with the Product Owner as more is learned. What is prohibited is a change that endangers the Sprint Goal. The Sprint Backlog belongs to the Developers, who update it throughout the Sprint.",
    sourceRef: "Scrum Guide 2020, The Sprint and Sprint Backlog",
    options: [
      {
        text: "Scope can be clarified and renegotiated with the Product Owner, provided the Sprint Goal is not endangered",
        isCorrect: true,
      },
      { text: "Nothing may change once Sprint Planning has concluded", isCorrect: false },
      { text: "The Sprint must be cancelled and replanned", isCorrect: false },
      { text: "The work must wait for the next Sprint Planning without exception", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-events",
    difficulty: A,
    stem: "A Scrum Master notices the Daily Scrum has become a sequence of status reports delivered to them personally, and finishes in six minutes with no plan produced. Which intervention best addresses the underlying problem?",
    explanation:
      "The Daily Scrum exists for the Developers to inspect progress toward the Sprint Goal and adapt the Sprint Backlog, producing an actionable plan for the next day. Reporting to the Scrum Master indicates ownership has drifted away from the Developers. Coaching them to own the event and focus it on the Sprint Goal addresses the cause; policing attendance or duration addresses only symptoms.",
    sourceRef: "Scrum Guide 2020, Daily Scrum",
    options: [
      {
        text: "Coach the Developers to run the event themselves, focusing it on progress toward the Sprint Goal and producing an actionable plan for the next day",
        isCorrect: true,
      },
      { text: "Require every Developer to speak for at least two minutes to fill the timebox", isCorrect: false },
      { text: "Move the Daily Scrum to a written channel so it is faster still", isCorrect: false },
      { text: "Attend and take notes so the status information is captured accurately", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Artifacts
  {
    topicSlug: "scrum-artifacts",
    difficulty: F,
    stem: "Which commitment belongs to the Product Backlog?",
    explanation:
      "Each Scrum artifact contains a commitment: the Product Backlog has the Product Goal, the Sprint Backlog has the Sprint Goal, and the Increment has the Definition of Done.",
    sourceRef: "Scrum Guide 2020, Scrum Artifacts",
    options: [
      { text: "The Product Goal", isCorrect: true },
      { text: "The Sprint Goal", isCorrect: false },
      { text: "The Definition of Done", isCorrect: false },
      { text: "The release plan", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-artifacts",
    difficulty: I,
    stem: "Which statement about the Definition of Done is correct?",
    explanation:
      "The Definition of Done is a formal description of the state of the Increment when it meets the required quality measures. Work cannot be considered part of an Increment until it meets it. If an organisation has a standard, all Scrum Teams must follow it as a minimum.",
    sourceRef: "Scrum Guide 2020, Increment / Definition of Done",
    options: [
      {
        text: "If the organisation has a Definition of Done standard, all Scrum Teams must follow it as a minimum",
        isCorrect: true,
      },
      { text: "It is set by the Product Owner alone at the start of each Sprint", isCorrect: false },
      { text: "It may be relaxed for the final Sprint before a release deadline", isCorrect: false },
      { text: "It applies only to items larger than a defined story-point threshold", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-artifacts",
    difficulty: I,
    stem: "The Sprint Backlog is composed of three things. Which option lists them?",
    explanation:
      "The Sprint Backlog is composed of the Sprint Goal (why), the set of Product Backlog items selected for the Sprint (what), and an actionable plan for delivering the Increment (how).",
    sourceRef: "Scrum Guide 2020, Sprint Backlog",
    options: [
      { text: "The Sprint Goal, the selected Product Backlog items, and an actionable plan for delivering the Increment", isCorrect: true },
      { text: "The Product Goal, the release plan, and the Definition of Done", isCorrect: false },
      { text: "The task board, the burndown chart, and the capacity plan", isCorrect: false },
      { text: "The Sprint Goal, the Definition of Done, and the velocity forecast", isCorrect: false },
    ],
  },
  {
    topicSlug: "scrum-artifacts",
    difficulty: A,
    stem: "At the Sprint Review, the Developers demonstrate work that functions but has not met one criterion of the Definition of Done. The Product Owner wants to release it to a customer who is waiting. What is the correct position?",
    explanation:
      "Work that does not meet the Definition of Done cannot be released or presented at the Sprint Review, and is not part of an Increment. It returns to the Product Backlog for future consideration. Releasing it would break the transparency that the Definition of Done exists to protect.",
    sourceRef: "Scrum Guide 2020, Increment",
    options: [
      {
        text: "It is not part of an Increment, cannot be released, and returns to the Product Backlog for future consideration",
        isCorrect: true,
      },
      { text: "The Product Owner may authorise release because they are accountable for value", isCorrect: false },
      { text: "It may be released if the missing criterion is added to the next Sprint's backlog", isCorrect: false },
      { text: "The Scrum Master decides, as the guardian of the process", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Kanban
  {
    topicSlug: "kanban-practices",
    difficulty: F,
    stem: "The Kanban Guide defines Kanban as a strategy for optimising what?",
    explanation: "Kanban is defined as a strategy for optimising the flow of value through a process that uses a visual, pull-based system.",
    sourceRef: "Kanban Guide, Definition of Kanban",
    options: [
      { text: "The flow of value through a process", isCorrect: true },
      { text: "The utilisation of every team member", isCorrect: false },
      { text: "The accuracy of long-range estimates", isCorrect: false },
      { text: "The number of items completed per person", isCorrect: false },
    ],
  },
  {
    topicSlug: "kanban-practices",
    difficulty: I,
    stem: "Which three practices does the Kanban Guide require?",
    explanation:
      "The Kanban Guide names three practices: defining and visualising the workflow, actively managing items in the workflow, and improving the workflow.",
    sourceRef: "Kanban Guide, Kanban Practices",
    options: [
      {
        text: "Defining and visualising the workflow; actively managing items in the workflow; improving the workflow",
        isCorrect: true,
      },
      { text: "Visualising work; limiting WIP; holding a daily standup", isCorrect: false },
      { text: "Estimating items; prioritising the queue; reporting velocity", isCorrect: false },
      { text: "Planning the release; managing dependencies; reviewing capacity", isCorrect: false },
    ],
  },
  {
    topicSlug: "definition-of-workflow",
    difficulty: A,
    stem: "A team's Definition of Workflow visualises states and sets WIP limits, but has never agreed what 'started' and 'finished' mean. Which flow metrics become unreliable as a direct result?",
    explanation:
      "Cycle Time is the elapsed time between a work item starting and finishing, Work Item Age is the elapsed time since it started, and both WIP and Throughput are defined relative to the started and finished points. Without agreed start and finish points, none of the four metrics has a defensible definition.",
    sourceRef: "Kanban Guide, Definition of Workflow and Flow Metrics",
    options: [
      { text: "All four — WIP, Throughput, Work Item Age and Cycle Time all depend on those points", isCorrect: true },
      { text: "Only Cycle Time", isCorrect: false },
      { text: "Only Work Item Age and Cycle Time", isCorrect: false },
      { text: "None — the metrics are independent of the Definition of Workflow", isCorrect: false },
    ],
  },
  {
    topicSlug: "wip-control",
    difficulty: I,
    stem: "What is the primary reason for controlling Work in Progress?",
    explanation:
      "Controlling WIP is what makes flow possible: it limits the number of items in progress so that items finish rather than accumulate, which shortens Cycle Time and exposes bottlenecks. It is not a device for measuring or maximising individual busyness.",
    sourceRef: "Kanban Guide, Kanban Practices — controlling WIP",
    options: [
      { text: "To improve flow by ensuring items finish rather than accumulate, which shortens Cycle Time", isCorrect: true },
      { text: "To ensure every team member is fully utilised at all times", isCorrect: false },
      { text: "To make individual productivity comparable across team members", isCorrect: false },
      { text: "To guarantee that no item is ever blocked", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Flow metrics
  {
    topicSlug: "flow-metrics",
    difficulty: F,
    stem: "Which option lists the four flow metrics required by the Kanban Guide?",
    explanation: "The four required flow metrics are WIP, Throughput, Work Item Age and Cycle Time.",
    sourceRef: "Kanban Guide, Flow Metrics",
    options: [
      { text: "WIP, Throughput, Work Item Age, Cycle Time", isCorrect: true },
      { text: "Velocity, Burndown, Capacity, Utilisation", isCorrect: false },
      { text: "Lead Time, Story Points, Defect Rate, Throughput", isCorrect: false },
      { text: "WIP, Velocity, Cycle Time, Escaped Defects", isCorrect: false },
    ],
  },
  {
    topicSlug: "cycle-time",
    difficulty: I,
    stem: "What does Work Item Age measure?",
    explanation:
      "Work Item Age is the elapsed time between when a work item started and the current moment. It applies only to items still in progress, which is what makes it actionable — unlike Cycle Time, which is only known once an item has finished.",
    sourceRef: "Kanban Guide, Flow Metrics",
    options: [
      { text: "The elapsed time between when an item started and the current moment, for items still in progress", isCorrect: true },
      { text: "The elapsed time between an item starting and finishing", isCorrect: false },
      { text: "The time an item has spent waiting in the backlog before being started", isCorrect: false },
      { text: "The number of days since the item was first requested by a stakeholder", isCorrect: false },
    ],
  },
  {
    topicSlug: "cycle-time",
    difficulty: A,
    stem: "Two teams both report a median Cycle Time of 5 days. Team A's 85th percentile is 7 days; Team B's is 26 days. Which conclusion is best supported?",
    explanation:
      "The median hides the tail of the distribution. Team B's wide spread means a far less predictable service, so its Service Level Expectation must quote a much longer timeframe to reach the same confidence. Cycle Time distributions are typically right-skewed, which is exactly why percentiles rather than averages are used for forecasting.",
    sourceRef: "Kanban Guide, Flow Metrics and Service Level Expectation",
    options: [
      {
        text: "Team B is far less predictable; to offer the same confidence its SLE must quote a substantially longer timeframe",
        isCorrect: true,
      },
      { text: "The teams are equally predictable because their medians match", isCorrect: false },
      { text: "Team B has higher Throughput, since more items are in progress for longer", isCorrect: false },
      { text: "Team A must be limiting WIP more aggressively than is advisable", isCorrect: false },
    ],
  },
  {
    topicSlug: "service-level-expectation",
    difficulty: I,
    stem: "A Service Level Expectation must contain which two elements?",
    explanation:
      "An SLE is a forecast of how long it should take an item to flow from started to finished, and has two parts: a period of elapsed time and a probability associated with that period — for example, '85% of items finish in 8 days or less'.",
    sourceRef: "Kanban Guide, Service Level Expectation",
    options: [
      { text: "A timeframe and a probability", isCorrect: true },
      { text: "A due date and an owner", isCorrect: false },
      { text: "A WIP limit and a throughput target", isCorrect: false },
      { text: "An estimate in story points and a confidence rating", isCorrect: false },
    ],
  },
  {
    topicSlug: "littles-law",
    difficulty: A,
    stem: "A team maintains an average WIP of 20 items and an average Throughput of 4 items per week. Using Little's Law, what is the approximate average Cycle Time?",
    explanation:
      "Little's Law in its flow form gives average Cycle Time = average WIP / average Throughput, so 20 / 4 = 5 weeks. This is why reducing WIP shortens Cycle Time without any change in how fast people work.",
    sourceRef: "Little's Law, flow formulation",
    options: [
      { text: "5 weeks", isCorrect: true },
      { text: "80 weeks", isCorrect: false },
      { text: "0.2 weeks", isCorrect: false },
      { text: "24 weeks", isCorrect: false },
    ],
  },
  {
    topicSlug: "throughput",
    difficulty: I,
    stem: "Why is Throughput generally preferred over velocity for forecasting?",
    explanation:
      "Throughput counts items actually finished per unit of time, so it needs no estimation step and is comparable over time. Velocity depends on story-point estimates, which are team-specific, subjective and prone to inflation, making them a weaker basis for probabilistic forecasting.",
    sourceRef: "Kanban Guide, Flow Metrics",
    options: [
      {
        text: "Throughput counts items actually finished and requires no estimation, so it avoids the subjectivity and drift of story points",
        isCorrect: true,
      },
      { text: "Throughput is always a larger number, giving more optimistic forecasts", isCorrect: false },
      { text: "Velocity cannot be measured in Kanban systems", isCorrect: false },
      { text: "Throughput accounts for team capacity changes automatically", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- EBM
  {
    topicSlug: "ebm-key-value-areas",
    difficulty: A,
    stem: "Which option lists the four Key Value Areas of Evidence-Based Management?",
    explanation:
      "EBM defines four Key Value Areas: Current Value, Unrealized Value, Time-to-Market and Ability to Innovate. Together they balance what value exists today against what could exist, and the organisation's capacity to deliver it.",
    sourceRef: "Evidence-Based Management Guide, Key Value Areas",
    options: [
      { text: "Current Value, Unrealized Value, Time-to-Market, Ability to Innovate", isCorrect: true },
      { text: "Revenue, Cost, Quality, Risk", isCorrect: false },
      { text: "Customer Value, Employee Value, Shareholder Value, Social Value", isCorrect: false },
      { text: "Throughput, Cycle Time, Work Item Age, WIP", isCorrect: false },
    ],
  },
  {
    topicSlug: "ebm-key-value-areas",
    difficulty: E,
    stem: "An organisation reports strong Current Value and short Time-to-Market, but its Ability to Innovate measures are declining sharply. What does this pattern most likely indicate?",
    explanation:
      "Strong Current Value with declining Ability to Innovate is the classic signature of an organisation harvesting an existing product while accumulating technical debt and low-value features that consume capacity. It delivers well today but is progressively losing the capacity to deliver new value — a lagging risk that Current Value alone will not reveal until it is expensive to reverse.",
    sourceRef: "Evidence-Based Management Guide, Ability to Innovate",
    options: [
      {
        text: "The organisation is harvesting an existing product while its capacity to deliver new value erodes — a risk invisible in Current Value alone",
        isCorrect: true,
      },
      { text: "The measures are contradictory and at least one must be miscalculated", isCorrect: false },
      { text: "Ability to Innovate is a lagging indicator of Current Value and will self-correct", isCorrect: false },
      { text: "The organisation should reduce Time-to-Market further to compensate", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Lean / XP / DevOps
  {
    topicSlug: "lean",
    difficulty: I,
    stem: "In Lean thinking, which of the following best describes 'waste'?",
    explanation:
      "Waste is any activity that consumes resources without creating value for the customer. Note that some non-value-adding activity is currently necessary (for example, certain regulatory steps) — Lean distinguishes pure waste from necessary non-value-adding work.",
    sourceRef: "Lean thinking, definition of muda",
    options: [
      { text: "Any activity that consumes resources without creating value for the customer", isCorrect: true },
      { text: "Any activity performed by someone outside the delivery team", isCorrect: false },
      { text: "Any task that takes longer than its original estimate", isCorrect: false },
      { text: "Any work that has to be repeated because of a defect", isCorrect: false },
    ],
  },
  {
    topicSlug: "xp",
    difficulty: I,
    stem: "What is the primary purpose of test-driven development?",
    explanation:
      "TDD's principal benefit is design: writing the test first forces the developer to specify the intended behaviour and a usable interface before implementing it. High test coverage and regression safety are valuable consequences rather than the primary aim.",
    sourceRef: "Extreme Programming, test-driven development",
    options: [
      {
        text: "To drive the design of the code by specifying intended behaviour before implementing it",
        isCorrect: true,
      },
      { text: "To achieve a mandated percentage of code coverage", isCorrect: false },
      { text: "To replace the need for exploratory and integration testing", isCorrect: false },
      { text: "To allow the QA function to be removed from the team", isCorrect: false },
    ],
  },
  {
    topicSlug: "devops",
    difficulty: A,
    stem: "A team practises continuous integration but merges long-lived feature branches only once per Sprint. Why does this fail to deliver the main benefit of CI?",
    explanation:
      "The benefit of CI comes from integrating frequently — ideally at least daily — so that conflicts and integration defects are found while they are small and cheap to fix. Merging once per Sprint reintroduces exactly the large, late, expensive integration problem that CI exists to eliminate, regardless of how good the build automation is.",
    sourceRef: "Continuous integration, integration frequency",
    options: [
      {
        text: "Integration problems accumulate until the merge, so they are discovered late and are expensive to resolve — the cost CI exists to remove",
        isCorrect: true,
      },
      { text: "Continuous integration requires a specific build tool that branch-based workflows cannot use", isCorrect: false },
      { text: "Feature branches prevent automated tests from running at all", isCorrect: false },
      { text: "It is not a failure; merging once per Sprint satisfies continuous integration", isCorrect: false },
    ],
  },

  // ---------------------------------------------------------------- Product & coaching
  {
    topicSlug: "product-management",
    difficulty: A,
    stem: "A stakeholder insists on a fixed scope, fixed date and fixed budget for a product with high uncertainty. Which response best reflects an empirical approach?",
    explanation:
      "Under high uncertainty, all three constraints cannot be fixed honestly. An empirical approach fixes date and budget and varies scope, delivering the highest-value items first so that the most valuable outcome is achieved by the date — while making the trade-off explicit rather than concealing it behind an optimistic plan.",
    sourceRef: "Empirical process control; Agile Manifesto principle 2",
    options: [
      {
        text: "Propose fixing date and budget while varying scope, delivering highest-value items first and making the trade-off explicit",
        isCorrect: true,
      },
      { text: "Accept all three constraints and add contingency to the estimate", isCorrect: false },
      { text: "Decline the work, since Agile is incompatible with any fixed date", isCorrect: false },
      { text: "Fix scope and date, and request additional people to absorb the uncertainty", isCorrect: false },
    ],
  },
  {
    topicSlug: "agile-coaching",
    difficulty: A,
    stem: "Which of the following best distinguishes coaching from mentoring?",
    explanation:
      "Coaching draws solutions out of the person through questioning, on the premise that they are resourceful and capable. Mentoring shares the mentor's own experience and advice. Both are legitimate; the distinction is where the answer originates.",
    sourceRef: "Professional coaching competencies",
    options: [
      {
        text: "Coaching draws answers out of the person through questioning; mentoring offers the practitioner's own experience and advice",
        isCorrect: true,
      },
      { text: "Coaching is for individuals and mentoring is only for teams", isCorrect: false },
      { text: "Coaching is time-boxed while mentoring is open-ended", isCorrect: false },
      { text: "Coaching requires formal certification whereas mentoring does not", isCorrect: false },
    ],
  },
  {
    topicSlug: "agile-leadership",
    difficulty: E,
    stem: "An executive mandates that every team adopt an identical Agile process, measured by a compliance scorecard. Which critique is most substantive?",
    explanation:
      "Imposing a uniform process and measuring compliance optimises for conformity rather than outcomes, and removes the local inspection and adaptation on which empiricism depends. Teams then improve their scores rather than their products — a well-documented failure mode of process-compliance metrics.",
    sourceRef: "Empiricism; outcome versus output measurement",
    options: [
      {
        text: "Measuring process compliance rather than outcomes removes local adaptation, so teams optimise their scores instead of their products",
        isCorrect: true,
      },
      { text: "Executives are not permitted to set expectations about ways of working", isCorrect: false },
      { text: "Scorecards are always invalid because Agile rejects measurement", isCorrect: false },
      { text: "The mandate would be acceptable if the scorecard were reviewed annually", isCorrect: false },
    ],
  },
  {
    topicSlug: "scaling",
    difficulty: A,
    stem: "Several teams work on one product. What does Scrum say about the Product Backlog and Product Goal in this situation?",
    explanation:
      "If multiple Scrum Teams work together on one product, they share one Product Backlog, one Product Goal and one Product Owner. Each team has its own Sprint Backlog and Sprint Goal, but the product-level artifacts remain singular.",
    sourceRef: "Scrum Guide 2020, Scrum Team and Product Backlog",
    options: [
      { text: "They share one Product Backlog, one Product Goal and one Product Owner", isCorrect: true },
      { text: "Each team maintains its own Product Backlog and Product Goal", isCorrect: false },
      { text: "Each team has its own Product Owner reporting to a chief Product Owner", isCorrect: false },
      { text: "Scrum does not permit more than one team to work on a single product", isCorrect: false },
    ],
  },
];
