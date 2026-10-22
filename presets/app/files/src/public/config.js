// The runtime config. The image's entrypoint replaces this file when the container starts, with the VITE_
// environment variables; in dev and in the build it is empty, and the app falls back to import.meta.env.
window.__APP_CONFIG__ = {};
