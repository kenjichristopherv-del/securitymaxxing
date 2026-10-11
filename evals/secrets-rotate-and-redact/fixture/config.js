// App configuration.
module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: "postgres://billing_app:Wq7v-Lr2x-9Tzm-Pk4d@db.internal.example.net:5432/billing",
  jwtSigningSecret: "b1ll1ng-jwt-s1gn1ng-s3cr3t-Q8xZr2LmN5",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  logLevel: process.env.LOG_LEVEL || "info",
};
