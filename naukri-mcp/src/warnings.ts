process.removeAllListeners("warning");
process.on("warning", (warning: Error & { name: string }) => {
  if (warning.name === "ExperimentalWarning" && /SQLite/i.test(warning.message)) return;
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});
