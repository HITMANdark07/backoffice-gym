export const site = {
  name: 'BackOffice Gym',
  tagline: 'An RL environment where AI agents run a store.',
  description:
    'An open-source RL environment where AI agents run the back office of a fictional store. Rewards come from SQL checks on the final database state, with trap tasks and replayable runs.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100',
  repo: 'https://github.com/HITMANdark07/backoffice-gym',
  author: 'Shekhar Kumar',
  authorUrl: 'https://www.shekharkumar.com',
} as const;
