require.extensions[".css"] = function registerCssModule(module) {
  const styles = new Proxy({}, { get: (_target, key) => String(key) });
  module.exports = { __esModule: true, default: styles };
};
