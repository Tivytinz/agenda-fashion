function obterContentSecurityPolicy() {
  return {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "connect-src": [
        "'self'",
        "https://accounts.google.com",
        "https://www.facebook.com",
        "https://www.google-analytics.com",
        "https://region1.google-analytics.com",
      ],
      "font-src": ["'self'", "data:"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "frame-src": [
        "'self'",
        "https://accounts.google.com",
      ],
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https:",
      ],
      "object-src": ["'none'"],
      "script-src": [
        "'self'",
        "https://accounts.google.com",
        "https://connect.facebook.net",
        "https://www.googletagmanager.com",
      ],
      "script-src-attr": ["'none'"],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://accounts.google.com",
      ],
      "worker-src": ["'self'", "blob:"],
    },
  };
}

module.exports = {
  obterContentSecurityPolicy,
};
