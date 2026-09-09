// pg-pool only listens for errors while a client is idle in its pool. A
// checked-out client needs its own listener, including between queries.
export function watchDatabaseClient(client) {
  let connectionError;
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  // The connection can fail before the next operation installs its race.
  failure.catch(() => {});
  const onError = (error) => {
    connectionError ||= error;
    rejectFailure(connectionError);
  };
  client.on("error", onError);
  return {
    get error() { return connectionError; },
    async run(operation) {
      if (connectionError) throw connectionError;
      return Promise.race([operation(), failure]);
    },
    close() { client.removeListener("error", onError); },
  };
}
