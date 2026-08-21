process.env.PR4_W3_FIXTURE = "true";

const { default: pr4Config } = await import("./playwright.pr4.config");

export default {
  ...pr4Config,
  testMatch: /pr4-p2b-decision-learning-teacher-debrief\.spec\.ts/,
  testIgnore: []
};
