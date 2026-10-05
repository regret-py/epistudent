import type { Dictionary } from "../types";

const en: Dictionary = {
  meta: {
    title: "StudyBuddy Epitech",
    description: "Deadlines, project groups, free rooms and peer help for Epitech students.",
  },
  common: {
    appName: "StudyBuddy",
    soon: "Soon",
    signOut: "Sign out",
    toggleTheme: "Toggle theme",
    language: "Language",
  },
  login: {
    title: "Your Epitech HQ",
    subtitle: "Deadlines, groups, free rooms and Moulinette feedback, all in one place.",
    microsoft: "Continue with Microsoft",
    domainHint: "@epitech.eu account required",
    privacy: "We never store data about other students without their consent.",
    errors: {
      domain: "Only @epitech.eu accounts are allowed. Sign in again with your Epitech account.",
      oauth: "Microsoft sign-in failed. Please try again.",
      generic: "Something went wrong. Please try again.",
    },
  },
  onboarding: {
    title: "Welcome 👋",
    subtitle: "Four quick answers so we can suggest the right groups and deadlines.",
    promo: "Year",
    city: "Campus",
    languages: "Languages",
    languagesHint: "Rate yourself from 1 (beginner) to 5 (confident). Leave blank what you don't know.",
    availability: "When are you available?",
    slots: { weekday: "Weekdays", evening: "Evenings", weekend: "Weekends" },
    optIn: "Show me in group matchmaking",
    optInHint: "Your profile (year, campus, levels, availability) will be visible to students looking for a group. You can change this anytime.",
    submit: "Let's go",
    saving: "Saving…",
    errors: {
      "languages.required": "Rate at least one language.",
      "availability.required": "Pick at least one slot.",
      generic: "Couldn't save your profile. Please check the fields.",
    },
  },
  campuses: {
    paris: "Paris",
    bordeaux: "Bordeaux",
    lille: "Lille",
    lyon: "Lyon",
    marseille: "Marseille",
    montpellier: "Montpellier",
    mulhouse: "Mulhouse",
    nancy: "Nancy",
    nantes: "Nantes",
    nice: "Nice",
    rennes: "Rennes",
    "la-reunion": "Réunion Island",
    strasbourg: "Strasbourg",
    toulouse: "Toulouse",
  },
  nav: {
    dashboard: "Home",
    deadlines: "Deadlines",
    groups: "Groups",
    rooms: "Rooms",
    more: "More",
  },
  dashboard: {
    greeting: "Hi {name}",
    karma: "Karma",
    deadlines: {
      title: "Upcoming deadlines",
      empty: "No deadlines yet",
      emptyHint: "Intra sync is coming soon: your modules, projects and defenses will show up here.",
    },
    features: {
      groups: { title: "Find a group", description: "Matchmaking by level, availability and campus." },
      rooms: { title: "Free rooms", description: "Reported live by students." },
      moulinette: { title: "Moulinette feedback", description: "Common pitfalls and pass rates, anonymous." },
      swaps: { title: "Defense swaps", description: "Trade your slot for another one." },
      bocal: { title: "Bocal", description: "Available assistants and live queue." },
    },
  },
  section: {
    comingSoon: "This section is coming soon.",
    back: "Back to home",
  },
};

export default en;
