/** @type {import('next').NextConfig} */
export default {
  // City packs are generated at build time into data/packs (git-ignored) and traced into server functions.
  outputFileTracingIncludes: { "/api/**": ["./data/packs/**"] },
};
