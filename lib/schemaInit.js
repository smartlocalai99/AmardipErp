// Share the first setup attempt between concurrent requests and reuse successful
// setup for this process. A database outage must leave the next request able to retry.
export function createSchemaInitializer(initialize) {
  let pending;
  return function ensureSchema() {
    if (!pending) {
      pending = Promise.resolve().then(initialize).catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}
