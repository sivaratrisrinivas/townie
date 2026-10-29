// TN-NICHE experiment: swap entertainment names (musicians, stars, TV) instead of shops. Off on main.
export const NICHE = process.env.TOWNIE_NICHE === "entertainment" || process.env.VERCEL_GIT_COMMIT_REF === "niche-exp";
