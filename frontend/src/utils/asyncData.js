export async function settleRequestMap(requests) {
  const entries = Object.entries(requests);
  const results = await Promise.allSettled(
    entries.map(([, request]) => request)
  );
  const values = {};
  const errors = [];

  results.forEach((result, index) => {
    const [key] = entries[index];

    if (result.status === "fulfilled") {
      values[key] = result.value;
    } else {
      errors.push({ key, error: result.reason });
    }
  });

  return { values, errors };
}
